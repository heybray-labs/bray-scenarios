import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Toaster } from "@heybray/ui/components/toaster";
import { AppErrorBoundary, PageNotFoundScreen } from "@/components/errors";
import ScenarioSearchPage from "@/pages/ScenarioSearchPage";
import HomePage from "@/pages/HomePage";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import OidcCallbackPage from "@/pages/OidcCallbackPage";
import SamlCallbackPage from "@/pages/SamlCallbackPage";
import RoleplayIntroPage from "@/pages/RoleplayIntroPage";
import RoleplayTaking from "@/pages/RoleplayTaking";
import RoleplayResults from "@/pages/RoleplayResults";
import RoleplayAttemptsPage from "@/pages/RoleplayAttemptsPage";
import TeamStarMapPage from "@/pages/TeamStarMapPage";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppErrorBoundary>
          <Switch>
            <Route path="/login" component={LoginPage} />
            <Route path="/login/oidc/callback" component={OidcCallbackPage} />
            <Route path="/login/saml/callback" component={SamlCallbackPage} />
            <Route path="/register" component={RegisterPage} />
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
