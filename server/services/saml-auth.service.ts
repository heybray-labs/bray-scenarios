import jwt from "jsonwebtoken";
import { SAML, ValidateInResponseTo, type Profile } from "@node-saml/node-saml";
import {
  assertSamlConfigured,
  decodeSamlIdpMetadata,
  getAppUrl,
  getAuthProtocol,
  getSamlAcsUrl,
  getSamlProviderName,
  getSamlSpCertDir,
  getSamlSpEntityId,
  isSamlConfigured,
} from "../config/auth-config.ts";
import { createExchangeCode } from "./sso-exchange.service.ts";
import { resolveUserFromSsoClaims } from "./sso-user-resolution.service.ts";
import { parseIdpMetadata } from "../utils/saml-idp-metadata.ts";
import { normalizeSamlPostBody } from "../utils/saml-post-body.ts";
import { loadOrCreateSpCert } from "../utils/saml-sp-cert.ts";
import {
  shouldUseGoogleAccountChooser,
  wrapGoogleSamlAuthorizeUrl,
} from "../utils/google-saml-account-chooser.ts";
import { createLogger } from "../utils/logger.ts";
import type { Response } from "express";

const log = createLogger("saml");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
export const SAML_STATE_COOKIE = "saml_state";

interface SamlStatePayload {
  nonce: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

let samlInstancePromise: Promise<SAML> | null = null;
let spCertFingerprint: string | null = null;

function signSamlState(payload: SamlStatePayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "10m" });
}

function verifySamlState(token: string | undefined): SamlStatePayload | null {
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET) as SamlStatePayload;
  } catch {
    return null;
  }
}

function getSamlStateCookieOptions() {
  const useSecureCookies = getSamlAcsUrl().startsWith("https://");
  return {
    httpOnly: true,
    secure: useSecureCookies,
    sameSite: useSecureCookies ? ("none" as const) : ("lax" as const),
    maxAge: 10 * 60 * 1000,
    path: "/",
  };
}

async function getSamlInstance(): Promise<SAML> {
  assertSamlConfigured();
  if (!samlInstancePromise) {
    samlInstancePromise = (async () => {
      const metadataXml = decodeSamlIdpMetadata()!;
      const idp = parseIdpMetadata(metadataXml);
      const spCert = await loadOrCreateSpCert(getSamlSpCertDir());
      spCertFingerprint = spCert.fingerprint;
      const isGoogle = getSamlProviderName().trim().toLowerCase() === "google";

      return new SAML({
        entryPoint: idp.entryPoint,
        idpIssuer: idp.idpIssuer,
        idpCert: idp.idpCert,
        issuer: getSamlSpEntityId(),
        callbackUrl: getSamlAcsUrl(),
        publicCert: spCert.cert,
        privateKey: spCert.key,
        wantAuthnResponseSigned: isGoogle ? false : true,
        wantAssertionsSigned: isGoogle ? false : true,
        disableRequestedAuthnContext: isGoogle,
        validateInResponseTo: ValidateInResponseTo.ifPresent,
        identifierFormat: "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
        acceptedClockSkewMs: 5000,
        audience: getSamlSpEntityId(),
        signatureAlgorithm: "sha256",
      });
    })();
  }
  return samlInstancePromise;
}

