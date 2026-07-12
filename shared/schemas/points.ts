import {
  pgTable,
  text,
  serial,
  integer,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "@heybray/identity/schema";
import { roleplays, roleplayAttempts } from "./roleplay-core.ts";

export const scenarioRewardTiers = pgTable(
  "scenario_reward_tiers",
  {
    id: serial("id").primaryKey(),
    roleplayId: integer("roleplay_id")
      .notNull()
      .references(() => roleplays.id, { onDelete: "cascade" }),
    tierName: text("tier_name").notNull(),
    minScorePercent: integer("min_score_percent").notNull(),
    rewardPoints: integer("reward_points").notNull().default(0),
    orderIndex: integer("order_index").notNull().default(0),
    starLevel: integer("star_level").notNull(),
    color: text("color"),
    icon: text("icon"),
  },
  (table) => [
    uniqueIndex("scenario_reward_tiers_roleplay_star").on(table.roleplayId, table.starLevel),
  ],
);

export const userScenarioTierRewards = pgTable(
  "user_scenario_tier_rewards",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleplayId: integer("roleplay_id")
      .notNull()
      .references(() => roleplays.id, { onDelete: "cascade" }),
    highestTierId: integer("highest_tier_id").references(() => scenarioRewardTiers.id, {
      onDelete: "set null",
    }),
    totalPointsAwarded: integer("total_points_awarded").notNull().default(0),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("user_scenario_tier_rewards_user_roleplay").on(table.userId, table.roleplayId),
  ],
);

export const pointTransactions = pgTable("point_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  roleplayId: integer("roleplay_id").references(() => roleplays.id, { onDelete: "set null" }),
  attemptId: integer("attempt_id").references(() => roleplayAttempts.id, { onDelete: "set null" }),
  tierName: text("tier_name"),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const CANONICAL_TIER_NAMES = ["Bronze", "Silver", "Gold"] as const;
export type CanonicalTierName = (typeof CANONICAL_TIER_NAMES)[number];

export const REWARD_TIER_DISPLAY_PRESETS: Record<string, { color: string }> = {
  bronze: { color: "#b45309" },
  silver: { color: "#64748b" },
  gold: { color: "#ca8a04" },
};

export type RewardTierDisplay = {
  name: string;
  color: string;
  starCount: number;
  starLevel: number;
};

export function starLevelFromTierName(tierName: string): number {
  const slug = tierName.toLowerCase().trim();
  if (slug === "bronze") return 1;
  if (slug === "silver") return 2;
  if (slug === "gold") return 3;
  return 0;
}

export function tierNameFromStarLevel(starLevel: number): CanonicalTierName {
  return CANONICAL_TIER_NAMES[starLevel - 1] ?? "Bronze";
}

export function resolveStarLevelFromTier(tier: {
  starLevel?: number | null;
  tierName?: string | null;
}): number {
  if (tier.starLevel != null && tier.starLevel >= 1 && tier.starLevel <= 3) {
    return tier.starLevel;
  }
  if (tier.tierName) {
    const fromName = starLevelFromTierName(tier.tierName);
    if (fromName > 0) return fromName;
  }
  return 0;
}

export function resolveRewardTierDisplay(tier: {
  starLevel?: number | null;
  tierName?: string | null;
  color?: string | null;
  icon?: string | null;
}): RewardTierDisplay {
  const starLevel = resolveStarLevelFromTier(tier);
  const name =
    starLevel > 0
      ? tierNameFromStarLevel(starLevel)
      : (tier.tierName?.trim() || "Tier");
  const slug = name.toLowerCase();
  const preset = REWARD_TIER_DISPLAY_PRESETS[slug];
  return {
    name,
    color: tier.color?.trim() || preset?.color || "#64748b",
    starCount: starLevel,
    starLevel,
  };
}

export function deriveStarLevel(
  score: number | null | undefined,
  tiers: Array<{ minScorePercent: number; starLevel?: number | null; orderIndex?: number }>,
): number {
  if (score == null || !tiers.length) return 0;
  const sorted = [...tiers].sort(
    (a, b) =>
      (a.starLevel ?? a.orderIndex ?? 0) - (b.starLevel ?? b.orderIndex ?? 0) ||
      a.minScorePercent - b.minScorePercent,
  );
  let earned = 0;
  for (const tier of sorted) {
    if (score >= tier.minScorePercent) {
      earned = tier.starLevel ?? earned + 1;
    }
  }
  return earned;
}

export function maxRewardPoints(tiers: Array<{ rewardPoints?: number }>): number {
  if (!tiers.length) return 0;
  return Math.max(...tiers.map((t) => t.rewardPoints ?? 0));
}

type NormalizableTier = {
  id?: number;
  tierName?: string;
  minScorePercent?: number;
  rewardPoints?: number;
  orderIndex?: number;
  starLevel?: number;
  color?: string | null;
  icon?: string | null;
};

export function normalizeRewardTiers(rawTiers: NormalizableTier[]): RewardTierInput[] {
  if (!rawTiers.length) return [];

  const sorted = [...rawTiers].sort((a, b) => {
    if (a.starLevel != null && b.starLevel != null) return a.starLevel - b.starLevel;
    return (a.orderIndex ?? 0) - (b.orderIndex ?? 0);
  });

  const mapped = sorted.slice(0, 3);
  const result: RewardTierInput[] = [];

  for (let i = 0; i < 3; i++) {
    const starLevel = i + 1;
    const existing = mapped[i];
    const defaults = DEFAULT_REWARD_TIERS[i];
    result.push({
      id: existing?.id,
      starLevel,
      tierName: tierNameFromStarLevel(starLevel),
      minScorePercent: existing?.minScorePercent ?? defaults.minScorePercent,
      rewardPoints: existing?.rewardPoints ?? defaults.rewardPoints,
      orderIndex: i,
    });
  }

  return result;
}

export const insertScenarioRewardTierSchema = createInsertSchema(scenarioRewardTiers).omit({
  id: true,
});

export const rewardTierInputSchema = z.object({
  id: z.number().optional(),
  starLevel: z.number().int().min(1).max(3).optional(),
  tierName: z.string().min(1).optional(),
  minScorePercent: z.number().int().min(0).max(100),
  rewardPoints: z.number().int().min(0),
  orderIndex: z.number().int().optional(),
  color: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
});

export type ScenarioRewardTier = typeof scenarioRewardTiers.$inferSelect;
export type UserScenarioTierReward = typeof userScenarioTierRewards.$inferSelect;
export type PointTransaction = typeof pointTransactions.$inferSelect;
export type RewardTierInput = z.infer<typeof rewardTierInputSchema>;

export const DEFAULT_REWARD_TIERS: RewardTierInput[] = [
  { starLevel: 1, tierName: "Bronze", minScorePercent: 50, rewardPoints: 10, orderIndex: 0 },
  { starLevel: 2, tierName: "Silver", minScorePercent: 70, rewardPoints: 25, orderIndex: 1 },
  { starLevel: 3, tierName: "Gold", minScorePercent: 90, rewardPoints: 50, orderIndex: 2 },
];

/** @deprecated Legacy icon options — no longer used in authoring UI */
export const REWARD_TIER_ICON_OPTIONS = [
  "medal",
  "award",
  "crown",
  "star",
  "trophy",
  "gem",
  "sparkles",
  "target",
  "zap",
] as const;
