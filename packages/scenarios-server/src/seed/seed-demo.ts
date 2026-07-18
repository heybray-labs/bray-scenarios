import bcrypt from "bcrypt";
import { and, eq, inArray, like, sql } from "drizzle-orm";
import { db } from "@heybray/server-kit";
import { roles, users } from "@heybray/identity/schema";
import { mediaAssets } from "@heybray/media/schema";
import { contentClassificationLinks } from "@heybray/taxonomy/schema";
import {
  roleplays,
  roleplaySettings,
  roleplayPersonas,
  roleplayCriteria,
  roleplayAttempts,
  roleplayMessages,
  roleplayCriterionScores,
} from "../schema/roleplay-core.ts";
import {
  rewardTiers as gamRewardTiers,
  pointTransactions,
  userContentTierAwards,
  activityLog,
  gamificationContent,
  resolveRewardTierDisplay,
  tierNameFromStarLevel,
} from "@heybray/gamification/schema";
import { createLogger } from "@heybray/server-kit";
import { assertDatabaseConnection } from "./assert-db-connection.ts";
import { seedClassifications, categoryLabelToSlug } from "./seed-classifications.ts";
import { mediaService, getStorageProvider, initStorage } from "@heybray/media";
import { gamification, SCENARIO_CONTENT_TYPE } from "../gamification.ts";
import * as scenarioClassifications from "../lib/scenario-classifications.ts";
import {
  DEMO_SCENARIOS,
  DEMO_TITLE_PREFIX,
  buildDemoScenarios,
  getBandForTargetScore,
} from "./demo-data/scenarios.ts";
import {
  ALL_DEMO_USERS,
  DEMO_PASSWORD,
  DEMO_EMAIL_DOMAIN,
  buildDemoUsers,
} from "./demo-data/users.ts";
import {
  intendedStarTier,
  pickScenariosForLearner,
  STAR_TIER_SCORE,
} from "./demo-data/tier-progress.ts";
import type { DemoScenario, ScoreBandId } from "./demo-data/types.ts";
import { renderDemoCoverImage } from "./demo-data/demo-cover-images.ts";

const DEMO_COVER_PREFIX = "demo-cover-";

const log = createLogger("seed-demo");

export type SeedDemoCounts = {
  users?: number;
  scenarios?: number;
  attempts?: number;
};

export type SeedDemoOptions = {
  counts?: SeedDemoCounts;
};

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

async function wipeDemoGamification(demoRoleplayIds: number[], demoUserIds: number[]) {
  if (demoRoleplayIds.length) {
    await db
      .delete(pointTransactions)
      .where(
        and(
          eq(pointTransactions.contentType, SCENARIO_CONTENT_TYPE),
          inArray(pointTransactions.contentId, demoRoleplayIds),
        ),
      );
    await db
      .delete(activityLog)
      .where(
        and(
          eq(activityLog.contentType, SCENARIO_CONTENT_TYPE),
          inArray(activityLog.contentId, demoRoleplayIds),
        ),
      );
    await db
      .delete(userContentTierAwards)
      .where(
        and(
          eq(userContentTierAwards.contentType, SCENARIO_CONTENT_TYPE),
          inArray(userContentTierAwards.contentId, demoRoleplayIds),
        ),
      );
    await db
      .delete(gamRewardTiers)
      .where(
        and(
          eq(gamRewardTiers.contentType, SCENARIO_CONTENT_TYPE),
          inArray(gamRewardTiers.contentId, demoRoleplayIds),
        ),
      );
    await db
      .delete(contentClassificationLinks)
      .where(
        and(
          eq(contentClassificationLinks.contentType, SCENARIO_CONTENT_TYPE),
          inArray(contentClassificationLinks.contentId, demoRoleplayIds),
        ),
      );
    await db
      .delete(gamificationContent)
      .where(
        and(
          eq(gamificationContent.contentType, SCENARIO_CONTENT_TYPE),
          inArray(gamificationContent.contentId, demoRoleplayIds),
        ),
      );
  }

  if (demoUserIds.length) {
    await db.delete(pointTransactions).where(inArray(pointTransactions.userId, demoUserIds));
    await db.delete(activityLog).where(inArray(activityLog.userId, demoUserIds));
    await db.delete(userContentTierAwards).where(inArray(userContentTierAwards.userId, demoUserIds));
  }
}

