CREATE TABLE IF NOT EXISTS "reward_tiers" (
	"id" serial PRIMARY KEY NOT NULL,
	"content_type" text DEFAULT 'scenario' NOT NULL,
	"content_id" integer NOT NULL,
	"tier_name" text NOT NULL,
	"min_score_percent" integer NOT NULL,
	"reward_points" integer DEFAULT 0 NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"star_level" integer NOT NULL,
	"color" text,
	"icon" text,
	"legacy_id" integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "reward_tiers_content_star" ON "reward_tiers" USING btree ("content_type","content_id","star_level");
--> statement-breakpoint
INSERT INTO "reward_tiers" ("content_type", "content_id", "tier_name", "min_score_percent", "reward_points", "order_index", "star_level", "color", "icon", "legacy_id")
SELECT 'scenario', "roleplay_id", "tier_name", "min_score_percent", "reward_points", "order_index", "star_level", "color", "icon", "id"
FROM "scenario_reward_tiers";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_content_tier_awards" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"content_type" text DEFAULT 'scenario' NOT NULL,
	"content_id" integer NOT NULL,
	"highest_tier_id" integer,
	"total_points_awarded" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_content_tier_awards" ADD CONSTRAINT "user_content_tier_awards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_content_tier_awards" ADD CONSTRAINT "user_content_tier_awards_highest_tier_id_reward_tiers_id_fk" FOREIGN KEY ("highest_tier_id") REFERENCES "public"."reward_tiers"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_content_tier_awards_user_content" ON "user_content_tier_awards" USING btree ("user_id","content_type","content_id");
--> statement-breakpoint
INSERT INTO "user_content_tier_awards" ("user_id", "content_type", "content_id", "highest_tier_id", "total_points_awarded", "updated_at")
SELECT u."user_id", 'scenario', u."roleplay_id", rt."id", u."total_points_awarded", u."updated_at"
FROM "user_scenario_tier_rewards" u
LEFT JOIN "reward_tiers" rt ON rt."legacy_id" = u."highest_tier_id";
--> statement-breakpoint
ALTER TABLE "point_transactions" ADD COLUMN "content_type" text;
--> statement-breakpoint
ALTER TABLE "point_transactions" ADD COLUMN "content_id" integer;
--> statement-breakpoint
ALTER TABLE "point_transactions" ADD COLUMN "activity_id" integer;
--> statement-breakpoint
UPDATE "point_transactions" SET "content_type" = 'scenario', "content_id" = "roleplay_id", "activity_id" = "attempt_id";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "activity_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"content_type" text NOT NULL,
	"content_id" integer NOT NULL,
	"activity_id" integer,
	"score_percent" numeric(5, 2),
	"passed" boolean,
	"occurred_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activity_log_user_time" ON "activity_log" USING btree ("user_id","occurred_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activity_log_content" ON "activity_log" USING btree ("content_type","content_id");
--> statement-breakpoint
INSERT INTO "activity_log" ("user_id", "content_type", "content_id", "activity_id", "score_percent", "passed", "occurred_at")
SELECT "user_id", 'scenario', "roleplay_id", "id", "score", "is_passed", "completed_at"
FROM "roleplay_attempts"
WHERE "status" = 'completed' AND "completed_at" IS NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "gamification_content" (
	"content_type" text NOT NULL,
	"content_id" integer NOT NULL,
	"title" text NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "gamification_content_pk" PRIMARY KEY("content_type","content_id")
);
--> statement-breakpoint
INSERT INTO "gamification_content" ("content_type", "content_id", "title", "is_active")
SELECT 'scenario', "id", "title", ("status" = 'published') FROM "roleplays";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "content_classification_links" (
	"content_type" text DEFAULT 'scenario' NOT NULL,
	"content_id" integer NOT NULL,
	"option_id" integer NOT NULL,
	CONSTRAINT "content_classification_links_pk" PRIMARY KEY("content_type","content_id","option_id")
);
--> statement-breakpoint
ALTER TABLE "content_classification_links" ADD CONSTRAINT "content_classification_links_option_id_classification_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."classification_options"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "content_classification_links" ("content_type", "content_id", "option_id")
SELECT 'scenario', "roleplay_id", "option_id" FROM "roleplay_classification_links";
--> statement-breakpoint
DO $$
BEGIN
  IF (SELECT count(*) FROM reward_tiers) <> (SELECT count(*) FROM scenario_reward_tiers) THEN
    RAISE EXCEPTION 'reward_tiers backfill count mismatch';
  END IF;
  IF (SELECT count(*) FROM user_content_tier_awards) <> (SELECT count(*) FROM user_scenario_tier_rewards) THEN
    RAISE EXCEPTION 'user_content_tier_awards backfill count mismatch';
  END IF;
  IF (SELECT coalesce(sum(total_points_awarded),0) FROM user_content_tier_awards)
     <> (SELECT coalesce(sum(total_points_awarded),0) FROM user_scenario_tier_rewards) THEN
    RAISE EXCEPTION 'tier award points sum mismatch';
  END IF;
  IF EXISTS (SELECT 1 FROM point_transactions WHERE roleplay_id IS NOT NULL AND content_id IS NULL) THEN
    RAISE EXCEPTION 'point_transactions backfill left unmapped rows';
  END IF;
  IF EXISTS (SELECT 1 FROM user_scenario_tier_rewards u
             WHERE u.highest_tier_id IS NOT NULL AND NOT EXISTS
               (SELECT 1 FROM user_content_tier_awards n
                JOIN reward_tiers rt ON rt.id = n.highest_tier_id
                WHERE n.user_id = u.user_id AND n.content_id = u.roleplay_id
                  AND rt.legacy_id = u.highest_tier_id)) THEN
    RAISE EXCEPTION 'highest_tier_id mapping mismatch';
  END IF;
  IF (SELECT count(*) FROM activity_log)
     <> (SELECT count(*) FROM roleplay_attempts WHERE status='completed' AND completed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'activity_log backfill count mismatch';
  END IF;
  IF (SELECT count(*) FROM gamification_content) <> (SELECT count(*) FROM roleplays) THEN
    RAISE EXCEPTION 'gamification_content backfill count mismatch';
  END IF;
  IF (SELECT count(*) FROM content_classification_links)
     <> (SELECT count(*) FROM roleplay_classification_links) THEN
    RAISE EXCEPTION 'classification links backfill count mismatch';
  END IF;
END $$;
