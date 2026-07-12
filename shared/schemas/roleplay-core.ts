import { pgTable, text, serial, integer, boolean, timestamp, decimal, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "@heybray/identity/schema";
import { mediaAssets } from "@heybray/server-kit/schema";

export const roleplays = pgTable("roleplays", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  introduction: text("introduction"),
  customThankYouMessage: text("custom_thank_you_message"),
  status: text("status").notNull().default("draft"),
  coverImageMediaId: integer("cover_image_media_id").references(() => mediaAssets.id, {
    onDelete: "set null",
  }),
  learnerRole: text("learner_role"),
  situationContext: text("situation_context"),
  learnerObjective: text("learner_objective"),
  playbook: text("playbook"),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  publishedAt: timestamp("published_at"),
  published: boolean("published").notNull().default(false),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
});

export const homepageFeaturedScenarios = pgTable("homepage_featured_scenarios", {
  roleplayId: integer("roleplay_id")
    .primaryKey()
    .references(() => roleplays.id, { onDelete: "cascade" }),
  sortOrder: integer("sort_order").notNull(),
});

export const roleplaySettings = pgTable("roleplay_settings", {
  id: serial("id").primaryKey(),
  roleplayId: integer("roleplay_id").references(() => roleplays.id, { onDelete: "cascade" }).unique(),
  maxAttempts: integer("max_attempts"),
  passThreshold: integer("pass_threshold").notNull().default(70),
  allowManualEnd: boolean("allow_manual_end").notNull().default(true),
  maxTurns: integer("max_turns"),
  autoEndOnMaxTurns: boolean("auto_end_on_max_turns").notNull().default(false),
  allowAiEnd: boolean("allow_ai_end").notNull().default(false),
  liveCoaching: boolean("live_coaching").notNull().default(false),
  timeLimitMinutes: integer("time_limit_minutes"),
  showTimer: boolean("show_timer").notNull().default(true),
  postSessionDisplayMode: text("post_session_display_mode").notNull().default("full_breakdown"),
  showTranscript: boolean("show_transcript").notNull().default(true),
  showRubricBreakdown: boolean("show_rubric_breakdown").notNull().default(true),
  allowViewPreviousAttempts: boolean("allow_view_previous_attempts").notNull().default(true),
  personaProvider: text("persona_provider"),
  personaModel: text("persona_model"),
  graderProvider: text("grader_provider"),
  graderModel: text("grader_model"),
});

export const roleplayPersonas = pgTable("roleplay_personas", {
  id: serial("id").primaryKey(),
  roleplayId: integer("roleplay_id").references(() => roleplays.id, { onDelete: "cascade" }).unique(),
  name: text("name").notNull().default(""),
  roleTitle: text("role_title"),
  personalityTraits: text("personality_traits"),
  mood: text("mood"),
  difficulty: text("difficulty").notNull().default("medium"),
  backgroundFacts: text("background_facts"),
  hiddenObjective: text("hidden_objective"),
  openingStyle: text("opening_style"),
  avatarUrl: text("avatar_url"),
});

export const roleplayCriteria = pgTable("roleplay_criteria", {
  id: serial("id").primaryKey(),
  roleplayId: integer("roleplay_id").references(() => roleplays.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  weight: decimal("weight", { precision: 5, scale: 2 }).notNull().default("1.0"),
  maxScore: integer("max_score").notNull().default(100),
  orderIndex: integer("order_index").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const roleplayAttempts = pgTable("roleplay_attempts", {
  id: serial("id").primaryKey(),
  roleplayId: integer("roleplay_id").notNull().references(() => roleplays.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  attemptNumber: integer("attempt_number").notNull().default(1),
  score: decimal("score", { precision: 5, scale: 2 }),
  turnCount: integer("turn_count").notNull().default(0),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
  timeSpent: integer("time_spent"),
  status: text("status").notNull().default("in_progress"),
  endReason: text("end_reason"),
  isPassed: boolean("is_passed"),
  gradingStatus: text("grading_status").notNull().default("pending"),
  gradedAt: timestamp("graded_at"),
  overallFeedback: text("overall_feedback"),
  personaProvider: text("persona_provider"),
  personaModel: text("persona_model"),
  graderProvider: text("grader_provider"),
  graderModel: text("grader_model"),
});

export const roleplayMessages = pgTable("roleplay_messages", {
  id: serial("id").primaryKey(),
  attemptId: integer("attempt_id").references(() => roleplayAttempts.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  turnNumber: integer("turn_number").notNull().default(0),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const roleplayCriterionScores = pgTable("roleplay_criterion_scores", {
  id: serial("id").primaryKey(),
  attemptId: integer("attempt_id").references(() => roleplayAttempts.id, { onDelete: "cascade" }),
  criterionId: integer("criterion_id").references(() => roleplayCriteria.id, { onDelete: "cascade" }),
  score: decimal("score", { precision: 6, scale: 2 }).notNull().default("0"),
  maxScore: integer("max_score").notNull().default(100),
  feedback: text("feedback"),
  strengths: text("strengths"),
  improvements: text("improvements"),
  manualScore: decimal("manual_score", { precision: 6, scale: 2 }),
  gradedBy: integer("graded_by").references(() => users.id),
  gradedAt: timestamp("graded_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertRoleplaySchema = createInsertSchema(roleplays).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Roleplay = typeof roleplays.$inferSelect;
export type HomepageFeaturedScenario = typeof homepageFeaturedScenarios.$inferSelect;
export type RoleplaySettings = typeof roleplaySettings.$inferSelect;
export type RoleplayPersona = typeof roleplayPersonas.$inferSelect;
export type RoleplayCriterion = typeof roleplayCriteria.$inferSelect;
export type RoleplayAttempt = typeof roleplayAttempts.$inferSelect;
export type RoleplayMessage = typeof roleplayMessages.$inferSelect;
export type RoleplayCriterionScore = typeof roleplayCriterionScores.$inferSelect;
