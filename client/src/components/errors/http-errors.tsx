import { BrandedErrorScreen } from "./BrandedErrorScreen";
import type { BrandedErrorScreenProps } from "./BrandedErrorScreen";

const HOME_ACTION = { label: "Back to Home", href: "/" } as const;

type HttpErrorContent = {
  subtitle: string;
  description: string;
  action?: BrandedErrorScreenProps["action"];
};

export const HTTP_ERROR_CONTENT: Record<number, HttpErrorContent> = {
  400: {
    subtitle: "400 - Bad request",
    description: "The request could not be understood. Please try again.",
    action: HOME_ACTION,
  },
  403: {
    subtitle: "403 - Forbidden",
    description: "You don't have permission to access this resource.",
    action: HOME_ACTION,
  },
  404: {
    subtitle: "404 - Page not found",
    description: "The page you're looking for doesn't exist or may have been removed.",
    action: HOME_ACTION,
  },
  500: {
    subtitle: "500 - Internal server error",
    description:
      "The server encountered an unexpected condition that prevented it from fulfilling the request. Please contact your administrator if the issue persists.",
    action: HOME_ACTION,
  },
  502: {
    subtitle: "502 - Bad gateway",
    description: "The server received an invalid response. Please try again later.",
    action: HOME_ACTION,
  },
  503: {
    subtitle: "503 - Service unavailable",
    description: "The service is temporarily unavailable. Please try again later.",
    action: HOME_ACTION,
  },
  504: {
    subtitle: "504 - Gateway timeout",
    description: "The server took too long to respond. Please try again later.",
    action: HOME_ACTION,
  },
};

export function getHttpErrorContent(status: number): HttpErrorContent {
  if (HTTP_ERROR_CONTENT[status]) {
    return HTTP_ERROR_CONTENT[status];
  }

  if (status >= 500) {
    return HTTP_ERROR_CONTENT[500];
  }

  if (status >= 400) {
    return {
      subtitle: `${status} - Request failed`,
      description: "We couldn't complete your request. Please try again.",
      action: HOME_ACTION,
    };
  }

  return HTTP_ERROR_CONTENT[500];
}

export function HttpErrorScreen({
  status,
  layout = "page",
}: {
  status: number;
  layout?: "page" | "content";
}) {
  const { subtitle, description, action } = getHttpErrorContent(status);

  return (
    <BrandedErrorScreen
      layout={layout}
      subtitle={subtitle}
      description={description}
      action={action}
    />
  );
}
