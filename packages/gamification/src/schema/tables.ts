import {
  pgTable,
  text,
  serial,
  integer,
  numeric,
  boolean,
  timestamp,
  uniqueIndex,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import { users } from "@heybray/identity/schema";

// content_classification_links is owned by @heybray/taxonomy (Phase 2). Re-export
// it so gamification consumers can keep importing it from this package's schema.
export { contentClassificationLinks } from "@heybray/taxonomy/schema";
export type { ContentClassificationLink } from "@heybray/taxonomy/schema";

/**
 * Content-polymorphic gamification tables (Phase 2). `content_id` deliberately
 * carries NO `.references()` — the binding FK into the app's content table is the
 * app's own migration (0009_scenario_binding.sql), because platform packages must
 * not know any single app's content table.
 */

export const rewardTiers = pgTable(
  "reward_tiers",
  {
    id: serial("id").primaryKey(),
    contentType: text("content_type").notNull().default("scenario"),
    contentId: integer("content_id").notNull(),
    tierName: text("tier_name").notNull(),
    minScorePercent: integer("min_score_percent").notNull(),
    rewardPoints: integer("reward_points").notNull().default(0),
    orderIndex: integer("order_index").notNull().default(0),
    starLevel: integer("star_level").notNull(),
    color: text("color"),
    icon: text("icon"),
    // Maps to scenario_reward_tiers.id; dropped when the old tables drop.
    legacyId: integer("legacy_id"),
  },
  (table) => [
    uniqueIndex("reward_tiers_content_star").on(
      table.contentType,
      table.contentId,
      table.starLevel,
    ),
  ],
);

export const userContentTierAwards = pgTable(
  "user_content_tier_awards",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    contentType: text("content_type").notNull().default("scenario"),
    contentId: integer("content_id").notNull(),
    highestTierId: integer("highest_tier_id").references(() => rewardTiers.id, {
      onDelete: "set null",
    }),
    totalPointsAwarded: integer("total_points_awarded").notNull().default(0),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("user_content_tier_awards_user_content").on(
      table.userId,
      table.contentType,
      table.contentId,
    ),
  ],
);

export const activityLog = pgTable(
  "activity_log",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    contentType: text("content_type").notNull(),
    contentId: integer("content_id").notNull(),
    activityId: integer("activity_id"),
    scorePercent: numeric("score_percent", { precision: 5, scale: 2 }),
    passed: boolean("passed"),
    occurredAt: timestamp("occurred_at").notNull(),
  },
  (table) => [
    index("activity_log_user_time").on(table.userId, table.occurredAt),
    index("activity_log_content").on(table.contentType, table.contentId),
  ],
);

export const gamificationContent = pgTable(
  "gamification_content",
  {
    contentType: text("content_type").notNull(),
    contentId: integer("content_id").notNull(),
    title: text("title").notNull(),
    isActive: boolean("is_active").notNull().default(false),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.contentType, table.contentId] }),
  ],
);

/**
 * The package's content-polymorphic view of the shared `point_transactions`
 * table. It maps the columns added in migration 0008 (content_type/content_id/
 * activity_id) and omits the legacy roleplay_id/attempt_id columns (still on the
 * physical table until a follow-up drop). Not registered in `gamificationSchema`
 * — the app's db composition keeps the legacy view under `pointTransactions`.
 */
export const pointTransactions = pgTable("point_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  contentType: text("content_type"),
  contentId: integer("content_id"),
  activityId: integer("activity_id"),
  tierName: text("tier_name"),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type RewardTier = typeof rewardTiers.$inferSelect;
export type UserContentTierAward = typeof userContentTierAwards.$inferSelect;
export type ActivityLogRow = typeof activityLog.$inferSelect;
export type GamificationContentRow = typeof gamificationContent.$inferSelect;
