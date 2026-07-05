import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcrypt";
import { and, eq, inArray, like, sql } from "drizzle-orm";
import { db, pool } from "../db.ts";
import { roles } from "../../shared/schemas/roles.ts";
import { users } from "../../shared/schemas/users.ts";
import { mediaAssets } from "../../shared/schemas/media-assets.ts";
import {
  roleplays,
  roleplaySettings,
  roleplayPersonas,
  roleplayCriteria,
  roleplayAttempts,
  roleplayMessages,
  roleplayCriterionScores,
} from "../../shared/schemas/roleplay-core.ts";
import {
  scenarioRewardTiers,
  userScenarioTierRewards,
  pointTransactions,
  DEFAULT_REWARD_TIERS,
  resolveRewardTierDisplay,
} from "../../shared/schemas/points.ts";
import { createLogger } from "../utils/logger.ts";
import { assertDatabaseConnection } from "./assert-db-connection.ts";
import { seedClassifications, categoryLabelToSlug } from "./seed-classifications.ts";
import { classificationService } from "../services/classification.service.ts";
import { mediaService, ensureMediaDir } from "../services/media.service.ts";
import { pointsController } from "../controllers/points.controller.ts";
import {
  DEMO_SCENARIOS,
  DEMO_SCENARIO_TITLES,
  getBandForTargetScore,
  pickScoreInBand,
} from "./demo-data/scenarios.ts";
import {
  ALL_DEMO_USERS,
  DEMO_PASSWORD,
  DEMO_USER_EMAILS,
} from "./demo-data/users.ts";
import type { DemoScenario, ScoreBandId } from "./demo-data/types.ts";

const log = createLogger("seed-demo");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COVERS_DIR = path.join(__dirname, "demo-data/covers");
const DEMO_COVER_PREFIX = "demo-cover-";

/** Deterministic pseudo-random in [0, 1). */
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9999.123) * 10000;
  return x - Math.floor(x);
}

async function ensureRoles() {
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

  for (const def of roleDefs) {
    const [existing] = await db.select().from(roles).where(eq(roles.name, def.name)).limit(1);
    if (!existing) {
      await db.insert(roles).values({
        name: def.name,
        description: def.description,
        permissions: def.permissions,
        isGlobal: false,
      });
      log.info("Created role", { name: def.name });
    }
  }
}

async function wipeDemoData() {
  log.info("Wiping previous demo data…");

  const demoRoleplays = await db
    .select({ id: roleplays.id })
    .from(roleplays)
    .where(inArray(roleplays.title, DEMO_SCENARIO_TITLES));

  if (demoRoleplays.length) {
    await db.delete(roleplays).where(inArray(roleplays.title, DEMO_SCENARIO_TITLES));
    log.info("Removed demo roleplays", { count: demoRoleplays.length });
  }

  const demoMedia = await db
    .select()
    .from(mediaAssets)
    .where(like(mediaAssets.storageKey, `${DEMO_COVER_PREFIX}%`));

  for (const asset of demoMedia) {
    try {
      const filePath = mediaService.resolvePath(asset);
      await fs.unlink(filePath).catch(() => undefined);
    } catch {
      /* ignore */
    }
  }

  if (demoMedia.length) {
    await db.delete(mediaAssets).where(like(mediaAssets.storageKey, `${DEMO_COVER_PREFIX}%`));
    log.info("Removed demo cover media", { count: demoMedia.length });
  }

  const demoUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.email, DEMO_USER_EMAILS));

  if (demoUsers.length) {
    await db.delete(users).where(inArray(users.email, DEMO_USER_EMAILS));
    log.info("Removed demo users", { count: demoUsers.length });
  }
}

async function loadCoverImage(slug: string): Promise<Buffer> {
  const jpgPath = path.join(COVERS_DIR, `${slug}.jpg`);
  const webpPath = path.join(COVERS_DIR, `${slug}.webp`);
  try {
    return await fs.readFile(jpgPath);
  } catch {
    return fs.readFile(webpPath);
  }
}

