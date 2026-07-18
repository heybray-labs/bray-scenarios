import { createContext, useContext, useMemo, type ReactNode } from "react";

type LayoutContextValue = {
  /** When false, AppLayout renders children only (composed shells supply outer chrome). */
  usePackageLayout: boolean;
};

const LayoutContext = createContext<LayoutContextValue>({ usePackageLayout: true });

export function PackageLayoutProvider({
  usePackageLayout = true,
  children,
}: {
  usePackageLayout?: boolean;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ usePackageLayout }), [usePackageLayout]);
  return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>;
}

export function usePackageLayoutEnabled(): boolean {
  return useContext(LayoutContext).usePackageLayout;
}
