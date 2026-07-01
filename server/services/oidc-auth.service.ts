import * as client from "openid-client";
import jwt from "jsonwebtoken";
import {
  assertOidcConfigured,
  getAppUrl,
  getOidcClientId,
  getOidcClientSecret,
  getOidcIssuerUrl,
  getOidcProviderName,
  getOidcRedirectUri,
  getOidcScopes,
  getAuthProtocol,
  isOidcConfigured,
  resolveOidcDiscoveryUrl,
} from "../config/auth-config.ts";
import { createExchangeCode } from "./sso-exchange.service.ts";
import { resolveUserFromSsoClaims } from "./sso-user-resolution.service.ts";
import { createLogger } from "../utils/logger.ts";
import type { Response } from "express";

const log = createLogger("oidc");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
export const OIDC_STATE_COOKIE = "oidc_state";

interface OidcStatePayload {
  codeVerifier: string;
  state: string;
  nonce: string;
  tenantId: number;
}

interface OidcClaims {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
}

let oidcConfigPromise: Promise<client.Configuration> | null = null;

async function getOidcConfig(): Promise<client.Configuration> {
  assertOidcConfigured();
  if (!oidcConfigPromise) {
    const issuerUrl = getOidcIssuerUrl()!;
    const clientId = getOidcClientId()!;
    const clientSecret = getOidcClientSecret()!;
    const server = resolveOidcDiscoveryUrl(issuerUrl);

    log.debug("Discovering OIDC provider", { issuer: server.href, clientId });

    oidcConfigPromise = client
      .discovery(server, clientId, clientSecret)
      .then((config) => {
        log.info("OIDC provider discovered", { issuer: server.href });
        return config;
      })
      .catch((error) => {
        oidcConfigPromise = null;
        log.error(
          "OIDC provider discovery failed",
          error instanceof Error ? error : undefined,
          { issuer: server.href },
        );
        throw error;
      });
  }
  return oidcConfigPromise;
}

function signOidcState(payload: OidcStatePayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "10m" });
}

function verifyOidcState(token: string): OidcStatePayload {
  return jwt.verify(token, JWT_SECRET) as OidcStatePayload;
}

function extractClaims(tokenResponse: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers): OidcClaims {
  const claims = tokenResponse.claims();
  if (!claims?.sub) {
    log.warn("OIDC claims missing subject", { hasClaims: Boolean(claims) });
    throw new Error("OIDC provider did not return a subject identifier");
  }

  const email = typeof claims.email === "string" ? claims.email : undefined;
  if (!email) {
    log.warn("OIDC claims missing email", { sub: claims.sub });
    throw new Error("OIDC provider did not return an email address");
  }

  if (claims.email_verified === false) {
    log.warn("OIDC email not verified", { sub: claims.sub, email });
    throw new Error("OIDC provider has not verified this email address");
  }

  const name =
    typeof claims.name === "string"
      ? claims.name
      : typeof claims.given_name === "string"
        ? claims.given_name
        : undefined;

  log.debug("OIDC claims extracted", {
    sub: claims.sub,
    email: email.toLowerCase(),
    emailVerified: claims.email_verified ?? "unspecified",
  });

  return {
    sub: claims.sub,
    email: email.toLowerCase(),
    email_verified: claims.email_verified as boolean | undefined,
    name,
    given_name: typeof claims.given_name === "string" ? claims.given_name : undefined,
  };
}

export const oidcAuthService = {
  async startLogin(res: Response, tenantId: number): Promise<void> {
    const redirectUri = getOidcRedirectUri();
    log.info("OIDC login started", { tenantId, redirectUri });

    const config = await getOidcConfig();
    const codeVerifier = client.randomPKCECodeVerifier();
    const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
    const state = client.randomState();
    const nonce = client.randomNonce();

    const signedState = signOidcState({
      codeVerifier,
      state,
      nonce,
      tenantId,
    });

    const parameters: Record<string, string> = {
      redirect_uri: redirectUri,
      scope: getOidcScopes(),
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      state,
      nonce,
    };

    const redirectTo = client.buildAuthorizationUrl(config, parameters);
    log.debug("OIDC redirecting to provider", { tenantId, authorizationEndpoint: redirectTo.origin });

    res.cookie(OIDC_STATE_COOKIE, signedState, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 10 * 60 * 1000,
      path: "/",
    });

    res.redirect(redirectTo.href);
  },

  async handleCallback(callbackUrl: URL, stateCookie: string | undefined): Promise<string> {
    log.debug("OIDC callback received", {
      hasStateCookie: Boolean(stateCookie),
      hasCode: callbackUrl.searchParams.has("code"),
      hasError: callbackUrl.searchParams.has("error"),
    });

    if (!stateCookie) {
      log.warn("OIDC callback missing state cookie");
      throw new Error("OIDC session expired. Please try signing in again.");
    }

    let tenantId: number;
    let codeVerifier: string;
    let state: string;
    let nonce: string;

    try {
      ({ codeVerifier, state, nonce, tenantId } = verifyOidcState(stateCookie));
    } catch (error) {
      log.warn(
        "OIDC state cookie invalid or expired",
        error instanceof Error ? { errorMessage: error.message } : undefined,
      );
      throw new Error("OIDC session expired. Please try signing in again.");
    }

    const config = await getOidcConfig();

    let tokenResponse: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers;
    try {
      tokenResponse = await client.authorizationCodeGrant(config, callbackUrl, {
        pkceCodeVerifier: codeVerifier,
        expectedState: state,
        expectedNonce: nonce,
      });
    } catch (error) {
      log.error(
        "OIDC token exchange failed",
        error instanceof Error ? error : undefined,
        { tenantId },
      );
      throw error;
    }

    log.debug("OIDC token exchange succeeded", { tenantId });

    const claims = extractClaims(tokenResponse);
    const user = await resolveUserFromSsoClaims(
      {
        provider: "oidc",
        providerUserId: claims.sub,
        providerDisplayName: getOidcProviderName(),
        email: claims.email,
        name: claims.name,
      },
      tenantId,
    );

    if (!user.isActive || user.isSuspended) {
      log.warn("OIDC sign-in rejected for inactive account", {
        userId: user.id,
        tenantId,
        isActive: user.isActive,
        isSuspended: user.isSuspended,
      });
      throw new Error("Account is not available for sign-in");
    }

    const exchangeCode = await createExchangeCode(user.id, tenantId);
    log.info("OIDC callback succeeded, exchange code issued", {
      userId: user.id,
      tenantId,
      providerUserId: claims.sub,
    });

    return `${getAppUrl()}/login/oidc/callback?code=${encodeURIComponent(exchangeCode)}`;
  },

  logStartupStatus(): void {
    if (getAuthProtocol() !== "oidc") {
      log.debug("OIDC not active for this deployment");
      return;
    }

    if (!isOidcConfigured()) {
      log.warn("OIDC enabled but incomplete — check OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, OIDC_ISSUER_URL");
      return;
    }

    log.info("OIDC enabled", {
      issuer: getOidcIssuerUrl(),
      redirectUri: getOidcRedirectUri(),
      providerName: process.env.OIDC_PROVIDER_NAME || "SSO",
      scopes: getOidcScopes(),
    });
  },
};
