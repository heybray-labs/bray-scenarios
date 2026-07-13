import { createDb, setDatabase } from "@heybray/server-kit";
import { setMediaUsageHook } from "@heybray/media";
import { mediaSchema } from "@heybray/media/schema";
import { identitySchema } from "@heybray/identity/schema";
import { taxonomySchema } from "@heybray/taxonomy";
import { gamificationSchema } from "@heybray/gamification";
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
// Legacy table, unread since Phase 2 (kept registered so drizzle knows it exists
// until it is dropped in a follow-up release).
import { roleplayClassificationLinks } from "../shared/schemas/roleplay-classification-links.ts";
import {
  roleplayAppConfig,
  roleplayProviderKeys,
  roleplayAllowedPersonaModels,
  roleplayAllowedGraderModels,
} from "../shared/schemas/agent/roleplay-app-config.ts";
// Legacy gamification tables, unread since Phase 2 (superseded by the
// @heybray/gamification tables). Kept registered until dropped in a follow-up.
import {
  scenarioRewardTiers,
  userScenarioTierRewards,
  pointTransactions,
} from "../shared/schemas/points.ts";
import { roleplayMediaUsage } from "./media-usage.ts";

const appSchema = {
  roleplays,
  roleplaySettings,
  roleplayPersonas,
  roleplayCriteria,
  roleplayAttempts,
  roleplayMessages,
  roleplayCriterionScores,
  homepageFeaturedScenarios,
  roleplayClassificationLinks,
  roleplayAppConfig,
  roleplayProviderKeys,
  roleplayAllowedPersonaModels,
  roleplayAllowedGraderModels,
  scenarioRewardTiers,
  userScenarioTierRewards,
  pointTransactions,
};

const schema = {
  ...mediaSchema,
  ...identitySchema,
  ...taxonomySchema,
  ...gamificationSchema,
  ...appSchema,
};

const { db, pool } = createDb(schema);
setDatabase(db);
setMediaUsageHook(roleplayMediaUsage);
export { db, pool };