async function deleteMediaAssets(assets: { id: number; storageKey: string }[]) {
  for (const asset of assets) {
    await getStorageProvider()
      .delete(asset.storageKey)
      .catch(() => undefined);
  }
  if (assets.length) {
    await db.delete(mediaAssets).where(inArray(mediaAssets.id, assets.map((a) => a.id)));
  }
}

async function wipeDemoMedia(demoUserIds: number[]) {
  const byPrefix = await db
    .select({ id: mediaAssets.id, storageKey: mediaAssets.storageKey })
    .from(mediaAssets)
    .where(like(mediaAssets.storageKey, `${DEMO_COVER_PREFIX}%`));

  const byCreator = demoUserIds.length
    ? await db
        .select({ id: mediaAssets.id, storageKey: mediaAssets.storageKey })
        .from(mediaAssets)
        .where(inArray(mediaAssets.createdBy, demoUserIds))
    : [];

  const seen = new Set<number>();
  const toDelete = [...byPrefix, ...byCreator].filter((asset) => {
    if (seen.has(asset.id)) return false;
    seen.add(asset.id);
    return true;
  });

  if (toDelete.length) {
    await deleteMediaAssets(toDelete);
    log.info("Removed demo media assets", { count: toDelete.length });
  }
}

export async function wipeDemo() {
  log.info("Wiping demo data…");
  await assertDatabaseConnection();
  await initStorage();

  const demoRoleplays = await db
    .select({ id: roleplays.id })
    .from(roleplays)
    .where(like(roleplays.title, `${DEMO_TITLE_PREFIX}%`));

  const demoUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(like(users.email, `%@${DEMO_EMAIL_DOMAIN}`));

  const demoRoleplayIds = demoRoleplays.map((row) => row.id);
  const demoUserIds = demoUsers.map((row) => row.id);

  await wipeDemoGamification(demoRoleplayIds, demoUserIds);

  if (demoRoleplayIds.length) {
    await db.delete(roleplays).where(like(roleplays.title, `${DEMO_TITLE_PREFIX}%`));
    log.info("Removed demo roleplays", { count: demoRoleplayIds.length });
  }

  await wipeDemoMedia(demoUserIds);

  if (demoUserIds.length) {
    await db.delete(users).where(like(users.email, `%@${DEMO_EMAIL_DOMAIN}`));
    log.info("Removed demo users", { count: demoUserIds.length });
  }
}

