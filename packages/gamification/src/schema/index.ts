export * from "./tables.ts";
export * from "./tier-helpers.ts";

import {
  rewardTiers,
  userContentTierAwards,
  activityLog,
  gamificationContent,
} from "./tables.ts";

/**
 * Aggregated schema object for registration in the app's `createDb` call.
 * content_classification_links is contributed by taxonomySchema, not here.
 */
export const gamificationSchema = {
  rewardTiers,
  userContentTierAwards,
  activityLog,
  gamificationContent,
};
