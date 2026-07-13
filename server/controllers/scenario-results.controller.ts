import { db } from "../db.ts";
import { and, eq, inArray } from "drizzle-orm";
import {
  roleplayAttempts,
  roleplaySettings,
  roleplayCriteria,
  roleplayCriterionScores,
} from "../../shared/schemas/roleplay-core.ts";
import type { RoleplayAttempt } from "../../shared/schemas/roleplay-core.ts";
import { gamification, SCENARIO_CONTENT_TYPE } from "../gamification.ts";
import type { ProgressTier } from "@heybray/gamification";

export type ScenarioProgressTier = ProgressTier;

export type CriterionBest = {
  criterionId: number;
  name: string;
  bestScore: number;
};

export type ScenarioProgress = {
  bestScore: number | null;
  attemptCount: number;
  remainingAttempts: number | null;
  pointsEarned: number;
  currentTier: ScenarioProgressTier | null;
  nextTier: ScenarioProgressTier | null;
  criterionBests: CriterionBest[];
  lastTopImprovement: string | null;
};

/**
 * App-owned scenario results/progress composition. The generic tier/points math
 * lives in @heybray/gamification; this controller owns the roleplay-specific
 * attempt/criterion/max-attempts logic and assembles the exact client payloads.
 */
export class ScenarioResultsController {
  getTopImprovementFromScores(
    scores: Array<{
      score: string | number | null;
      maxScore: number;
      improvements: string | null;
    }>,
  ): string | null {
    if (!scores.length) return null;

    let lowestNorm = Infinity;
    let lowestImprovement: string | null = null;
    for (const row of scores) {
      const maxScore = row.maxScore > 0 ? row.maxScore : 100;
      const normalized = (parseFloat(String(row.score)) / maxScore) * 100;
      if (normalized < lowestNorm) {
        lowestNorm = normalized;
        lowestImprovement = row.improvements?.trim() || null;
      }
    }
    return lowestImprovement;
  }

  async getScenarioProgress(userId: number, roleplayId: number): Promise<ScenarioProgress> {
    const [settings] = await db
      .select({ maxAttempts: roleplaySettings.maxAttempts })
      .from(roleplaySettings)
      .where(eq(roleplaySettings.roleplayId, roleplayId))
      .limit(1);

    const attempts = await db
      .select({
        id: roleplayAttempts.id,
        score: roleplayAttempts.score,
        status: roleplayAttempts.status,
        completedAt: roleplayAttempts.completedAt,
      })
      .from(roleplayAttempts)
      .where(
        and(
          eq(roleplayAttempts.roleplayId, roleplayId),
          eq(roleplayAttempts.userId, userId),
        ),
      );

    const completedAttempts = attempts.filter((a) => a.status === "completed");
    const completedScores = completedAttempts
      .map((a) => (a.score != null ? parseFloat(String(a.score)) : null))
      .filter((s): s is number => s != null);

    const bestScore = completedScores.length ? Math.max(...completedScores) : null;
    const attemptCount = attempts.length;
    const maxAttempts = settings?.maxAttempts;
    const remainingAttempts =
      maxAttempts && maxAttempts > 0 ? Math.max(0, maxAttempts - attemptCount) : null;

    const pointsEarned = await gamification.getContentPointsEarned(
      userId,
      SCENARIO_CONTENT_TYPE,
      roleplayId,
    );

    const { currentTier, nextTier } = await gamification.resolveNextTierForScore(
      SCENARIO_CONTENT_TYPE,
      roleplayId,
      userId,
      bestScore,
    );

    const criteria = await db
      .select({ id: roleplayCriteria.id, name: roleplayCriteria.name })
      .from(roleplayCriteria)
      .where(eq(roleplayCriteria.roleplayId, roleplayId));

    const criterionBests: CriterionBest[] = [];
    const completedAttemptIds = completedAttempts.map((a) => a.id);

    if (completedAttemptIds.length && criteria.length) {
      const scoreRows = await db
        .select({
          criterionId: roleplayCriterionScores.criterionId,
          score: roleplayCriterionScores.score,
          maxScore: roleplayCriterionScores.maxScore,
        })
        .from(roleplayCriterionScores)
        .where(inArray(roleplayCriterionScores.attemptId, completedAttemptIds));

      const bestByCriterion = new Map<number, number>();
      for (const row of scoreRows) {
        if (row.criterionId == null) continue;
        const maxScore = row.maxScore > 0 ? row.maxScore : 100;
        const normalized = (parseFloat(String(row.score)) / maxScore) * 100;
        const existing = bestByCriterion.get(row.criterionId);
        if (existing == null || normalized > existing) {
          bestByCriterion.set(row.criterionId, normalized);
        }
      }

      for (const criterion of criteria) {
        const best = bestByCriterion.get(criterion.id);
        if (best != null) {
          criterionBests.push({
            criterionId: criterion.id,
            name: criterion.name,
            bestScore: best,
          });
        }
      }
    }

    let lastTopImprovement: string | null = null;
    const mostRecentCompleted = [...completedAttempts].sort((a, b) => {
      const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      return bTime - aTime;
    })[0];

    if (mostRecentCompleted) {
      const recentScores = await db
        .select({
          score: roleplayCriterionScores.score,
          maxScore: roleplayCriterionScores.maxScore,
          improvements: roleplayCriterionScores.improvements,
        })
        .from(roleplayCriterionScores)
        .where(eq(roleplayCriterionScores.attemptId, mostRecentCompleted.id));

      lastTopImprovement = this.getTopImprovementFromScores(recentScores);
    }

    return {
      bestScore,
      attemptCount,
      remainingAttempts,
      pointsEarned,
      currentTier,
      nextTier,
      criterionBests,
      lastTopImprovement,
    };
  }

