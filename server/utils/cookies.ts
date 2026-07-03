import type { Request } from "express";

/**
 * Read a single cookie from the Cookie header.
 *
 * Used only for OIDC/SAML state binding during SSO redirects — not for session
 * authentication. API auth uses Bearer JWTs in the Authorization header, so
 * classic cookie-session CSRF does not apply to application routes.
 */
export function getRequestCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;

  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    if (key !== name) continue;
    const value = part.slice(idx + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return undefined;
}
