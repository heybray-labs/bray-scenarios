/*
 * @heybray/scenarios-server — the Scenarios roleplay domain as a mountable
 * server feature package (Phase 6A). Exports the app's Drizzle schema, its
 * route-mounting function, gamification/permission config, projection
 * reconciliation, and seed helpers. The standalone shell (server/) composes
 * these into a runnable Express app + Postgres boot; the premium shell mounts
 * this alongside other feature packages.
 */
import {
  roleplays,
  roleplaySettings,
  roleplayPersonas,
  roleplayCriteria,
  roleplayAttempts,
  roleplayMessages,
  roleplayCriterionScores,
  homepageFeaturedScenarios,
} from "./schema/roleplay-core.ts";
import {
  roleplayAppConfig,
  roleplayProviderKeys,
  roleplayAllowedPersonaModels,
  roleplayAllowedGraderModels,
} from "./schema/agent/roleplay-app-config.ts";
import { registerRoutes, type ScenariosServerDeps } from "./register-routes.ts";
import {
  reconcileGamificationProjection,
  gamification,
  teamStarMap,
  SCENARIO_CONTENT_TYPE,
  MASTERY_DIMENSION_SLUG,
  MANAGE_PERMISSION,
} from "./gamification.ts";
import { roleplayMediaUsage } from "./media-usage.ts";
import { isCheatModeEnabled } from "./config/cheat-mode.ts";
import { seedDemo } from "./seed/seed-demo.ts";
import { seedClassifications, categoryLabelToSlug } from "./seed/seed-classifications.ts";
import { assertDatabaseConnection } from "./seed/assert-db-connection.ts";
import * as scenarioClassifications from "./lib/scenario-classifications.ts";

/** App-owned tables only. Composed into the full Drizzle schema by the shell's db.ts. */
export const scenariosSchema = {
  roleplays,
  roleplaySettings,
  roleplayPersonas,
  roleplayCriteria,
  roleplayAttempts,
  roleplayMessages,
  roleplayCriterionScores,
  homepageFeaturedScenarios,
  roleplayAppConfig,
  roleplayProviderKeys,
  roleplayAllowedPersonaModels,
  roleplayAllowedGraderModels,
};

/** The mountable Scenarios server module. */
export const scenariosModule = {
  schema: scenariosSchema,
  // Historical migrations remain hand-authored in the shell (server/drizzle),
  // which is the single migration source while this is an in-repo workspace
  // package. A package-owned binding-migrations folder is a Step 3 concern.
  migrationsDir: null as string | null,
  registerRoutes,
  gamification: {
    contentTypes: [
      {
        type: SCENARIO_CONTENT_TYPE,
        label: "Scenario",
        masteryDimensionSlug: MASTERY_DIMENSION_SLUG,
      },
    ],
  },
  managePermission: MANAGE_PERMISSION,
  reconcileProjection: reconcileGamificationProjection,
  seedDemo,
  seedClassifications,
};

export {
  registerRoutes,
  type ScenariosServerDeps,
  reconcileGamificationProjection,
  gamification,
  teamStarMap,
  roleplayMediaUsage,
  seedDemo,
  seedClassifications,
  categoryLabelToSlug,
  assertDatabaseConnection,
  isCheatModeEnabled,
  scenarioClassifications,
  SCENARIO_CONTENT_TYPE,
  MASTERY_DIMENSION_SLUG,
  MANAGE_PERMISSION,
};
