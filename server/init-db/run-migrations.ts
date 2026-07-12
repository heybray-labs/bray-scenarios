import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { sql } from "drizzle-orm";
import { db, pool } from "../db.ts";
import { createLogger } from "@heybray/server-kit";

const log = createLogger("migrations");

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsFolder = path.join(serverRoot, "drizzle");

type JournalEntry = { tag: string; when: number };

function readJournalEntries(): JournalEntry[] {
  const journalPath = path.join(migrationsFolder, "meta", "_journal.json");
  const journal = JSON.parse(fs.readFileSync(journalPath, "utf8")) as {
    entries: Array<{ tag: string; when: number }>;
  };
  return journal.entries.map((entry) => ({ tag: entry.tag, when: entry.when }));
}

async function getLastAppliedCreatedAt(): Promise<number | null> {
  const tableExists = await db.execute<{ exists: boolean }>(sql`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'drizzle' AND table_name = '__drizzle_migrations'
    ) AS exists
  `);
  if (!tableExists.rows[0]?.exists) {
    return null;
  }

  const result = await db.execute<{ created_at: string }>(sql`
    SELECT created_at::text AS created_at
    FROM drizzle.__drizzle_migrations
    ORDER BY created_at DESC
    LIMIT 1
  `);
  const createdAt = result.rows[0]?.created_at;
  return createdAt == null ? null : Number(createdAt);
}

async function getPendingMigrations(): Promise<JournalEntry[]> {
  const entries = readJournalEntries();
  const lastApplied = await getLastAppliedCreatedAt();
  if (lastApplied == null) {
    return entries;
  }
  return entries.filter((entry) => entry.when > lastApplied);
}

/**
 * Databases created with drizzle-kit push have the schema but no migration history.
 * Stamp the baseline migration so only incremental migrations run on upgrade.
 */
async function stampBaselineIfLegacyDatabase() {
  const rolesTable = await db.execute<{ exists: boolean }>(sql`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'roles'
    ) AS exists
  `);
  const hasRolesTable = rolesTable.rows[0]?.exists === true;
  if (!hasRolesTable) {
    return;
  }

  await db.execute(sql`CREATE SCHEMA IF NOT EXISTS drizzle`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `);

  const migrationCount = await db.execute<{ count: string }>(sql`
    SELECT COUNT(*)::text AS count FROM drizzle.__drizzle_migrations
  `);
  if (Number(migrationCount.rows[0]?.count ?? 0) > 0) {
    return;
  }

  const migrations = readMigrationFiles({ migrationsFolder });
  const baseline = migrations[0];
  if (!baseline) {
    throw new Error("No baseline migration found in drizzle folder");
  }

  await db.execute(sql`
    INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
    VALUES (${baseline.hash}, ${baseline.folderMillis})
  `);

  log.info("Stamped baseline migration for legacy database", {
    tag: "0000_initial",
  });
}

export async function runMigrations() {
  await stampBaselineIfLegacyDatabase();

  log.info("Checking for migrations");

  const pending = await getPendingMigrations();
  if (pending.length === 0) {
    log.info("No migrations pending");
    return;
  }

  const migrationDb = drizzle(pool);
  await migrate(migrationDb, { migrationsFolder });

  for (const migration of pending) {
    log.info(`Applied migration ${migration.tag}`);
  }
}
