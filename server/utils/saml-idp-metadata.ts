export interface ParsedIdpMetadata {
  idpIssuer: string;
  entryPoint: string;
  idpCert: string | string[];
}

function formatPemCertificate(raw: string): string {
  const normalized = raw.replace(/\s/g, "");
  const lines = normalized.match(/.{1,64}/g) ?? [normalized];
  return `-----BEGIN CERTIFICATE-----\n${lines.join("\n")}\n-----END CERTIFICATE-----`;
}

export function parseIdpMetadata(xml: string): ParsedIdpMetadata {
  const entityIdMatch = xml.match(/\bentityID="([^"]+)"/);
  if (!entityIdMatch) {
    throw new Error("IdP metadata missing entityID");
  }

  const redirectSsoMatch = xml.match(
    /<(?:[\w-]+:)?SingleSignOnService\b[^>]*Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"[^>]*Location="([^"]+)"/,
  );
  const postSsoMatch = xml.match(
    /<(?:[\w-]+:)?SingleSignOnService\b[^>]*Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"[^>]*Location="([^"]+)"/,
  );
  const reverseRedirectMatch = xml.match(
    /<(?:[\w-]+:)?SingleSignOnService\b[^>]*Location="([^"]+)"[^>]*Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"/,
  );

  const entryPoint =
    redirectSsoMatch?.[1] ?? reverseRedirectMatch?.[1] ?? postSsoMatch?.[1];
  if (!entryPoint) {
    throw new Error("IdP metadata missing SingleSignOnService URL");
  }

  const certMatches = [...xml.matchAll(/<(?:[\w-]+:)?X509Certificate>([\s\S]*?)<\/(?:[\w-]+:)?X509Certificate>/g)];
  if (certMatches.length === 0) {
    throw new Error("IdP metadata missing X509Certificate");
  }

  const idpCerts = certMatches.map((match) => formatPemCertificate(match[1]));

  return {
    idpIssuer: entityIdMatch[1],
    entryPoint,
    idpCert: idpCerts.length === 1 ? idpCerts[0] : idpCerts,
  };
}
