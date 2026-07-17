import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { scenariosModule } from "@heybray/scenarios-server";
import {
  requestLogging,
  globalRateLimiter,
  getAppVersion,
  tenantContextMiddleware,
  createFeaturesRouter,
} from "@heybray/server-kit";
import {
  authenticationRouter,
  usersRouter,
  authenticateToken,
  getAuthProtocol,
  getActiveAuthProvider,
} from "@heybray/identity";

export function createApp(): express.Application {
  const app = express();

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
  app.use("/api/users", usersRouter);

  // Mount the Scenarios domain: roleplays, roleplay-config, media, taxonomy,
  // gamification/points, and the team star map — configured with this app's
  // content type and manage permission.
  scenariosModule.registerRoutes(app);

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
