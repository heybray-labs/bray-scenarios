/**
 * Normalize a SAML ACS POST body after express.urlencoded parsing.
 * Form parsers decode '+' as space, which corrupts base64 SAMLResponse values
 * and causes "Invalid signature" even when Google signed correctly.
 */
export function normalizeSamlPostBody(body: Record<string, string>): Record<string, string> {
  const normalized = { ...body };

  if (typeof normalized.SAMLResponse === "string") {
    normalized.SAMLResponse = normalized.SAMLResponse.replace(/ /g, "+");
  }

  return normalized;
}
