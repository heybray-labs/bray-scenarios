ALTER TABLE "point_transactions" DROP CONSTRAINT IF EXISTS "point_transactions_roleplay_id_roleplays_id_fk";
--> statement-breakpoint
ALTER TABLE "point_transactions" DROP CONSTRAINT IF EXISTS "point_transactions_attempt_id_roleplay_attempts_id_fk";
--> statement-breakpoint
ALTER TABLE "point_transactions" DROP COLUMN IF EXISTS "roleplay_id";
--> statement-breakpoint
ALTER TABLE "point_transactions" DROP COLUMN IF EXISTS "attempt_id";
--> statement-breakpoint
ALTER TABLE "reward_tiers" DROP COLUMN IF EXISTS "legacy_id";
--> statement-breakpoint
DROP TABLE IF EXISTS "user_scenario_tier_rewards";
--> statement-breakpoint
DROP TABLE IF EXISTS "scenario_reward_tiers";
--> statement-breakpoint
DROP TABLE IF EXISTS "roleplay_classification_links";
