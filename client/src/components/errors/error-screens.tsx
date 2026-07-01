import { BrandedErrorScreen } from "./BrandedErrorScreen";
import { HttpErrorScreen } from "./http-errors";

const HOME_ACTION = { label: "Back to Home", href: "/" } as const;

export function AuthUnavailableScreen() {
  return (
    <BrandedErrorScreen
      subtitle="Sign-in unavailable"
      description="Sign-in is not available right now. Please contact your administrator."
    />
  );
}

export function SignInFailedScreen() {
  return (
    <BrandedErrorScreen
      subtitle="Sign-in failed"
      description="We couldn't complete your sign-in. Please try again."
      action={{ label: "Back to sign in", href: "/login" }}
    />
  );
}

export function PermissionDeniedScreen() {
  return <HttpErrorScreen status={403} />;
}

export function NotFoundScreen({
  resource = "page",
  layout = "content",
}: {
  resource?: string;
  layout?: "page" | "content";
}) {
  return (
    <BrandedErrorScreen
      layout={layout}
      subtitle="404 - Not found"
      description={`The ${resource} you're looking for doesn't exist or may have been removed.`}
      action={HOME_ACTION}
    />
  );
}

export function PageNotFoundScreen() {
  return <HttpErrorScreen status={404} />;
}

export function InternalServerErrorScreen() {
  return <HttpErrorScreen status={500} />;
}

export function ServiceUnavailableScreen() {
  return <HttpErrorScreen status={503} />;
}
