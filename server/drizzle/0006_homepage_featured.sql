CREATE TABLE IF NOT EXISTS "homepage_featured_scenarios" (
  "roleplay_id" integer PRIMARY KEY NOT NULL REFERENCES "roleplays"("id") ON DELETE CASCADE,
  "sort_order" integer NOT NULL
);
