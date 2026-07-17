/*
 * @heybray/scenarios-client — the Scenarios roleplay domain as a mountable
 * client feature package (Phase 6A). Exports the app's routes, admin-panel
 * registration, and content-path builder. The standalone shell (client/)
 * renders these inside its auth/provider chrome; the premium shell mounts this
 * alongside other feature packages.
 */
import type { ComponentType } from "react";
import HomePage from "./pages/HomePage";
import ScenarioSearchPage from "./pages/ScenarioSearchPage";
import RoleplayIntroPage from "./pages/RoleplayIntroPage";
import RoleplayTaking from "./pages/RoleplayTaking";
import RoleplayResults from "./pages/RoleplayResults";
import RoleplayAttemptsPage from "./pages/RoleplayAttemptsPage";
import TeamStarMapPage from "./pages/TeamStarMapPage";
import { registerAdminPanels } from "./admin-panels";

/** A protected app route. Rendered by the shell inside <ProtectedRoute>. */
export interface ScenariosRoute {
  path: string;
  component: ComponentType;
  /** Permission required to view the route, if any (else any authenticated user). */
  permission?: string;
}

/**
 * The app's protected routes, in match order. Public/auth routes (login,
 * register, OIDC/SAML callbacks) and the 404 fallback remain shell-owned.
 */
const routes: ScenariosRoute[] = [
  { path: "/search", component: ScenarioSearchPage },
  { path: "/", component: HomePage },
  { path: "/roleplays/:id", component: RoleplayIntroPage },
  { path: "/roleplays/:id/take", component: RoleplayTaking },
  { path: "/roleplays/:id/results/:attemptId", component: RoleplayResults },
  { path: "/team-star-map", component: TeamStarMapPage },
  { path: "/roleplays/:id/attempts", component: RoleplayAttemptsPage, permission: "roleplay:manage" },
];

/** The mountable Scenarios client module. */
export const scenariosApp = {
  routes,
  registerAdminPanels,
  contentPath: (_contentType: string, contentId: number): string => `/roleplays/${contentId}`,
};

export { registerAdminPanels };
