import { db } from "../db.ts";
import { roles } from "../../shared/schemas/roles.ts";
import { users } from "../../shared/schemas/users.ts";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";
import { createLogger } from "../utils/logger.ts";

const log = createLogger("init-db");

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const seedAdminFromEnv = Boolean(ADMIN_EMAIL && ADMIN_PASSWORD);

export async function initializeDatabase() {
  log.info("Running database init (drizzle push + seed)");

  const { execSync } = await import("child_process");
  const path = await import("path");
  const { fileURLToPath } = await import("url");
  const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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
