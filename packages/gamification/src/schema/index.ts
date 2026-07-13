export * from "./tables.ts";
export * from "./tier-helpers.ts";

import {
  rewardTiers,
  userContentTierAwards,
  activityLog,
  gamificationContent,
  contentClassificationLinks,
} from "./tables.ts";

/** Aggregated schema object for registration in the app's `createDb` call. */
export const gamificationSchema = {
  rewardTiers,
  userContentTierAwards,
  activityLog,
  gamificationContent,
  contentClassificationLinks,
};
