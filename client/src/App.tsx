import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@heybray/react/lib/queryClient";
import { AuthProvider } from "@heybray/react/hooks/use-auth";
import { ProtectedRoute } from "@heybray/react/components/ProtectedRoute";
import { Toaster } from "@heybray/ui/components/toaster";
import { AppErrorBoundary, PageNotFoundScreen } from "@heybray/react/errors";
import LoginPage from "@heybray/react/pages/LoginPage";
import RegisterPage from "@heybray/react/pages/RegisterPage";
import OidcCallbackPage from "@heybray/react/pages/OidcCallbackPage";
import SamlCallbackPage from "@heybray/react/pages/SamlCallbackPage";
import ScenarioSearchPage from "@/pages/ScenarioSearchPage";
import HomePage from "@/pages/HomePage";
import RoleplayIntroPage from "@/pages/RoleplayIntroPage";
import RoleplayTaking from "@/pages/RoleplayTaking";
import RoleplayResults from "@/pages/RoleplayResults";
import RoleplayAttemptsPage from "@/pages/RoleplayAttemptsPage";
import TeamStarMapPage from "@/pages/TeamStarMapPage";
import { APPLICATION_DISPLAY_NAME } from "@/lib/app-config";
import logo from "@assets/logo.png";
import loginHeroImage from "@assets/login-screen-image.png";

const authBranding = {
  appName: APPLICATION_DISPLAY_NAME,
  logoSrc: logo,
  heroImageSrc: loginHeroImage,
};

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppErrorBoundary>
          <Switch>
            <Route path="/login">{() => <LoginPage {...authBranding} />}</Route>
            <Route path="/login/oidc/callback" component={OidcCallbackPage} />
            <Route path="/login/saml/callback" component={SamlCallbackPage} />
            <Route path="/register">{() => <RegisterPage {...authBranding} />}</Route>
            <Route path="/search">
              <ProtectedRoute>
                <ScenarioSearchPage />
              </ProtectedRoute>
            </Route>
            <Route path="/">
              <ProtectedRoute>
                <HomePage />
              </ProtectedRoute>
            </Route>
            <Route path="/roleplays/:id">
              <ProtectedRoute>
                <RoleplayIntroPage />
              </ProtectedRoute>
            </Route>
            <Route path="/roleplays/:id/take">
              <ProtectedRoute>
                <RoleplayTaking />
              </ProtectedRoute>
            </Route>
            <Route path="/roleplays/:id/results/:attemptId">
              <ProtectedRoute>
                <RoleplayResults />
              </ProtectedRoute>
            </Route>
            <Route path="/team-star-map">
              <ProtectedRoute>
                <TeamStarMapPage />
              </ProtectedRoute>
            </Route>
            <Route path="/roleplays/:id/attempts">
              <ProtectedRoute permission="roleplay:manage">
                <RoleplayAttemptsPage />
              </ProtectedRoute>
            </Route>
            <Route>
              <PageNotFoundScreen />
            </Route>
          </Switch>
        </AppErrorBoundary>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}
