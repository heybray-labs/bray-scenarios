import { createContext, useContext, type ReactNode } from "react";

export interface AppConfigUrls {
  repo: string;
  docs?: string;
  issues?: string;
  releases?: string;
}

/**
 * Whitelabel seam: the small set of brand-level text/links a host app supplies.
 * Assets (logo, hero image) are passed as props where needed since they are
 * bundler-resolved imports rather than plain config values.
 */
export interface AppConfig {
  displayName: string;
  tagline?: string;
  urls: AppConfigUrls;
}

const AppConfigContext = createContext<AppConfig | null>(null);

export function AppConfigProvider({
  value,
  children,
}: {
  value: AppConfig;
  children: ReactNode;
}) {
  return <AppConfigContext.Provider value={value}>{children}</AppConfigContext.Provider>;
}

export function useAppConfig(): AppConfig {
  const config = useContext(AppConfigContext);
  if (!config) {
    throw new Error("useAppConfig must be used within an AppConfigProvider");
  }
  return config;
}
