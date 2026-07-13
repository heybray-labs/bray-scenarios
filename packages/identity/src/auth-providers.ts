import {
  getAuthProtocol,
  getAuthConfigurationError,
  isOidcConfigured,
  isSamlConfigured,
  isSsoEnabled,
  getOidcProviderName,
  getSamlProviderName,
  type AuthProtocol,
} from "./auth-config.ts";

/**
 * Unifies protocol discovery (label/configured-state) used by `/api/about`
 * and `/api/auth/config` into one registry. Does not split the existing
 * single-file route handler (`routes/authentication.ts`) into per-provider
 * route modules — that's deferred; see docs/phase-3-implementation.md's
 * "Two deliberate scope reductions".
 */
export interface AuthProviderDescriptor {
  name: AuthProtocol;
  label: string;
  icon?: string;
  isConfigured(): boolean;
}

/** Built-in registry seeded from the existing auth-config.ts helpers. */
export function getAuthProviders(): AuthProviderDescriptor[] {
  return [
    { name: "local", label: "Local sign-in", isConfigured: () => true },
    { name: "oidc", label: getOidcProviderName(), isConfigured: () => isOidcConfigured() },
    { name: "saml", label: getSamlProviderName(), isConfigured: () => isSamlConfigured() },
  ];
}

export function getActiveAuthProvider(): AuthProviderDescriptor {
  const protocol = getAuthProtocol();
  return getAuthProviders().find((provider) => provider.name === protocol)!;
}

/**
 * Lives here (not auth-config.ts) so the dependency only runs one way:
 * this module imports auth-config.ts's primitives, never the reverse. Moved
 * out of auth-config.ts during the Phase 3 remediation pass — it used to
 * import getAuthProviders() back from here, which was a real (if currently
 * harmless) circular import between the two modules.
 */
export function getPublicAuthConfig() {
  const protocol = getAuthProtocol();
  const providers = getAuthProviders();
  const oidcProvider = providers.find((p) => p.name === "oidc")!;
  const samlProvider = providers.find((p) => p.name === "saml")!;
  const oidcReady = oidcProvider.isConfigured();
  const samlReady = samlProvider.isConfigured();
  const ssoEnabled = oidcReady || samlReady;
  const providerName = protocol === "saml" ? samlProvider.label : oidcProvider.label;
  const loginUrl = protocol === "saml" ? "/api/auth/saml/login" : "/api/auth/oidc/login";

  return {
    protocol,
    misconfigured: getAuthConfigurationError() !== null,
    sso: {
      enabled: ssoEnabled,
      providerName,
      loginUrl,
    },
    oidc: {
      enabled: oidcReady,
      providerName: oidcProvider.label,
      loginUrl: "/api/auth/oidc/login",
    },
    localRegistration: !isSsoEnabled(),
  };
}
