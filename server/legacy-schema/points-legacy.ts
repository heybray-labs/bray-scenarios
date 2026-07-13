// Legacy tables, unread since Phase 2. Registered in db.ts only so drizzle's
// runtime schema knows they exist. Dropped in migration 0010 (future release).
// Deliberately OUTSIDE the drizzle.config.ts glob — the canonical
// point_transactions definition lives in @heybray/gamification/schema.
import {
  pgTable,
  text,
  serial,
  integer,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { users } from "@heybray/identity/schema";
import { roleplays, roleplayAttempts } from "../../shared/schemas/roleplay-core.ts";

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

export const insertScenarioRewardTierSchema = createInsertSchema(scenarioRewardTiers).omit({
  id: true,
});

export type ScenarioRewardTier = typeof scenarioRewardTiers.$inferSelect;
export type UserScenarioTierReward = typeof userScenarioTierRewards.$inferSelect;
export type PointTransaction = typeof pointTransactions.$inferSelect;

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