function readAttribute(profile: Profile, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = profile[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function extractSamlClaims(profile: Profile) {
  const nameId = profile.nameID?.trim();
  if (!nameId) {
    throw new Error("SAML provider did not return a NameID");
  }

  const emailFromNameId = EMAIL_PATTERN.test(nameId) ? nameId.toLowerCase() : undefined;
  const email =
    emailFromNameId ??
    readAttribute(
      profile,
      "email",
      "mail",
      "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
      "urn:oid:0.9.2342.19200300.100.1.3",
    )?.toLowerCase();

  if (!email) {
    log.warn("SAML profile missing email", { nameID: nameId });
    throw new Error("SAML provider did not return an email address");
  }

  const firstName = readAttribute(
    profile,
    "firstName",
    "givenName",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname",
  );
  const lastName = readAttribute(
    profile,
    "lastName",
    "surname",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname",
  );
  const displayName = readAttribute(
    profile,
    "displayName",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name",
  );
  const nameParts = [firstName, lastName].filter(Boolean);
  const name = displayName ?? (nameParts.length > 0 ? nameParts.join(" ") : undefined);

  return {
    providerUserId: nameId,
    email,
    name,
  };
}

export const samlAuthService = {
  async getMetadata(): Promise<string> {
    const saml = await getSamlInstance();
    const spCert = await loadOrCreateSpCert(getSamlSpCertDir());
    return saml.generateServiceProviderMetadata(null, spCert.cert);
  },

  async startLogin(res: Response): Promise<void> {
    const saml = await getSamlInstance();
    const entityId = getSamlSpEntityId();
    log.info("SAML login started", { entityId, acsUrl: getSamlAcsUrl() });

    const signedState = signSamlState({ nonce: crypto.randomUUID() });
    let authorizeUrl = await saml.getAuthorizeUrlAsync("", undefined, {});

    if (shouldUseGoogleAccountChooser()) {
      authorizeUrl = wrapGoogleSamlAuthorizeUrl(authorizeUrl);
      log.debug("SAML using Google Account Chooser", { entityId });
    }

    res.cookie(SAML_STATE_COOKIE, signedState, getSamlStateCookieOptions());

    log.debug("SAML redirecting to IdP");
    res.redirect(authorizeUrl);
  },

  async handleAcs(
    body: Record<string, string>,
    stateCookie: string | undefined,
  ): Promise<string> {
    const saml = await getSamlInstance();
    const normalizedBody = normalizeSamlPostBody(body);
    const state = verifySamlState(stateCookie);

    log.debug("SAML ACS received", {
      hasStateCookie: Boolean(stateCookie),
      idpInitiated: !state,
    });

    let profile;
    try {
      ({ profile } = await saml.validatePostResponseAsync(normalizedBody));
    } catch (error) {
      log.error("SAML assertion validation failed", error instanceof Error ? error : undefined, {
        hasStateCookie: Boolean(stateCookie),
      });
      throw error;
    }

    if (!profile) {
      throw new Error("SAML provider did not return a valid assertion");
    }

    const claims = extractSamlClaims(profile);
    const user = await resolveUserFromSsoClaims(
      {
        provider: "saml",
        providerUserId: claims.providerUserId,
        providerDisplayName: getSamlProviderName(),
        email: claims.email,
        name: claims.name,
      },
    );

    if (!user.isActive || user.isSuspended) {
      log.warn("SAML sign-in rejected for inactive account", {
        userId: user.id,
        isActive: user.isActive,
        isSuspended: user.isSuspended,
      });
      throw new Error("Account is not available for sign-in");
    }

    const exchangeCode = await createExchangeCode(user.id);
    log.info("SAML ACS succeeded, exchange code issued", {
      userId: user.id,
      providerUserId: claims.providerUserId,
    });

    return `${getAppUrl()}/login/saml/callback?code=${encodeURIComponent(exchangeCode)}`;
  },

  async logStartupStatus(): Promise<void> {
    if (getAuthProtocol() !== "saml") {
      log.debug("SAML not active for this deployment");
      return;
    }

    if (!isSamlConfigured()) {
      log.warn("SAML enabled but incomplete — check SAML_IDP_METADATA");
      return;
    }

    try {
      await getSamlInstance();
      log.info("SAML enabled", {
        entityId: getSamlSpEntityId(),
        acsUrl: getSamlAcsUrl(),
        providerName: getSamlProviderName(),
        spCertFingerprint,
      });
    } catch (error) {
      log.error(
        "SAML configuration invalid",
        error instanceof Error ? error : undefined,
      );
    }
  },
};
