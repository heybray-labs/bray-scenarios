import { db } from "../db.ts";
import { roles } from "../../shared/schemas/roles.ts";
import { users } from "../../shared/schemas/users.ts";
import { eq, sql } from "drizzle-orm";
import bcrypt from "bcrypt";
import { createLogger } from "../utils/logger.ts";
import { seedClassifications } from "./seed-classifications.ts";

const log = createLogger("init-db");

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const seedAdminFromEnv = Boolean(ADMIN_EMAIL && ADMIN_PASSWORD);

/**
 * Apply media-library schema changes without drizzle-kit interactive prompts.
 * Drizzle treats cover_image_url → cover_image_media_id as a rename and asks
 * for confirmation, which fails in Docker/CI (no TTY).
 */
async function ensureMediaSchema() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS media_assets (
      id serial PRIMARY KEY,
      original_filename text NOT NULL,
      mime_type text NOT NULL,
      size_bytes integer NOT NULL,
      storage_key text NOT NULL UNIQUE,
      created_by integer REFERENCES users(id),
      created_at timestamp NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
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
    END $$
  `);

  await db.execute(sql`
    ALTER TABLE roleplays DROP COLUMN IF EXISTS cover_image_url
  `);

  await db.execute(sql`
    ALTER TABLE roleplays DROP COLUMN IF EXISTS category
  `);

  await db.execute(sql`
    ALTER TABLE roleplays DROP COLUMN IF EXISTS tags
  `);

  log.info("Media schema ensured (media_assets + cover_image_media_id)");
}

async function ensureClassificationOptionDisplayColumns() {
  await db.execute(sql`
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
    END $$
  `);
}

async function assertDatabaseConnection() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is not set. Configure it in .env (see .env.example).",
    );
  }

  try {
    await db.execute(sql`SELECT 1`);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const hints: string[] = [];

    if (databaseUrl.includes("@db:")) {
      hints.push(
        "DATABASE_URL uses Docker hostname db — run `docker compose up -d db` (from repo root), or set DATABASE_URL to your local Postgres (e.g. localhost:5432).",
      );
    } else if (databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1")) {
      hints.push(
        "No Postgres is listening on that host/port — start your local Postgres service, or run `docker compose up -d db` and expose port 5432.",
      );
    }

    hints.push("For local dev, npm run db:init reads ../.env (not .env.local).");

    throw new Error(
      `Cannot connect to database.\n  DATABASE_URL=${databaseUrl}\n  ${detail}\n\n${hints.join("\n  ")}`,
    );
  }
}

export async function initializeDatabase() {
  log.info("Running database init (drizzle push + seed)");

  await assertDatabaseConnection();

  const { execSync } = await import("child_process");
  const path = await import("path");
  const { fileURLToPath } = await import("url");
  const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

  // Resolve column rename/drop before drizzle push so it does not prompt.
  try {
    await ensureMediaSchema();
  } catch (error) {
    log.warn("ensureMediaSchema failed — roleplays table may not exist yet", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    execSync("npm run db:push", {
      cwd: serverRoot,
      stdio: "inherit",
      env: process.env as NodeJS.ProcessEnv,
    });
  } catch (error) {
    log.warn("drizzle push failed — tables may already exist", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Re-run after push in case roleplays was created for the first time.
  try {
    await ensureMediaSchema();
    await ensureClassificationOptionDisplayColumns();
  } catch (error) {
    log.warn("ensureMediaSchema failed after push", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  await seedDatabase();
}

async function seedDatabase() {
  const summary = {
    rolesCreated: 0,
    adminSeeded: false,
    adminSkipped: false,
  };

  const roleDefs = [
    {
      name: "admin",
      description: "Administrator with full roleplay management",
      permissions: ["roleplay:manage"],
    },
    {
      name: "user",
      description: "User who can take roleplays",
      permissions: [],
    },
  ];

  const [legacyLearnerRole] = await db
    .select()
    .from(roles)
    .where(eq(roles.name, "learner"))
    .limit(1);
  if (legacyLearnerRole) {
    await db
      .update(roles)
      .set({
        name: "user",
        description: "User who can take roleplays",
      })
      .where(eq(roles.name, "learner"));
    log.info("Renamed role learner → user");
  }

  for (const def of roleDefs) {
    const [existing] = await db
      .select()
      .from(roles)
      .where(eq(roles.name, def.name))
      .limit(1);
    if (!existing) {
      await db.insert(roles).values({
        name: def.name,
        description: def.description,
        permissions: def.permissions,
        isGlobal: false,
      });
      summary.rolesCreated++;
      log.info("Created role", { name: def.name });
    } else {
      log.debug("Role already exists", { name: def.name, skipped: true });
    }
  }

  try {
    await seedClassifications();
  } catch (error) {
    log.warn("Classification seed failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  if (!seedAdminFromEnv) {
    summary.adminSkipped = true;
    log.info(
      "Skipping admin user seed — set ADMIN_EMAIL and ADMIN_PASSWORD to seed, or create via setup UI",
    );
    log.info("Database seed complete", summary);
    return;
  }

  const [adminRole] = await db.select().from(roles).where(eq(roles.name, "admin")).limit(1);
  if (!adminRole) {
    log.info("Database seed complete", summary);
    return;
  }

  const [existingAdmin] = await db
    .select()
    .from(users)
    .where(eq(users.email, ADMIN_EMAIL!.toLowerCase()))
    .limit(1);

  if (!existingAdmin) {
    const hashed = await bcrypt.hash(ADMIN_PASSWORD!, 10);
    await db.insert(users).values({
      email: ADMIN_EMAIL!.toLowerCase(),
      password: hashed,
      firstName: "Admin",
      roleId: adminRole.id,
      isEmailVerified: true,
      approvalStatus: "approved",
      mustChangePassword: true,
    });
    summary.adminSeeded = true;
    log.info("Created admin user from env", { email: ADMIN_EMAIL });
  } else {
    log.debug("Admin user already exists", { skipped: true });
  }

  log.info("Database seed complete", summary);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  initializeDatabase()
    .then(() => {
      log.info("Database init complete");
      return import("../db.ts").then(({ pool }) => pool.end());
    })
    .catch((err) => {
      log.error("Database init failed", err instanceof Error ? err : undefined);
      process.exit(1);
    });
}