  async getResultsContext(
    attempt: RoleplayAttempt,
    userId: number,
    criterionScores: Array<{
      score: string | number | null;
      maxScore: number;
      improvements: string | null;
    }>,
  ) {
    const roleplayId = attempt.roleplayId;

    const [settings] = await db
      .select({ maxAttempts: roleplaySettings.maxAttempts })
      .from(roleplaySettings)
      .where(eq(roleplaySettings.roleplayId, roleplayId))
      .limit(1);

    const attempts = await db
      .select({
        id: roleplayAttempts.id,
        score: roleplayAttempts.score,
        status: roleplayAttempts.status,
      })
      .from(roleplayAttempts)
      .where(
        and(
          eq(roleplayAttempts.roleplayId, roleplayId),
          eq(roleplayAttempts.userId, userId),
        ),
      );

    const otherCompletedScores = attempts
      .filter((a) => a.status === "completed" && a.id !== attempt.id)
      .map((a) => (a.score != null ? parseFloat(String(a.score)) : null))
      .filter((s): s is number => s != null);

    const previousBestScore = otherCompletedScores.length
      ? Math.max(...otherCompletedScores)
      : null;

    const thisScore = attempt.score != null ? parseFloat(String(attempt.score)) : null;
    const bestScoreAfter =
      thisScore != null
        ? Math.max(previousBestScore ?? 0, thisScore)
        : (previousBestScore ?? 0);

    const isNewBest =
      thisScore != null && (previousBestScore == null || thisScore > previousBestScore);

    const attemptCount = attempts.length;
    const maxAttempts = settings?.maxAttempts ?? null;
    const hasUnlimited = !maxAttempts || maxAttempts <= 0;
    const usedCount = attemptCount;
    const isOutOfAttempts = !hasUnlimited && attemptCount >= maxAttempts!;

    const { rewardTiers, nextTier } = await gamification.resolveNextTierForScore(
      SCENARIO_CONTENT_TYPE,
      roleplayId,
      userId,
      bestScoreAfter > 0 ? bestScoreAfter : null,
    );

    const topImprovement = this.getTopImprovementFromScores(criterionScores);
    const totalPoints = await gamification.getUserPointsTotal(userId);

    return {
      previousBestScore,
      isNewBest,
      bestScoreAfter,
      rewardTiers: rewardTiers.map((t) => ({
        id: t.id,
        starLevel: t.starLevel,
        tierName: t.tierName,
        minScorePercent: t.minScorePercent,
        rewardPoints: t.rewardPoints,
        color: t.color,
        icon: t.icon,
      })),
      nextTier,
      topImprovement,
      attemptContext: {
        attemptNumber: attempt.attemptNumber,
        maxAttempts: hasUnlimited ? null : maxAttempts,
        usedCount,
        isOutOfAttempts,
      },
      totalPoints,
    };
  }
}

export const scenarioResultsController = new ScenarioResultsController();
