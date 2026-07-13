import {
  getAuthProtocol,
  isOidcConfigured,
  isSamlConfigured,
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
