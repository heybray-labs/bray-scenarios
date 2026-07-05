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
import { users } from "./users.ts";
import { roleplays, roleplayAttempts } from "./roleplay-core.ts";

export const scenarioRewardTiers = pgTable("scenario_reward_tiers", {
  id: serial("id").primaryKey(),
  roleplayId: integer("roleplay_id")
    .notNull()
    .references(() => roleplays.id, { onDelete: "cascade" }),
  tierName: text("tier_name").notNull(),
  minScorePercent: integer("min_score_percent").notNull(),
  rewardPoints: integer("reward_points").notNull().default(0),
  orderIndex: integer("order_index").notNull().default(0),
  color: text("color"),
  icon: text("icon"),
});

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

export const REWARD_TIER_DISPLAY_PRESETS: Record<string, { color: string; icon: string }> = {
  bronze: { color: "#b45309", icon: "medal" },
  silver: { color: "#64748b", icon: "award" },
  gold: { color: "#ca8a04", icon: "crown" },
};

export function resolveRewardTierDisplay(tier: {
  tierName: string;
  color?: string | null;
  icon?: string | null;
}): { color: string; icon: string } {
  const slug = tier.tierName.toLowerCase().trim();
  const preset = REWARD_TIER_DISPLAY_PRESETS[slug];
  return {
    color: tier.color?.trim() || preset?.color || "#64748b",
    icon: tier.icon?.trim() || preset?.icon || "star",
  };
}

export const insertScenarioRewardTierSchema = createInsertSchema(scenarioRewardTiers).omit({
  id: true,
});

export const rewardTierInputSchema = z.object({
  id: z.number().optional(),
  tierName: z.string().min(1),
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
  { tierName: "Bronze", minScorePercent: 50, rewardPoints: 10, ...REWARD_TIER_DISPLAY_PRESETS.bronze },
  { tierName: "Silver", minScorePercent: 70, rewardPoints: 25, ...REWARD_TIER_DISPLAY_PRESETS.silver },
  { tierName: "Gold", minScorePercent: 90, rewardPoints: 50, ...REWARD_TIER_DISPLAY_PRESETS.gold },
];
