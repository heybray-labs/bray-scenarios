// Transitional shim: re-exports pure reward-tier helpers from the canonical
// gamification package. The legacy point/reward TABLE definitions moved to
// server/legacy-schema/points-legacy.ts (Fix 3a) so drizzle-kit sees exactly one
// point_transactions definition. This file (and its importers) is removed in
// Fix 5 — demo-data will import helpers from @heybray/gamification/schema.
export {
  CANONICAL_TIER_NAMES,
  REWARD_TIER_DISPLAY_PRESETS,
  starLevelFromTierName,
  tierNameFromStarLevel,
  resolveStarLevelFromTier,
  resolveRewardTierDisplay,
  deriveStarLevel,
  maxRewardPoints,
  normalizeRewardTiers,
  rewardTierInputSchema,
  DEFAULT_REWARD_TIERS,
} from "@heybray/gamification/schema";
export type {
  CanonicalTierName,
  RewardTierDisplay,
  RewardTierInput,
} from "@heybray/gamification/schema";
