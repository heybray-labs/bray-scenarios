import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import authRoutes from "./routes/authentication.ts";
import roleplayRoutes from "./routes/roleplays.ts";
import roleplayConfigRoutes from "./routes/roleplay-config.ts";
import userRoutes from "./routes/users.ts";
import mediaRoutes from "./routes/media.ts";
import roleplayClassificationsRoutes from "./routes/roleplay-classifications.ts";
import pointsRoutes from "./routes/points.ts";
import teamsRoutes from "./routes/teams.ts";
import { requestLogging } from "./middleware/request-logging.ts";
import { globalRateLimiter } from "./middleware/rate-limit.ts";
import {
  getAuthProtocol,
  getOidcProviderName,
  getSamlProviderName,
  type AuthProtocol,
} from "./config/auth-config.ts";
import { getAppVersion } from "./utils/app-version.ts";

function getAuthProtocolLabel(protocol: AuthProtocol): string {
  switch (protocol) {
    case "local":
      return "Local sign-in";
    case "oidc":
      return getOidcProviderName();
    case "saml":
      return getSamlProviderName();
  }
}

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
  app.use("/api", globalRateLimiter);
  app.use(requestLogging);

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/about", (_req, res) => {
    const authProtocol = getAuthProtocol();
    res.json({
      version: getAppVersion(),
      authProtocol,
      authProtocolLabel: getAuthProtocolLabel(authProtocol),
    });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/roleplays", roleplayRoutes);
  app.use("/api/roleplay-config", roleplayConfigRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/media", mediaRoutes);
  app.use("/api/roleplay-classifications", roleplayClassificationsRoutes);
  app.use("/api/points", pointsRoutes);
  app.use("/api/teams", teamsRoutes);

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
