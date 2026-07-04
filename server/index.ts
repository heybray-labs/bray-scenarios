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
import { ensureMediaDir } from "./services/media.service.ts";
import { initializeDatabase } from "./init-db/init-db.ts";
import { logger } from "./utils/logger.ts";
import { requestLogging } from "./middleware/request-logging.ts";
import { globalRateLimiter } from "./middleware/rate-limit.ts";
import {
  getAuthConfigurationError,
  getAuthProtocol,
  getOidcProviderName,
  getSamlProviderName,
  type AuthProtocol,
} from "./config/auth-config.ts";
import { getAppVersion } from "./utils/app-version.ts";
import { oidcAuthService } from "./services/oidc-auth.service.ts";
import { samlAuthService } from "./services/saml-auth.service.ts";

const app = express();
const PORT = parseInt(process.env.PORT || "3001", 10);

// Required for correct client IP (and per-IP rate limits) behind a reverse proxy.
if (process.env.TRUST_PROXY === "1" || process.env.TRUST_PROXY === "true") {
  app.set("trust proxy", 1);
}

// Auth is Bearer JWT (Authorization header), not cookie sessions. Cookies are
// only used for OIDC/SAML state binding and are read on those routes only —
// no global cookie-parser, so CSRF middleware is not required for API routes.
const allowedOrigins = new Set(
  [process.env.APP_URL, process.env.CORS_ORIGINS]
    .flatMap((value) => (value ?? "").split(","))
    .map((origin) => origin.trim())
    .filter(Boolean),
);
app.use(
  cors({
    origin(origin, callback) {
      // Non-browser clients and same-origin requests omit Origin.
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
  }),
);
app.use(express.json());
app.use(globalRateLimiter);
app.use(requestLogging);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

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

const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../client/dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

async function start() {
  try {
    const authConfigError = getAuthConfigurationError();
    if (authConfigError) {
      logger.error("Authentication configuration error", undefined, { message: authConfigError });
    }
    await initializeDatabase();
    ensureMediaDir();
    oidcAuthService.logStartupStatus();
    await samlAuthService.logStartupStatus();
    app.listen(PORT, () => {
      logger.info(`Server listening on http://localhost:${PORT}`);
    });
  } catch (error) {
    logger.error("Failed to start server", error instanceof Error ? error : undefined);
    process.exit(1);
  }
}

start();