async function seedScenarios(adminUserId: number) {
  const created: { scenario: DemoScenario; roleplayId: number }[] = [];

  for (const scenario of DEMO_SCENARIOS) {
    const [roleplay] = await db
      .insert(roleplays)
      .values({
        title: scenario.title,
        description: `${scenario.category} scenario: practice ${scenario.learnerObjective.toLowerCase()}`,
        introduction: scenario.introduction,
        learnerRole: scenario.learnerRole,
        situationContext: scenario.situationContext,
        learnerObjective: scenario.learnerObjective,
        status: "published",
        published: true,
        createdBy: adminUserId,
      })
      .returning();

    await classificationService.setRoleplayClassifications(roleplay.id, {
      category: categoryLabelToSlug(scenario.category),
      audienceLevel: scenario.audienceLevel,
      duration: scenario.duration,
      tags: scenario.tags,
    });

    await db.insert(roleplaySettings).values({
      roleplayId: roleplay.id,
      passThreshold: 70,
      maxAttempts: 3,
      maxTurns: 20,
      allowManualEnd: true,
      showTranscript: true,
      showRubricBreakdown: true,
      personaProvider: "openai",
      personaModel: "gpt-4o-mini",
      graderProvider: "openai",
      graderModel: "gpt-4o-mini",
    });

    await db.insert(roleplayPersonas).values({
      roleplayId: roleplay.id,
      ...scenario.persona,
    });

    for (let i = 0; i < scenario.criteria.length; i++) {
      const c = scenario.criteria[i];
      await db.insert(roleplayCriteria).values({
        roleplayId: roleplay.id,
        name: c.name,
        description: c.description,
        weight: "1.0",
        maxScore: 100,
        orderIndex: i,
      });
    }

    for (let i = 0; i < DEFAULT_REWARD_TIERS.length; i++) {
      const tier = DEFAULT_REWARD_TIERS[i];
      const display = resolveRewardTierDisplay(tier);
      await db.insert(scenarioRewardTiers).values({
        roleplayId: roleplay.id,
        tierName: tier.tierName,
        minScorePercent: tier.minScorePercent,
        rewardPoints: tier.rewardPoints,
        orderIndex: i,
        color: tier.color ?? display.color,
        icon: tier.icon ?? display.icon,
      });
    }

    const coverBuffer = await loadCoverImage(scenario.slug);
    const coverAsset = await mediaService.createFromBuffer(coverBuffer, {
      originalFilename: `demo-cover-${scenario.slug}.jpg`,
      mimeType: "image/jpeg",
      createdBy: adminUserId,
      storageKey: `${DEMO_COVER_PREFIX}${scenario.slug}.jpg`,
    });

    await db
      .update(roleplays)
      .set({ coverImageMediaId: coverAsset.id, updatedAt: new Date() })
      .where(eq(roleplays.id, roleplay.id));

    created.push({ scenario, roleplayId: roleplay.id });
    log.info("Seeded scenario", { id: roleplay.id, title: scenario.title });
  }

  return created;
}

