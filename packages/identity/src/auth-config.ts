export type AuthProtocol = "local" | "oidc" | "saml";

export function getAuthProtocol(): AuthProtocol {
  const explicit = process.env.AUTH_PROTOCOL?.trim().toLowerCase();
  if (explicit === "local" || explicit === "oidc" || explicit === "saml") {
    return explicit;
  }
  return "local";
}

export function isSsoEnabled(): boolean {
  const protocol = getAuthProtocol();
  return protocol === "oidc" || protocol === "saml";
}

export function isOidcEnabled(): boolean {
  return getAuthProtocol() === "oidc";
}

export function isSamlEnabled(): boolean {
  return getAuthProtocol() === "saml";
}

export function getOidcProviderName(): string {
  const name = process.env.OIDC_PROVIDER_NAME?.trim();
  return name || "SSO";
}

export function getSamlProviderName(): string {
  const name = process.env.SAML_PROVIDER_NAME?.trim();
  return name || "SSO";
}

export function getOidcScopes(): string {
  return process.env.OIDC_SCOPES || "openid email profile";
}

export function getAppUrl(): string {
  const url = process.env.APP_URL || "http://localhost:5173";
  return url.replace(/\/$/, "");
}

export function getApiBaseUrl(): string {
  if (process.env.API_URL) {
    return process.env.API_URL.replace(/\/$/, "");
  }
  const port = process.env.PORT || "3001";
  return `http://localhost:${port}`;
}

export function getOidcRedirectUri(): string {
  if (process.env.OIDC_REDIRECT_URI) {
    return process.env.OIDC_REDIRECT_URI;
  }
  if (process.env.APP_URL) {
    return `${getAppUrl()}/api/auth/oidc/callback`;
  }
  return `${getApiBaseUrl()}/api/auth/oidc/callback`;
}

export function getOidcIssuerUrl(): string | null {
  const url = process.env.OIDC_ISSUER_URL?.trim();
  return url || null;
}

export function getOidcClientId(): string | null {
  const id = process.env.OIDC_CLIENT_ID?.trim();
  return id || null;
}

export function getOidcClientSecret(): string | null {
  const secret = process.env.OIDC_CLIENT_SECRET?.trim();
  return secret || null;
}

export function isOidcConfigured(): boolean {
  return Boolean(
    getAuthProtocol() === "oidc" &&
      getOidcIssuerUrl() &&
      getOidcClientId() &&
      getOidcClientSecret(),
  );
}

export function decodeSamlIdpMetadata(): string | null {
  const raw = process.env.SAML_IDP_METADATA?.trim();
  if (!raw) return null;

  try {
    const decoded = Buffer.from(raw, "base64").toString("utf-8");
    if (decoded.includes("EntityDescriptor") || decoded.includes("EntitiesDescriptor")) {
      return decoded;
    }
  } catch {
    // fall through to raw XML
  }

  if (raw.includes("EntityDescriptor") || raw.includes("EntitiesDescriptor")) {
    return raw;
  }

  return null;
}

export function getSamlSpEntityId(): string {
  const entityId = process.env.SAML_SP_ENTITY_ID?.trim();
  return entityId || `${getAppUrl()}/api/auth/saml/metadata`;
}

export function getSamlAcsUrl(): string {
  const acsUrl = process.env.SAML_ACS_URL?.trim();
  return acsUrl || `${getAppUrl()}/api/auth/saml/acs`;
}

export function getSamlSpCertDir(): string {
  return process.env.SAML_SP_CERT_DIR?.trim() || "data/saml";
}

export function isSamlConfigured(): boolean {
  const metadata = decodeSamlIdpMetadata();
  return Boolean(getAuthProtocol() === "saml" && metadata);
}

export function getAuthConfigurationError(): string | null {
  const protocol = getAuthProtocol();

  if (protocol === "oidc" && !isOidcConfigured()) {
    return "AUTH_PROTOCOL=oidc but OIDC is incomplete — set OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, OIDC_ISSUER_URL";
  }

  if (protocol === "saml" && !decodeSamlIdpMetadata()) {
    return "AUTH_PROTOCOL=saml but SAML_IDP_METADATA is missing or invalid — provide base64-encoded IdP metadata XML";
  }

  return null;
}

export function assertOidcConfigured(): void {
  if (!isOidcConfigured()) {
    throw new Error("OIDC is not configured");
  }
}

export function assertSamlConfigured(): void {
  if (!isSamlConfigured()) {
    throw new Error("SAML is not configured");
  }
}

export function validateAuthConfig(): void {
  const error = getAuthConfigurationError();
  if (error) {
    throw new Error(error);
  }
}

export function resolveOidcDiscoveryUrl(issuerUrl: string): URL {
  if (issuerUrl.includes("/.well-known/openid-configuration")) {
    return new URL(issuerUrl.replace("/.well-known/openid-configuration", ""));
  }
  return new URL(issuerUrl);
}
