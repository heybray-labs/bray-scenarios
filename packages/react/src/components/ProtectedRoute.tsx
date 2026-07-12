import { useAuth } from "../hooks/use-auth.ts";
import { PermissionDeniedScreen } from "../errors/index.ts";
import { Redirect, useLocation } from "wouter";
import type { ReactNode } from "react";

export function ProtectedRoute({
  children,
  permission,
}: {
  children: ReactNode;
  permission?: string;
}) {
  const { isAuthenticated, isLoading, hasPermission, user } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to={`/login?redirect=${encodeURIComponent(location)}`} />;
  }

  if (user?.mustChangePassword) {
    return <Redirect to="/login" />;
  }

  if (permission && !hasPermission(permission)) {
    return <PermissionDeniedScreen />;
  }

  return <>{children}</>;
}