async function seedUsers() {
  const [adminRole] = await db.select().from(roles).where(eq(roles.name, "admin")).limit(1);
  const [userRole] = await db.select().from(roles).where(eq(roles.name, "user")).limit(1);

  if (!adminRole || !userRole) {
    throw new Error("Required roles not found — run db:init first or ensure roles are seeded.");
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const userIds = new Map<string, number>();

  for (const def of ALL_DEMO_USERS) {
    const roleId = def.role === "admin" ? adminRole.id : userRole.id;
    const [created] = await db
      .insert(users)
      .values({
        email: def.email.toLowerCase(),
        firstName: def.firstName,
        password: passwordHash,
        roleId,
        isEmailVerified: true,
        approvalStatus: "approved",
        mustChangePassword: false,
        isActive: true,
      })
      .returning({ id: users.id, email: users.email });
    userIds.set(created.email, created.id);
  }

  return userIds;
}

type LearnerProfile = {
  userId: number;
  email: string;
  firstName: string;
  preferredBand: ScoreBandId;
};

function buildLearnerProfiles(userIds: Map<string, number>): LearnerProfile[] {
  const bands: ScoreBandId[] = [
    "high",
    "high",
    "high",
    "mid",
    "mid",
    "mid",
    "mid",
    "mid",
    "low",
    "low",
    "low",
    "low",
  ];

  return ALL_DEMO_USERS.filter((u) => u.role === "user").map((u, i) => ({
    userId: userIds.get(u.email.toLowerCase())!,
    email: u.email,
    firstName: u.firstName,
    preferredBand: bands[i] ?? "mid",
  }));
}

function randomDateWithinDays(daysAgo: number, seed: number): Date {
  const now = Date.now();
  const offsetMs = Math.floor(seededRandom(seed) * daysAgo * 24 * 60 * 60 * 1000);
  return new Date(now - offsetMs);
}

function pickScenariosForLearner(learnerIndex: number, allScenarios: DemoScenario[]): DemoScenario[] {
  const count = 7 + Math.floor(seededRandom(learnerIndex * 17) * 4);
  const shuffled = [...allScenarios].sort(
    (a, b) =>
      seededRandom(learnerIndex * 100 + a.title.length) -
      seededRandom(learnerIndex * 100 + b.title.length),
  );
  return shuffled.slice(0, count);
}

async function seedAttempts(
  scenarios: { scenario: DemoScenario; roleplayId: number }[],
  learnerProfiles: LearnerProfile[],
) {
  ensureMediaDir();
  let attemptCount = 0;
  let completedCount = 0;
  let inProgressCount = 0;
  let seedCounter = 0;

  const criterionMap = new Map<number, { id: number; name: string }[]>();
  for (const { roleplayId } of scenarios) {
    const criteria = await db
      .select({ id: roleplayCriteria.id, name: roleplayCriteria.name })
      .from(roleplayCriteria)
      .where(eq(roleplayCriteria.roleplayId, roleplayId));
    criterionMap.set(roleplayId, criteria);
  }

  for (let li = 0; li < learnerProfiles.length; li++) {
    const learner = learnerProfiles[li];
    const picked = pickScenariosForLearner(
      li,
      scenarios.map((s) => s.scenario),
    );

    for (const scenarioEntry of scenarios) {
      if (!picked.some((p) => p.slug === scenarioEntry.scenario.slug)) continue;

      const { scenario, roleplayId } = scenarioEntry;
      const criteria = criterionMap.get(roleplayId) ?? [];
      const numAttempts = seededRandom(li * 31 + roleplayId) < 0.22 ? 2 : 1;

      for (let attemptNum = 1; attemptNum <= numAttempts; attemptNum++) {
        seedCounter++;
        const isInProgress = inProgressCount < 5 && seededRandom(seedCounter * 7) < 0.08;
        const daysAgo = seededRandom(seedCounter) < 0.45 ? 25 : 70;
        const startedAt = randomDateWithinDays(daysAgo, seedCounter);
        const timeSpent = 480 + Math.floor(seededRandom(seedCounter + 1) * 720);

        if (isInProgress && attemptNum === 1) {
          await db.insert(roleplayAttempts).values({
            roleplayId,
            userId: learner.userId,
            attemptNumber: attemptNum,
            status: "in_progress",
            gradingStatus: "pending",
            turnCount: 3 + Math.floor(seededRandom(seedCounter) * 5),
            startedAt,
            personaProvider: "openai",
            personaModel: "gpt-4o-mini",
          });
          attemptCount++;
          inProgressCount++;
          continue;
        }

        const bandShift = attemptNum === 2 ? "high" : learner.preferredBand;
        const bandScenario =
          scenario.scoreBands.find((b) => b.band === bandShift) ?? scenario.scoreBands[1];
        const targetScore = pickScoreInBand(bandScenario!);
        const bandContent = getBandForTargetScore(scenario, targetScore);
        const completedAt = new Date(startedAt.getTime() + timeSpent * 1000);
        const isPassed = targetScore >= 70;

        const [attempt] = await db
          .insert(roleplayAttempts)
          .values({
            roleplayId,
            userId: learner.userId,
            attemptNumber: attemptNum,
            score: targetScore.toFixed(2),
            turnCount: bandContent.messages.length,
            startedAt,
            completedAt,
            timeSpent,
            status: "completed",
            endReason: "manual",
            isPassed,
            gradingStatus: "auto_graded",
            gradedAt: completedAt,
            overallFeedback: bandContent.overallFeedback,
            personaProvider: "openai",
            personaModel: "gpt-4o-mini",
            graderProvider: "openai",
            graderModel: "gpt-4o-mini",
          })
          .returning();

        let turnNumber = 1;
        for (const msg of bandContent.messages) {
          await db.insert(roleplayMessages).values({
            attemptId: attempt.id,
            role: msg.role,
            turnNumber: turnNumber++,
            content: msg.content,
          });
        }

        await db.insert(roleplayMessages).values({
          attemptId: attempt.id,
          role: "ended",
          turnNumber: turnNumber,
          content: "Session ended",
        });

        for (const cs of bandContent.criterionScores) {
          const criterion = criteria.find((c) => c.name === cs.criterionName);
          if (!criterion) continue;
          await db.insert(roleplayCriterionScores).values({
            attemptId: attempt.id,
            criterionId: criterion.id,
            score: cs.score.toFixed(2),
            maxScore: 100,
            feedback: cs.feedback,
            strengths: cs.strengths,
            improvements: cs.improvements,
            gradedAt: completedAt,
          });
        }

        await pointsController.awardPointsForAttempt(
          attempt,
          scenario.title,
          learner.userId,
          targetScore,
        );

        await db
          .update(pointTransactions)
          .set({ createdAt: completedAt })
          .where(
            and(
              eq(pointTransactions.attemptId, attempt.id),
              eq(pointTransactions.userId, learner.userId),
            ),
          );

        await db
          .update(userScenarioTierRewards)
          .set({ updatedAt: completedAt })
          .where(
            and(
              eq(userScenarioTierRewards.userId, learner.userId),
              eq(userScenarioTierRewards.roleplayId, roleplayId),
            ),
          );

        attemptCount++;
        completedCount++;
      }
    }
  }

  return { attemptCount, completedCount, inProgressCount };
}

async function seedDemo() {
  await assertDatabaseConnection();
  await ensureRoles();
  await seedClassifications();
  await wipeDemoData();

  const userIds = await seedUsers();
  const adminId = userIds.get("admin@demo.local");
  if (!adminId) throw new Error("Failed to create demo admin user");

  const scenarios = await seedScenarios(adminId);
  const learnerProfiles = buildLearnerProfiles(userIds);
  const { attemptCount, completedCount, inProgressCount } = await seedAttempts(
    scenarios,
    learnerProfiles,
  );

  const [pointsRow] = await db
    .select({ total: sql<number>`count(*)` })
    .from(pointTransactions);

  console.log("\n========================================");
  console.log("  Demo database seeded successfully");
  console.log("========================================\n");
  console.log(`Scenarios:  ${scenarios.length} published with cover images & reward tiers`);
  console.log(`Users:      ${ALL_DEMO_USERS.length} (1 admin + ${learnerProfiles.length} learners)`);
  console.log(`Attempts:   ${attemptCount} (${completedCount} completed, ${inProgressCount} in progress)`);
  console.log(`Point txns: ${Number(pointsRow?.total ?? 0)}\n`);
  console.log("Login credentials (all accounts):");
  console.log(`  Password: ${DEMO_PASSWORD}\n`);
  console.log("  Admin:  admin@demo.local");
  console.log("  Learners:");
  for (const u of ALL_DEMO_USERS.filter((x) => x.role === "user")) {
    console.log(`    ${u.email} (${u.firstName})`);
  }
  console.log("\nRun the app and log in as any learner for leaderboard screenshots.");
  console.log("Log in as admin@demo.local for scenario management screenshots.\n");
}

seedDemo()
  .then(() => pool.end())
  .catch((err) => {
    log.error("Demo seed failed", err instanceof Error ? err : undefined);
    console.error(err);
    pool.end().finally(() => process.exit(1));
  });
