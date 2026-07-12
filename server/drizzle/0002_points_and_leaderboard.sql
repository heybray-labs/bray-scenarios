CREATE TABLE IF NOT EXISTS "scenario_reward_tiers" (
	"id" serial PRIMARY KEY NOT NULL,
	"roleplay_id" integer NOT NULL,
	"tier_name" text NOT NULL,
	"min_score_percent" integer NOT NULL,
	"reward_points" integer DEFAULT 0 NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_scenario_tier_rewards" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"roleplay_id" integer NOT NULL,
	"highest_tier_id" integer,
	"total_points_awarded" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "point_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"amount" integer NOT NULL,
	"roleplay_id" integer,
	"attempt_id" integer,
	"tier_name" text,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scenario_reward_tiers" ADD CONSTRAINT "scenario_reward_tiers_roleplay_id_roleplays_id_fk" FOREIGN KEY ("roleplay_id") REFERENCES "public"."roleplays"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_scenario_tier_rewards" ADD CONSTRAINT "user_scenario_tier_rewards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_scenario_tier_rewards" ADD CONSTRAINT "user_scenario_tier_rewards_roleplay_id_roleplays_id_fk" FOREIGN KEY ("roleplay_id") REFERENCES "public"."roleplays"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_scenario_tier_rewards" ADD CONSTRAINT "user_scenario_tier_rewards_highest_tier_id_scenario_reward_tiers_id_fk" FOREIGN KEY ("highest_tier_id") REFERENCES "public"."scenario_reward_tiers"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "point_transactions" ADD CONSTRAINT "point_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "point_transactions" ADD CONSTRAINT "point_transactions_roleplay_id_roleplays_id_fk" FOREIGN KEY ("roleplay_id") REFERENCES "public"."roleplays"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "point_transactions" ADD CONSTRAINT "point_transactions_attempt_id_roleplay_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."roleplay_attempts"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_scenario_tier_rewards_user_roleplay" ON "user_scenario_tier_rewards" USING btree ("user_id","roleplay_id");