async function seedScenarios(adminUserId: number, scenarioDefs: DemoScenario[]) {
  const created: { scenario: DemoScenario; roleplayId: number }[] = [];

  for (const scenario of scenarioDefs) {
    const [roleplay] = await db
      .insert(roleplays)
      .values({
        title: scenario.title,
        description: scenario.description,
        introduction: scenario.introduction,
        learnerRole: scenario.learnerRole,
        situationContext: scenario.situationContext,
        learnerObjective: scenario.learnerObjective,
        playbook: scenario.playbook,
        status: "published",
        published: true,
        createdBy: adminUserId,
      })
      .returning();

    await scenarioClassifications.setRoleplayClassifications(roleplay.id, {
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

    for (let i = 0; i < scenario.rewardTiers.length; i++) {
      const tier = scenario.rewardTiers[i];
      const display = resolveRewardTierDisplay(tier);
      await db.insert(gamRewardTiers).values({
        contentType: SCENARIO_CONTENT_TYPE,
        contentId: roleplay.id,
        tierName: tier.tierName ?? tierNameFromStarLevel(tier.starLevel ?? i + 1),
        minScorePercent: tier.minScorePercent,
        rewardPoints: tier.rewardPoints,
        orderIndex: tier.orderIndex ?? i,
        starLevel: tier.starLevel ?? i + 1,
        color: display.color,
        icon: null,
      });
    }

    await gamification.syncContent([
      {
        contentType: SCENARIO_CONTENT_TYPE,
        contentId: roleplay.id,
        title: roleplay.title,
        isActive: true,
      },
    ]);

    const coverBuffer = await renderDemoCoverImage(scenario.slug);
    const coverAsset = await mediaService.createFromBuffer(coverBuffer, {
      originalFilename: "cover.png",
      mimeType: "image/png",
      createdBy: adminUserId,
      storageKey: `${DEMO_COVER_PREFIX}${scenario.slug}.png`,
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

async function seedUsers(userDefs: typeof ALL_DEMO_USERS) {
  const [adminRole] = await db.select().from(roles).where(eq(roles.name, "admin")).limit(1);
  const [userRole] = await db.select().from(roles).where(eq(roles.name, "user")).limit(1);

  if (!adminRole || !userRole) {
    throw new Error("Required roles not found — run db:init first or ensure roles are seeded.");
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const userIds = new Map<string, number>();

  for (const def of userDefs) {
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

function buildLearnerProfiles(
  userIds: Map<string, number>,
  userDefs: typeof ALL_DEMO_USERS,
): LearnerProfile[] {
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

  return userDefs.filter((u) => u.role === "user").map((u, i) => ({
    userId: userIds.get(u.email.toLowerCase())!,
    email: u.email,
    firstName: u.firstName,
    preferredBand: bands[i % bands.length] ?? "mid",
  }));
}

function randomDateWithinDays(daysAgo: number, seed: number): Date {
  const now = Date.now();
  const offsetMs = Math.floor(seededRandom(seed) * daysAgo * 24 * 60 * 60 * 1000);
  return new Date(now - offsetMs);
}

async function seedAttempts(
  scenarios: { scenario: DemoScenario; roleplayId: number }[],
  learnerProfiles: LearnerProfile[],
) {
  await initStorage();
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
      const scenarioIndex = picked.findIndex((p) => p.slug === scenarioEntry.scenario.slug);
      if (scenarioIndex < 0) continue;

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

        const starTier = intendedStarTier(learner.preferredBand, scenarioIndex, attemptNum);
        const targetScore = STAR_TIER_SCORE[starTier];
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

        await gamification.recordResult({
          userId: learner.userId,
          contentType: SCENARIO_CONTENT_TYPE,
          contentId: roleplayId,
          activityId: attempt.id,
          scorePercent: targetScore,
          passed: targetScore >= 70,
          occurredAt: completedAt,
          eligibleForAward: true,
        });

        await db
          .update(pointTransactions)
          .set({ createdAt: completedAt })
          .where(
            and(
              eq(pointTransactions.activityId, attempt.id),
              eq(pointTransactions.userId, learner.userId),
            ),
          );

        await db
          .update(userContentTierAwards)
          .set({ updatedAt: completedAt })
          .where(
            and(
              eq(userContentTierAwards.userId, learner.userId),
              eq(userContentTierAwards.contentType, SCENARIO_CONTENT_TYPE),
              eq(userContentTierAwards.contentId, roleplayId),
            ),
          );

        await db
          .update(activityLog)
          .set({ occurredAt: completedAt })
          .where(
            and(
              eq(activityLog.activityId, attempt.id),
              eq(activityLog.userId, learner.userId),
            ),
          );

        attemptCount++;
        completedCount++;
      }
    }
  }

  return { attemptCount, completedCount, inProgressCount };
}

async function seedAttemptsWithTarget(
  scenarios: { scenario: DemoScenario; roleplayId: number }[],
  learnerProfiles: LearnerProfile[],
  targetCount: number,
) {
  if (!learnerProfiles.length || !scenarios.length) {
    throw new Error("Cannot seed attempts without learners and scenarios");
  }

  await initStorage();

  const criterionMap = new Map<number, { id: number; name: string }[]>();
  for (const { roleplayId } of scenarios) {
    const criteria = await db
      .select({ id: roleplayCriteria.id, name: roleplayCriteria.name })
      .from(roleplayCriteria)
      .where(eq(roleplayCriteria.roleplayId, roleplayId));
    criterionMap.set(roleplayId, criteria);
  }

  let attemptCount = 0;
  let seedCounter = 0;

  for (let i = 0; i < targetCount; i++) {
    const learner = learnerProfiles[i % learnerProfiles.length]!;
    const scenarioEntry = scenarios[i % scenarios.length]!;
    const { scenario, roleplayId } = scenarioEntry;
    const criteria = criterionMap.get(roleplayId) ?? [];
    const scenarioIndex = i % scenarios.length;
    const attemptNum = Math.floor(i / scenarios.length) + 1;

    seedCounter++;
    const daysAgo = seededRandom(seedCounter) < 0.45 ? 25 : 70;
    const startedAt = randomDateWithinDays(daysAgo, seedCounter);
    const timeSpent = 480 + Math.floor(seededRandom(seedCounter + 1) * 720);

    const starTier = intendedStarTier(learner.preferredBand, scenarioIndex, attemptNum);
    const targetScore = STAR_TIER_SCORE[starTier];
    const bandContent = getBandForTargetScore(scenario, targetScore);
    const completedAt = new Date(startedAt.getTime() + timeSpent * 1000);

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
        isPassed: targetScore >= 70,
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

    await gamification.recordResult({
      userId: learner.userId,
      contentType: SCENARIO_CONTENT_TYPE,
      contentId: roleplayId,
      activityId: attempt.id,
      scorePercent: targetScore,
      passed: targetScore >= 70,
      occurredAt: completedAt,
      eligibleForAward: true,
    });

    await db
      .update(pointTransactions)
      .set({ createdAt: completedAt })
      .where(
        and(
          eq(pointTransactions.activityId, attempt.id),
          eq(pointTransactions.userId, learner.userId),
        ),
      );

    await db
      .update(userContentTierAwards)
      .set({ updatedAt: completedAt })
      .where(
        and(
          eq(userContentTierAwards.userId, learner.userId),
          eq(userContentTierAwards.contentType, SCENARIO_CONTENT_TYPE),
          eq(userContentTierAwards.contentId, roleplayId),
        ),
      );

    await db
      .update(activityLog)
      .set({ occurredAt: completedAt })
      .where(
        and(
          eq(activityLog.activityId, attempt.id),
          eq(activityLog.userId, learner.userId),
        ),
      );

    attemptCount++;
  }

  return { attemptCount, completedCount: attemptCount, inProgressCount: 0 };
}

export async function seedDemo(options: SeedDemoOptions = {}) {
  const { counts } = options;
  const userDefs = buildDemoUsers(counts?.users ?? ALL_DEMO_USERS.length);
  const scenarioDefs = buildDemoScenarios(counts?.scenarios ?? DEMO_SCENARIOS.length);

  await assertDatabaseConnection();
  await ensureRoles();
  await seedClassifications();
  await wipeDemo();

  const userIds = await seedUsers(userDefs);
  const adminId = userIds.get("admin@demo.local");
  if (!adminId) throw new Error("Failed to create demo admin user");

  await initStorage();
  const scenarios = await seedScenarios(adminId, scenarioDefs);
  const learnerProfiles = buildLearnerProfiles(userIds, userDefs);

  const attemptResult =
    counts?.attempts != null
      ? await seedAttemptsWithTarget(scenarios, learnerProfiles, counts.attempts)
      : await seedAttempts(scenarios, learnerProfiles);

  const { attemptCount, completedCount, inProgressCount } = attemptResult;

  const [pointsRow] = await db
    .select({ total: sql<number>`count(*)` })
    .from(pointTransactions);

  console.log("\n========================================");
  console.log("  Demo database seeded successfully");
  console.log("========================================\n");
  console.log(`Scenarios:  ${scenarios.length} published with cover images & reward tiers`);
  console.log(`Users:      ${userDefs.length} (1 admin + ${learnerProfiles.length} learners)`);
  console.log(`Attempts:   ${attemptCount} (${completedCount} completed, ${inProgressCount} in progress)`);
  console.log(`Point txns: ${Number(pointsRow?.total ?? 0)}\n`);
  console.log("Login credentials (all accounts):");
  console.log(`  Password: ${DEMO_PASSWORD}\n`);
  console.log("  Admin:  admin@demo.local");
  console.log("  Learners:");
  for (const u of userDefs.filter((x) => x.role === "user")) {
    console.log(`    ${u.email} (${u.firstName})`);
  }
  console.log("\nRun the app and log in as any learner for leaderboard screenshots.");
  console.log("Log in as admin@demo.local for scenario management screenshots.\n");
}
