import { getSamlProviderName } from "../auth-config.ts";

function isGoogleSamlProvider(): boolean {
  return getSamlProviderName().trim().toLowerCase() === "google";
}

export function shouldUseGoogleAccountChooser(): boolean {
  if (!isGoogleSamlProvider()) {
    return false;
  }

  const explicit = process.env.SAML_GOOGLE_ACCOUNT_CHOOSER?.trim().toLowerCase();
  if (explicit === "false" || explicit === "0") {
    return false;
  }

  return true;
}

export function wrapGoogleSamlAuthorizeUrl(authorizeUrl: string): string {
  const params = new URLSearchParams();
  params.set("continue", authorizeUrl);

  const hostedDomain = process.env.SAML_GOOGLE_HD?.trim();
  if (hostedDomain) {
    params.set("hd", hostedDomain);
  }

  return `https://accounts.google.com/AccountChooser?${params.toString()}`;
}
