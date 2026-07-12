import { sql } from "drizzle-orm";
import { db, pool } from "../db.ts";

const TABLES_TO_TRUNCATE = [
  "roleplay_criterion_scores",
  "roleplay_messages",
  "roleplay_attempts",
  "roleplay_classification_links",
  "roleplay_criteria",
  "roleplay_personas",
  "roleplay_settings",
  "roleplays",
  "media_assets",
  "roleplay_allowed_persona_models",
  "roleplay_allowed_grader_models",
  "roleplay_provider_keys",
  "roleplay_app_config",
  "auth_exchange_codes",
  "user_identities",
  "teams",
  "users",
];

export async function resetMutableData(): Promise<void> {
  const tableList = TABLES_TO_TRUNCATE.join(", ");
  await db.execute(
    sql.raw(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`),
  );
}

export async function closeTestPool(): Promise<void> {
  await pool.end();
}
