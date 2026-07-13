import { createApp } from "./app.ts";
import { ensureMediaDir } from "@heybray/server-kit";
import { initializeDatabase } from "./init-db/init-db.ts";
import { logger } from "@heybray/server-kit";
import {
  getAuthConfigurationError,
  oidcAuthService,
  samlAuthService,
} from "@heybray/identity";
import { isCheatModeEnabled } from "./config/cheat-mode.ts";
import { reconcileGamificationProjection } from "./gamification.ts";

const app = createApp();
const PORT = parseInt(process.env.PORT || "3001", 10);

async function start() {
  try {
    const authConfigError = getAuthConfigurationError();
    if (authConfigError) {
      logger.error("Authentication configuration error", undefined, { message: authConfigError });
    }
    await initializeDatabase();
    await reconcileGamificationProjection();
    ensureMediaDir();
    oidcAuthService.logStartupStatus();
    await samlAuthService.logStartupStatus();
    if (isCheatModeEnabled()) {
      logger.warn(
        "CHEAT_MODE is enabled — type CHEAT MODE: <desired outcome> in the conversation to skip persona turns and use fast synthetic grading",
      );
    }
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
