CREATE TABLE "roleplay_allowed_grader_models" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roleplay_allowed_persona_models" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roleplay_app_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" text DEFAULT 'openai' NOT NULL,
	"model" text DEFAULT 'gpt-4o-mini' NOT NULL,
	"encrypted_api_key" text,
	"default_persona_provider" text,
	"default_persona_model" text,
	"default_grader_provider" text,
	"default_grader_model" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roleplay_provider_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"encrypted_api_key" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "roleplay_provider_keys_provider_unique" UNIQUE("provider")
);
--> statement-breakpoint
CREATE TABLE "auth_exchange_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"user_id" integer NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "auth_exchange_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"original_filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"storage_key" text NOT NULL,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "media_assets_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "classification_dimensions" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"cardinality" text DEFAULT 'single' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "classification_dimensions_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "classification_options" (
	"id" serial PRIMARY KEY NOT NULL,
	"dimension_id" integer NOT NULL,
	"slug" text NOT NULL,
	"label" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"color" text,
	"icon" text
);
--> statement-breakpoint
CREATE TABLE "roleplay_classification_links" (
	"roleplay_id" integer NOT NULL,
	"option_id" integer NOT NULL,
	CONSTRAINT "roleplay_classification_links_roleplay_id_option_id_pk" PRIMARY KEY("roleplay_id","option_id")
);
--> statement-breakpoint
CREATE TABLE "roleplay_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"roleplay_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"attempt_number" integer DEFAULT 1 NOT NULL,
	"score" numeric(5, 2),
	"turn_count" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"time_spent" integer,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"end_reason" text,
	"is_passed" boolean,
	"grading_status" text DEFAULT 'pending' NOT NULL,
	"graded_at" timestamp,
	"overall_feedback" text,
	"persona_provider" text,
	"persona_model" text,
	"grader_provider" text,
	"grader_model" text
);
--> statement-breakpoint
CREATE TABLE "roleplay_criteria" (
	"id" serial PRIMARY KEY NOT NULL,
	"roleplay_id" integer,
	"name" text NOT NULL,
	"description" text,
	"weight" numeric(5, 2) DEFAULT '1.0' NOT NULL,
	"max_score" integer DEFAULT 100 NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roleplay_criterion_scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"attempt_id" integer,
	"criterion_id" integer,
	"score" numeric(6, 2) DEFAULT '0' NOT NULL,
	"max_score" integer DEFAULT 100 NOT NULL,
	"feedback" text,
	"strengths" text,
	"improvements" text,
	"manual_score" numeric(6, 2),
	"graded_by" integer,
	"graded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roleplay_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"attempt_id" integer,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"turn_number" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roleplay_personas" (
	"id" serial PRIMARY KEY NOT NULL,
	"roleplay_id" integer,
	"name" text DEFAULT '' NOT NULL,
	"role_title" text,
	"personality_traits" text,
	"mood" text,
	"difficulty" text DEFAULT 'medium' NOT NULL,
	"background_facts" text,
	"hidden_objective" text,
	"opening_style" text,
	"avatar_url" text,
	CONSTRAINT "roleplay_personas_roleplay_id_unique" UNIQUE("roleplay_id")
);
--> statement-breakpoint
CREATE TABLE "roleplay_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"roleplay_id" integer,
	"max_attempts" integer,
	"pass_threshold" integer DEFAULT 70 NOT NULL,
	"allow_manual_end" boolean DEFAULT true NOT NULL,
	"max_turns" integer,
	"auto_end_on_max_turns" boolean DEFAULT false NOT NULL,
	"allow_ai_end" boolean DEFAULT false NOT NULL,
	"live_coaching" boolean DEFAULT false NOT NULL,
	"time_limit_minutes" integer,
	"show_timer" boolean DEFAULT true NOT NULL,
	"post_session_display_mode" text DEFAULT 'full_breakdown' NOT NULL,
	"show_transcript" boolean DEFAULT true NOT NULL,
	"show_rubric_breakdown" boolean DEFAULT true NOT NULL,
	"allow_view_previous_attempts" boolean DEFAULT true NOT NULL,
	"persona_provider" text,
	"persona_model" text,
	"grader_provider" text,
	"grader_model" text,
	CONSTRAINT "roleplay_settings_roleplay_id_unique" UNIQUE("roleplay_id")
);
--> statement-breakpoint
CREATE TABLE "roleplays" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"introduction" text,
	"custom_thank_you_message" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"cover_image_media_id" integer,
	"learner_role" text,
	"situation_context" text,
	"learner_objective" text,
	"playbook" text,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"start_date" timestamp,
	"end_date" timestamp
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"permissions" text[] DEFAULT '{}'::text[] NOT NULL,
	"is_global" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_identities" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"provider" text NOT NULL,
	"provider_user_id" text NOT NULL,
	"provider_display_name" text,
	"provider_email" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"first_name" text,
	"password" text,
	"role_id" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_suspended" boolean DEFAULT false NOT NULL,
	"is_email_verified" boolean DEFAULT false NOT NULL,
	"email_verification_token" text,
	"email_verification_expires" timestamp,
	"password_reset_token" text,
	"password_reset_expires" timestamp,
	"last_login" timestamp,
	"failed_login_attempts" integer DEFAULT 0 NOT NULL,
	"last_failed_login" timestamp,
	"locked_until" timestamp,
	"approval_status" text DEFAULT 'approved' NOT NULL,
	"approved_by" integer,
	"approved_at" timestamp,
	"two_factor_enabled" boolean DEFAULT false NOT NULL,
	"two_factor_method" text,
	"totp_secret" text,
	"email_otp_code" text,
	"email_otp_expiry" timestamp,
	"two_factor_backup_used" integer DEFAULT 0 NOT NULL,
	"must_change_password" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth_exchange_codes" ADD CONSTRAINT "auth_exchange_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classification_options" ADD CONSTRAINT "classification_options_dimension_id_classification_dimensions_id_fk" FOREIGN KEY ("dimension_id") REFERENCES "public"."classification_dimensions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roleplay_classification_links" ADD CONSTRAINT "roleplay_classification_links_roleplay_id_roleplays_id_fk" FOREIGN KEY ("roleplay_id") REFERENCES "public"."roleplays"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roleplay_classification_links" ADD CONSTRAINT "roleplay_classification_links_option_id_classification_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."classification_options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roleplay_attempts" ADD CONSTRAINT "roleplay_attempts_roleplay_id_roleplays_id_fk" FOREIGN KEY ("roleplay_id") REFERENCES "public"."roleplays"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roleplay_attempts" ADD CONSTRAINT "roleplay_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roleplay_criteria" ADD CONSTRAINT "roleplay_criteria_roleplay_id_roleplays_id_fk" FOREIGN KEY ("roleplay_id") REFERENCES "public"."roleplays"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roleplay_criterion_scores" ADD CONSTRAINT "roleplay_criterion_scores_attempt_id_roleplay_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."roleplay_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roleplay_criterion_scores" ADD CONSTRAINT "roleplay_criterion_scores_criterion_id_roleplay_criteria_id_fk" FOREIGN KEY ("criterion_id") REFERENCES "public"."roleplay_criteria"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roleplay_criterion_scores" ADD CONSTRAINT "roleplay_criterion_scores_graded_by_users_id_fk" FOREIGN KEY ("graded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roleplay_messages" ADD CONSTRAINT "roleplay_messages_attempt_id_roleplay_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."roleplay_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roleplay_personas" ADD CONSTRAINT "roleplay_personas_roleplay_id_roleplays_id_fk" FOREIGN KEY ("roleplay_id") REFERENCES "public"."roleplays"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roleplay_settings" ADD CONSTRAINT "roleplay_settings_roleplay_id_roleplays_id_fk" FOREIGN KEY ("roleplay_id") REFERENCES "public"."roleplays"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roleplays" ADD CONSTRAINT "roleplays_cover_image_media_id_media_assets_id_fk" FOREIGN KEY ("cover_image_media_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roleplays" ADD CONSTRAINT "roleplays_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_identities" ADD CONSTRAINT "user_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "roleplay_allowed_grader_models_provider_model_idx" ON "roleplay_allowed_grader_models" USING btree ("provider","model");--> statement-breakpoint
CREATE UNIQUE INDEX "roleplay_allowed_persona_models_provider_model_idx" ON "roleplay_allowed_persona_models" USING btree ("provider","model");--> statement-breakpoint
CREATE UNIQUE INDEX "classification_options_dimension_slug" ON "classification_options" USING btree ("dimension_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "user_identities_provider_user_idx" ON "user_identities" USING btree ("provider","provider_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");