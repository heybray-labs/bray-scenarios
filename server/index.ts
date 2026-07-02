import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import authRoutes from "./routes/authentication.ts";
import roleplayRoutes from "./routes/roleplays.ts";
import roleplayConfigRoutes from "./routes/roleplay-config.ts";
import userRoutes from "./routes/users.ts";
import { initializeDatabase } from "./init-db/init-db.ts";
import { logger } from "./utils/logger.ts";
import { requestLogging } from "./middleware/request-logging.ts";
import { getAuthConfigurationError } from "./config/auth-config.ts";
import { oidcAuthService } from "./services/oidc-auth.service.ts";
import { samlAuthService } from "./services/saml-auth.service.ts";

const app = express();
const PORT = parseInt(process.env.PORT || "3001", 10);

app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json());
app.use(requestLogging);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/roleplays", roleplayRoutes);
app.use("/api/roleplay-config", roleplayConfigRoutes);
app.use("/api/users", userRoutes);

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
