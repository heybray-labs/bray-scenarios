-- Upgrade databases created before versioned migrations (drizzle-kit push era).
ALTER TABLE "roleplays" DROP COLUMN IF EXISTS "cover_image_url";
--> statement-breakpoint
ALTER TABLE "roleplays" DROP COLUMN IF EXISTS "category";
--> statement-breakpoint
ALTER TABLE "roleplays" DROP COLUMN IF EXISTS "tags";
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'roleplays'
      AND column_name = 'cover_image_media_id'
  ) THEN
    ALTER TABLE roleplays
      ADD COLUMN cover_image_media_id integer
      REFERENCES media_assets(id) ON DELETE SET NULL;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'classification_options'
      AND column_name = 'color'
  ) THEN
    ALTER TABLE classification_options ADD COLUMN color text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'classification_options'
      AND column_name = 'icon'
  ) THEN
    ALTER TABLE classification_options ADD COLUMN icon text;
  END IF;
END $$;
