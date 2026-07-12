import { createDb, setDatabase, setMediaUsageHook, serverKitSchema } from "@heybray/server-kit";
import { identitySchema } from "@heybray/identity/schema";
import { taxonomySchema, setClassificationLinks } from "@heybray/taxonomy";
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
import { roleplayClassificationLinks } from "../shared/schemas/roleplay-classification-links.ts";
import {
  roleplayAppConfig,
  roleplayProviderKeys,
  roleplayAllowedPersonaModels,
  roleplayAllowedGraderModels,
} from "../shared/schemas/agent/roleplay-app-config.ts";
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

const schema = { ...serverKitSchema, ...identitySchema, ...taxonomySchema, ...appSchema };

const { db, pool } = createDb(schema);
setDatabase(db);
setClassificationLinks(roleplayClassificationLinks);
setMediaUsageHook(roleplayMediaUsage);
export { db, pool };
