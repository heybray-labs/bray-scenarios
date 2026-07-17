import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@heybray/react/lib/queryClient";
import { AuthProvider } from "@heybray/react/hooks/use-auth";
import { AppConfigProvider, type AppConfig } from "@heybray/react/config";
import { ProtectedRoute } from "@heybray/react/components/ProtectedRoute";
import { Toaster } from "@heybray/ui/components/toaster";
import { AppErrorBoundary, PageNotFoundScreen } from "@heybray/react/errors";
import LoginPage from "@heybray/react/pages/LoginPage";
import RegisterPage from "@heybray/react/pages/RegisterPage";
import OidcCallbackPage from "@heybray/react/pages/OidcCallbackPage";
import SamlCallbackPage from "@heybray/react/pages/SamlCallbackPage";
import { scenariosApp } from "@heybray/scenarios-client";
import logo from "@heybray/scenarios-client/assets/logo.png";
import loginHeroImage from "@heybray/scenarios-client/assets/login-screen-image.png";

// Register the app's admin settings panels once, before render — same effect as
// the previous module-level `import "@/admin-panels"` side effect.
scenariosApp.registerAdminPanels();

const GITHUB_REPO_URL = "https://github.com/heybray-labs/bray-scenarios";

const appConfig: AppConfig = {
  displayName: "Scenarios",
  tagline:
    "AI roleplay training for practicing real-world conversations with rubric-based feedback",
  urls: {
    repo: GITHUB_REPO_URL,
    docs: `${GITHUB_REPO_URL}/tree/main/docs`,
    issues: `${GITHUB_REPO_URL}/issues`,
    releases: `${GITHUB_REPO_URL}/releases`,
  },
  routes: {
    contentPath: scenariosApp.contentPath,
  },
};

const authBranding = {
  logoSrc: logo,
  heroImageSrc: loginHeroImage,
};

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppConfigProvider value={appConfig}>
      <AuthProvider>
        <AppErrorBoundary>
          <Switch>
            <Route path="/login">{() => <LoginPage {...authBranding} />}</Route>
            <Route path="/login/oidc/callback" component={OidcCallbackPage} />
            <Route path="/login/saml/callback" component={SamlCallbackPage} />
            <Route path="/register">{() => <RegisterPage {...authBranding} />}</Route>
            {scenariosApp.routes.map(({ path, component: Component, permission }) => (
              <Route key={path} path={path}>
                <ProtectedRoute permission={permission}>
                  <Component />
                </ProtectedRoute>
              </Route>
            ))}
            <Route>
              <PageNotFoundScreen />
            </Route>
          </Switch>
        </AppErrorBoundary>
        <Toaster />
      </AuthProvider>
      </AppConfigProvider>
    </QueryClientProvider>
  );
}
