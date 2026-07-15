import express, { Router } from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import roleplayRoutes from "./routes/roleplays.ts";
import roleplayConfigRoutes from "./routes/roleplay-config.ts";
import { createTaxonomyRouter } from "@heybray/taxonomy";
import { createGamificationRouter } from "@heybray/gamification";
import teamStarMapRoutes from "./routes/team-star-map.ts";
import {
  MANAGE_PERMISSION,
  MASTERY_DIMENSION_SLUG,
  SCENARIO_CONTENT_TYPE,
} from "./gamification.ts";
import {
  requestLogging,
  globalRateLimiter,
  getAppVersion,
  tenantContextMiddleware,
  createFeaturesRouter,
  requireFeature,
} from "@heybray/server-kit";
import { createMediaRouter } from "@heybray/media";
import {
  authenticationRouter,
  usersRouter,
  teamsRouter,
  authenticateToken,
  requirePasswordChanged,
  requirePermission,
  setManagePermission,
  getAuthProtocol,
  getActiveAuthProvider,
} from "@heybray/identity";

export function createApp(): express.Application {
  const app = express();

  // Inject the app's manage-permission string into the identity team controller.
  setManagePermission(MANAGE_PERMISSION);

  if (process.env.TRUST_PROXY === "1" || process.env.TRUST_PROXY === "true") {
    app.set("trust proxy", 1);
  }

  const allowedOrigins = new Set(
    [process.env.APP_URL, process.env.CORS_ORIGINS]
      .flatMap((value) => (value ?? "").split(","))
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.has(origin)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
    }),
  );
  app.use(express.json());
  app.use(tenantContextMiddleware());
  app.use("/api", globalRateLimiter);
  app.use(requestLogging);

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/about", (_req, res) => {
    const authProtocol = getAuthProtocol();
    const rootPackageJson = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../package.json",
    );
    res.json({
      version: getAppVersion(rootPackageJson),
      authProtocol,
      authProtocolLabel: getActiveAuthProvider().label,
    });
  });

  app.use("/api/auth", authenticationRouter);
  app.use("/api/features", authenticateToken, createFeaturesRouter());
  app.use("/api/roleplays", roleplayRoutes);
  app.use("/api/roleplay-config", roleplayConfigRoutes);
  app.use("/api/users", usersRouter);
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

  if (process.env.NODE_ENV !== "test") {
    const clientDist = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../client/dist",
    );
    if (fs.existsSync(clientDist)) {
      app.use(express.static(clientDist));
      app.get("*", (req, res, next) => {
        if (req.path.startsWith("/api")) return next();
        res.sendFile(path.join(clientDist, "index.html"));
      });
    }
  }

  return app;
}
