import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { users } from "../shared/schemas/users.ts";
import { roles } from "../shared/schemas/roles.ts";
import {
  roleplays,
  roleplaySettings,
  roleplayPersonas,
  roleplayCriteria,
  roleplayAttempts,
  roleplayMessages,
  roleplayCriterionScores,
  homepageFeaturedScenarios,
} from "../shared/schemas/roleplay-core.ts";
import {
  classificationDimensions,
  classificationOptions,
  roleplayClassificationLinks,
} from "../shared/schemas/roleplay-classifications.ts";
import {
  roleplayAppConfig,
  roleplayProviderKeys,
  roleplayAllowedPersonaModels,
  roleplayAllowedGraderModels,
} from "../shared/schemas/agent/roleplay-app-config.ts";
import { mediaAssets } from "../shared/schemas/media-assets.ts";
import {
  scenarioRewardTiers,
  userScenarioTierRewards,
  pointTransactions,
} from "../shared/schemas/points.ts";
import { resolveDatabaseUrl } from "./init-db/resolve-database-url.ts";

const schema = {
  users,
  roles,
  mediaAssets,
  roleplays,
  roleplaySettings,
  roleplayPersonas,
  roleplayCriteria,
  roleplayAttempts,
  roleplayMessages,
  roleplayCriterionScores,
  homepageFeaturedScenarios,
  classificationDimensions,
  classificationOptions,
  roleplayClassificationLinks,
  roleplayAppConfig,
  roleplayProviderKeys,
  roleplayAllowedPersonaModels,
  roleplayAllowedGraderModels,
  scenarioRewardTiers,
  userScenarioTierRewards,
  pointTransactions,
};

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

const pool = new pg.Pool({ connectionString: resolveDatabaseUrl(process.env.DATABASE_URL) });
export const db = drizzle(pool, { schema });
export { pool };
