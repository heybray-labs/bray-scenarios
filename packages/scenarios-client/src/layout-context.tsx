import { createContext, useContext, type ReactNode } from "react";

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
  return (
    <LayoutContext.Provider value={{ usePackageLayout }}>{children}</LayoutContext.Provider>
  );
}

export function usePackageLayoutEnabled(): boolean {
  return useContext(LayoutContext).usePackageLayout;
}
