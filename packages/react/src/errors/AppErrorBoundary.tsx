import { Component, type ErrorInfo, type ReactNode } from "react";
import { useLocation } from "wouter";
import { isHttpError } from "../lib/http-error.ts";
import { HttpErrorScreen } from "./http-errors";
import { PageNotFoundScreen } from "./error-screens";

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  error: unknown;
};

class AppErrorBoundaryInner extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Application error", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) {
      return this.props.children;
    }

    if (isHttpError(error)) {
      if (error.status === 404) {
        return <PageNotFoundScreen />;
      }
      return <HttpErrorScreen status={error.status} />;
    }

    return <HttpErrorScreen status={500} />;
  }
}

export function AppErrorBoundary({ children }: AppErrorBoundaryProps) {
  const [location] = useLocation();
  return <AppErrorBoundaryInner key={location}>{children}</AppErrorBoundaryInner>;
}
