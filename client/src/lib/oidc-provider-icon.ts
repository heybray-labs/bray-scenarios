const PROVIDER_ICON_FILES = new Set(["google", "okta", "microsoft"]);

export function getOidcProviderIcon(providerName: string): string | null {
  const filename = providerName.trim().toLowerCase();
  if (!PROVIDER_ICON_FILES.has(filename)) return null;
  return new URL(`../assets/${filename}.svg`, import.meta.url).href;
}
