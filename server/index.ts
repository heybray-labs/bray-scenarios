import { createApp } from "./app.ts";
import { ensureMediaDir } from "./services/media.service.ts";
import { initializeDatabase } from "./init-db/init-db.ts";
import { logger } from "./utils/logger.ts";
import { getAuthConfigurationError } from "./config/auth-config.ts";
import { oidcAuthService } from "./services/oidc-auth.service.ts";
import { samlAuthService } from "./services/saml-auth.service.ts";

const app = createApp();
const PORT = parseInt(process.env.PORT || "3001", 10);

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

if (process.env.NODE_ENV !== "test") {
  start();
}

export { app, createApp };
