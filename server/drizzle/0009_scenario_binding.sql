ALTER TABLE "reward_tiers" ADD CONSTRAINT "reward_tiers_scenario_fk" FOREIGN KEY ("content_id") REFERENCES "public"."roleplays"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_content_tier_awards" ADD CONSTRAINT "ucta_scenario_fk" FOREIGN KEY ("content_id") REFERENCES "public"."roleplays"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_scenario_fk" FOREIGN KEY ("content_id") REFERENCES "public"."roleplays"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_attempt_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."roleplay_attempts"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "content_classification_links" ADD CONSTRAINT "ccl_scenario_fk" FOREIGN KEY ("content_id") REFERENCES "public"."roleplays"("id") ON DELETE cascade ON UPDATE no action;
