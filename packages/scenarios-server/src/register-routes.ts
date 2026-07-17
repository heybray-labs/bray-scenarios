import express, { Router } from "express";
import { registerDomainRoutes, type ScenariosServerDeps } from "./register-domain-routes.ts";
import teamStarMapRoutes from "./routes/team-star-map.ts";
import {
  MANAGE_PERMISSION,
  MASTERY_DIMENSION_SLUG,
  SCENARIO_CONTENT_TYPE,
} from "./gamification.ts";
import { createTaxonomyRouter } from "@heybray/taxonomy";
import { createGamificationRouter } from "@heybray/gamification";
import { requireFeature } from "@heybray/server-kit";
import { createMediaRouter } from "@heybray/media";
import {
  teamsRouter,
  authenticateToken,
  requirePasswordChanged,
  requirePermission,
  setManagePermission,
} from "@heybray/identity";

export type { ScenariosServerDeps };

/**
 * Mounts every Scenarios-domain route onto the given Express app: the roleplay
 * CRUD/attempt/config routes plus the platform routers this app configures with
 * its own content type and manage-permission (media, taxonomy, gamification,
 * team star map). The shell keeps the generic identity surfaces (auth, users,
 * features) and all app-agnostic middleware.
 */
export function registerRoutes(
  app: express.Application,
  _deps: ScenariosServerDeps = {},
): void {
  // Inject the app's manage-permission string into the identity team controller.
  setManagePermission(MANAGE_PERMISSION);

  registerDomainRoutes(app, _deps);
  app.use(
    "/api/media",
    createMediaRouter({
      authenticateToken,
      requirePasswordChanged,
      requireManage: requirePermission(MANAGE_PERMISSION),
    }),
  );
  app.use(
    "/api/roleplay-classifications",
    createTaxonomyRouter({ managePermission: MANAGE_PERMISSION }),
  );
  app.use(
    "/api/points",
    createGamificationRouter(
      {
        contentTypes: [{ type: SCENARIO_CONTENT_TYPE, label: "Scenario" }],
        masteryDimensionSlug: MASTERY_DIMENSION_SLUG,
        managePermission: MANAGE_PERMISSION,
      },
      {
        // Real, permanent EntitlementProvider usage (Phase 3 Step 6): gates the
        // one route the client's leaderboard panel also gates via <FeatureGate>.
        // createGamificationRouter runs authenticateToken/requirePasswordChanged
        // ahead of this, so an unauthenticated caller still gets 401 (not a 403
        // that leaks feature state), and RequestContext.userId is populated.
        leaderboardMiddleware: [requireFeature("leaderboard")],
      },
    ),
  );

  // Both team routers share the same auth chain; apply it once here rather than
  // twice (each sub-router previously ran authenticateToken + requirePasswordChanged
  // independently, double-running the user lookup on star-map paths).
  const teamsRoot = Router();
  teamsRoot.use(authenticateToken);
  teamsRoot.use(requirePasswordChanged);
  teamsRoot.use(teamsRouter);
  teamsRoot.use(teamStarMapRoutes);
  app.use("/api/teams", teamsRoot);
}
