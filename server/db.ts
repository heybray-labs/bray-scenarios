import { createDb, setDatabase } from "@heybray/server-kit";
import { users, teams, roles } from "@heybray/identity/schema";
import { classificationDimensions, classificationOptions } from "@heybray/taxonomy/schema";
import { setClassificationLinks } from "@heybray/taxonomy";
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
import { mediaAssets } from "../shared/schemas/media-assets.ts";
import {
  scenarioRewardTiers,
  userScenarioTierRewards,
  pointTransactions,
} from "../shared/schemas/points.ts";

const schema = {
  users,
  teams,
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

const { db, pool } = createDb(schema);
setDatabase(db);
setClassificationLinks(roleplayClassificationLinks);
export { db, pool };
