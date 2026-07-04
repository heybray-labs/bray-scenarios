import { Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { AppBrandTitle } from "@/components/AppBrandTitle";
import {
  APPLICATION_DISPLAY_NAME,
  APPLICATION_TAGLINE,
  GITHUB_DOCS_URL,
  GITHUB_ISSUES_URL,
  GITHUB_RELEASES_URL,
  GITHUB_REPO_URL,
} from "@/lib/app-config";
import { apiRequest } from "@/lib/queryClient";
import logo from "@assets/logo.png";

type AboutResponse = {
  version: string;
  authProtocol: "local" | "oidc" | "saml";
  authProtocolLabel: string;
};

const LINKS = [
  { label: "GitHub", href: GITHUB_REPO_URL },
  { label: "Documentation", href: GITHUB_DOCS_URL },
  { label: "Report issue", href: GITHUB_ISSUES_URL },
  { label: "Release notes", href: GITHUB_RELEASES_URL },
] as const;

export function AboutPanel() {
  const { data } = useQuery<AboutResponse>({
    queryKey: ["/api/about"],
    queryFn: () => apiRequest("GET", "/api/about") as Promise<AboutResponse>,
    staleTime: Infinity,
  });

  const version = data?.version ?? __APP_VERSION__;

  return (
    <div className="flex flex-col items-center gap-6 py-4 text-center">
      <div className="flex flex-col items-center gap-3">
        <img src={logo} alt="" className="h-12 w-12" />
        <AppBrandTitle appName={APPLICATION_DISPLAY_NAME} size="large" />
        <p className="max-w-md text-sm text-muted-foreground">{APPLICATION_TAGLINE}</p>
      </div>

      <div className="space-y-1 text-sm">
        <p>
          <span className="text-muted-foreground">Version </span>
          <span className="font-medium">v{version}</span>
        </p>
        {data?.authProtocolLabel && (
          <p>
            <span className="text-muted-foreground">Auth: </span>
            <span className="font-medium">{data.authProtocolLabel}</span>
          </p>
        )}
      </div>

      <nav className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm">
        {LINKS.map((link, index) => (
          <Fragment key={link.href}>
            {index > 0 && <span className="text-muted-foreground" aria-hidden="true">·</span>}
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              {link.label}
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          </Fragment>
        ))}
      </nav>

      <div className="space-y-1 text-xs text-muted-foreground">
        <p>© {new Date().getFullYear()} HeyBray Labs</p>
        <p>License not yet specified</p>
        <p>Standalone deployment of the roleplay feature from the Bray platform</p>
      </div>
    </div>
  );
}
