import { db } from "../db.ts";
import { and, asc, desc, eq, gte, isNotNull, sql, inArray, count } from "drizzle-orm";
import {
  scenarioRewardTiers,
  userScenarioTierRewards,
  pointTransactions,
  resolveRewardTierDisplay,
} from "../../shared/schemas/points.ts";
import { roleplays, roleplayAttempts, roleplaySettings, roleplayCriteria, roleplayCriterionScores } from "../../shared/schemas/roleplay-core.ts";
import { users } from "@heybray/identity/schema";
import { classificationDimensions, classificationOptions } from "@heybray/taxonomy/schema";
import { roleplayClassificationLinks } from "../../shared/schemas/roleplay-classification-links.ts";
import type { RoleplayAttempt } from "../../shared/schemas/roleplay-core.ts";

export type PointsAwardResult = {
  pointsAwarded: number;
  tierName: string | null;
  totalPoints: number;
};

export type LeaderboardEntry = {
  userId: number;
  name: string;
  points: number;
  rank: number;
  isCurrentUser: boolean;
};

export type RecentStarAchievement = {
  id: number;
  userId: number;
  userName: string;
  roleplayId: number;
  scenarioTitle: string;
  tierName: string;
  starLevel: number;
  tierColor: string | null;
  createdAt: string;
  isCurrentUser: boolean;
};

export type ScenarioProgressTier = {
  tierName: string;
  starLevel: number;
  color: string;
  minScorePercent: number;
  rewardPoints: number;
};

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

export class PointsController {
  async getRewardTiersForRoleplay(roleplayId: number) {
    return db
      .select()
      .from(scenarioRewardTiers)
      .where(eq(scenarioRewardTiers.roleplayId, roleplayId))
      .orderBy(scenarioRewardTiers.orderIndex);
  }

  async getRewardTiersForRoleplays(roleplayIds: number[]) {
    if (!roleplayIds.length) return new Map<number, typeof scenarioRewardTiers.$inferSelect[]>();

    const rows = await db
      .select()
      .from(scenarioRewardTiers)
      .where(inArray(scenarioRewardTiers.roleplayId, roleplayIds))
      .orderBy(scenarioRewardTiers.orderIndex);

    const map = new Map<number, typeof rows>();
    for (const row of rows) {
      const existing = map.get(row.roleplayId) ?? [];
      existing.push(row);
      map.set(row.roleplayId, existing);
    }
    return map;
  }

  async awardPointsForAttempt(
    attempt: RoleplayAttempt,
    roleplayTitle: string,
    userId: number,
    scorePercent: number,
  ): Promise<PointsAwardResult | null> {
    const roleplayId = attempt.roleplayId;

    const tiers = await db
      .select()
      .from(scenarioRewardTiers)
      .where(eq(scenarioRewardTiers.roleplayId, roleplayId))
      .orderBy(desc(scenarioRewardTiers.minScorePercent));

    if (!tiers.length) return null;

    const achievedTier = tiers.find((t) => scorePercent >= t.minScorePercent);
    if (!achievedTier) return null;

    const [existing] = await db
      .select()
      .from(userScenarioTierRewards)
      .where(
        and(
          eq(userScenarioTierRewards.userId, userId),
          eq(userScenarioTierRewards.roleplayId, roleplayId),
        ),
      )
      .limit(1);

    const previouslyAwarded = existing?.totalPointsAwarded ?? 0;
    const pointsToAward = Math.max(0, achievedTier.rewardPoints - previouslyAwarded);

    if (pointsToAward > 0) {
      await db.insert(pointTransactions).values({
        userId,
        amount: pointsToAward,
        roleplayId,
        attemptId: attempt.id,
        tierName: achievedTier.tierName,
        description: `Reached ${achievedTier.tierName} tier on "${roleplayTitle}"`,
      });
    }

    if (existing) {
      await db
        .update(userScenarioTierRewards)
        .set({
          highestTierId: achievedTier.id,
          totalPointsAwarded: achievedTier.rewardPoints,
          updatedAt: new Date(),
        })
        .where(eq(userScenarioTierRewards.id, existing.id));
    } else {
      await db.insert(userScenarioTierRewards).values({
        userId,
        roleplayId,
        highestTierId: achievedTier.id,
        totalPointsAwarded: achievedTier.rewardPoints,
      });
    }

    const totalPoints = await this.getUserPointsTotal(userId);

    return {
      pointsAwarded: pointsToAward,
      tierName: achievedTier.tierName,
      totalPoints,
    };
  }

  async getUserPointsTotal(userId: number, period: "all_time" | "month" = "all_time"): Promise<number> {
    const monthStart = sql`date_trunc('month', now())`;
    const periodFilter = period === "month" ? gte(pointTransactions.createdAt, monthStart) : undefined;

    const [row] = await db
      .select({ total: sql<number>`COALESCE(SUM(${pointTransactions.amount}), 0)` })
      .from(pointTransactions)
      .where(and(eq(pointTransactions.userId, userId), periodFilter));
    return Number(row?.total ?? 0);
  }

  async getUserPointsSummary(userId: number) {
    const [allTime, month] = await Promise.all([
      this.getUserPointsTotal(userId, "all_time"),
      this.getUserPointsTotal(userId, "month"),
    ]);
    return { total: allTime, monthTotal: month };
  }

  async getUserProgressStats(userId: number) {
    const [totalPoints, monthPoints] = await Promise.all([
      this.getUserPointsTotal(userId, "all_time"),
      this.getUserPointsTotal(userId, "month"),
    ]);

    const starRows = await db
      .select({
        starLevel: scenarioRewardTiers.starLevel,
      })
      .from(userScenarioTierRewards)
      .innerJoin(
        scenarioRewardTiers,
        eq(scenarioRewardTiers.id, userScenarioTierRewards.highestTierId),
      )
      .innerJoin(roleplays, eq(roleplays.id, userScenarioTierRewards.roleplayId))
      .where(
        and(eq(userScenarioTierRewards.userId, userId), eq(roleplays.status, "published")),
      );

    const starCounts = { gold: 0, silver: 0, bronze: 0 };
    for (const row of starRows) {
      if (row.starLevel === 3) starCounts.gold++;
      else if (row.starLevel === 2) starCounts.silver++;
      else if (row.starLevel === 1) starCounts.bronze++;
    }

    const [publishedCountRow] = await db
      .select({ total: count() })
      .from(roleplays)
      .where(eq(roleplays.status, "published"));

    const passedRows = await db
      .selectDistinct({ roleplayId: roleplayAttempts.roleplayId })
      .from(roleplayAttempts)
      .innerJoin(roleplays, eq(roleplays.id, roleplayAttempts.roleplayId))
      .where(
        and(
          eq(roleplayAttempts.userId, userId),
          eq(roleplayAttempts.status, "completed"),
          eq(roleplayAttempts.isPassed, true),
          eq(roleplays.status, "published"),
        ),
      );

    const completedWeekRows = await db
      .select({ completedAt: roleplayAttempts.completedAt })
      .from(roleplayAttempts)
      .where(
        and(
          eq(roleplayAttempts.userId, userId),
          eq(roleplayAttempts.status, "completed"),
          sql`${roleplayAttempts.completedAt} IS NOT NULL`,
        ),
      );

    const weekStarts = new Set<string>();
    for (const row of completedWeekRows) {
      if (!row.completedAt) continue;
      weekStarts.add(this.isoWeekKey(new Date(row.completedAt)));
    }

    const now = new Date();
    const currentWeekKey = this.isoWeekKey(now);
    const currentWeekActive = weekStarts.has(currentWeekKey);

    let streakWeeks = 0;
    let cursor = currentWeekActive ? now : this.addWeeks(now, -1);
    while (weekStarts.has(this.isoWeekKey(cursor))) {
      streakWeeks++;
      cursor = this.addWeeks(cursor, -1);
    }

    const categoryMastery = await this.getCategoryMasteryRankings(userId);

    return {
      totalPoints,
      monthPoints,
      starCounts,
      passedCount: passedRows.length,
      publishedCount: Number(publishedCountRow?.total ?? 0),
      streakWeeks,
      currentWeekActive,
      categoryMastery,
    };
  }

  async getCategoryMasteryRankings(userId: number) {
    const categoryRows = await db
      .select({
        slug: classificationOptions.slug,
        label: classificationOptions.label,
        roleplayId: roleplays.id,
      })
      .from(roleplays)
      .innerJoin(
        roleplayClassificationLinks,
        eq(roleplayClassificationLinks.roleplayId, roleplays.id),
      )
      .innerJoin(
        classificationOptions,
        eq(classificationOptions.id, roleplayClassificationLinks.optionId),
      )
      .innerJoin(
        classificationDimensions,
        eq(classificationDimensions.id, classificationOptions.dimensionId),
      )
      .where(
        and(eq(roleplays.status, "published"), eq(classificationDimensions.slug, "category")),
      );

    const tierRows = await db
      .select({
        roleplayId: userScenarioTierRewards.roleplayId,
        starLevel: scenarioRewardTiers.starLevel,
      })
      .from(userScenarioTierRewards)
      .innerJoin(
        scenarioRewardTiers,
        eq(scenarioRewardTiers.id, userScenarioTierRewards.highestTierId),
      )
      .innerJoin(roleplays, eq(roleplays.id, userScenarioTierRewards.roleplayId))
      .where(
        and(
          eq(userScenarioTierRewards.userId, userId),
          eq(roleplays.status, "published"),
          sql`${scenarioRewardTiers.starLevel} >= 1`,
        ),
      );

    const starLevelByRoleplay = new Map(tierRows.map((r) => [r.roleplayId, r.starLevel]));

    const masteryMap = new Map<
      string,
      { label: string; total: number; gold: number; silver: number; bronze: number }
    >();
    for (const row of categoryRows) {
      const existing = masteryMap.get(row.slug) ?? {
        label: row.label,
        total: 0,
        gold: 0,
        silver: 0,
        bronze: 0,
      };
      existing.total++;
      const starLevel = starLevelByRoleplay.get(row.roleplayId);
      if (starLevel === 3) existing.gold++;
      else if (starLevel === 2) existing.silver++;
      else if (starLevel === 1) existing.bronze++;
      masteryMap.set(row.slug, existing);
    }

    const allCategoryOptions = await db
      .select({
        slug: classificationOptions.slug,
        label: classificationOptions.label,
      })
      .from(classificationOptions)
      .innerJoin(
        classificationDimensions,
        eq(classificationOptions.dimensionId, classificationDimensions.id),
      )
      .where(
        and(
          eq(classificationDimensions.slug, "category"),
          eq(classificationOptions.isActive, true),
        ),
      )
      .orderBy(asc(classificationOptions.sortOrder), asc(classificationOptions.label));

    return allCategoryOptions
      .map((opt) => {
        const data = masteryMap.get(opt.slug);
        return {
          slug: opt.slug,
          label: opt.label,
          total: data?.total ?? 0,
          starCounts: {
            gold: data?.gold ?? 0,
            silver: data?.silver ?? 0,
            bronze: data?.bronze ?? 0,
          },
        };
      })
      .filter((row) => row.total > 0)
      .sort((a, b) => {
        const aStarred =
          a.starCounts.gold + a.starCounts.silver + a.starCounts.bronze;
        const bStarred =
          b.starCounts.gold + b.starCounts.silver + b.starCounts.bronze;
        const aHasStars = aStarred > 0;
        const bHasStars = bStarred > 0;

        if (aHasStars && bHasStars) {
          const goldDiff = b.starCounts.gold - a.starCounts.gold;
          if (goldDiff !== 0) return goldDiff;
          const silverDiff = b.starCounts.silver - a.starCounts.silver;
          if (silverDiff !== 0) return silverDiff;
          const bronzeDiff = b.starCounts.bronze - a.starCounts.bronze;
          if (bronzeDiff !== 0) return bronzeDiff;
          return b.total - a.total || a.label.localeCompare(b.label);
        }
        if (aHasStars) return -1;
        if (bHasStars) return 1;

        const totalDiff = b.total - a.total;
        if (totalDiff !== 0) return totalDiff;
        return a.label.localeCompare(b.label);
      });
  }

  private isoWeekKey(date: Date): string {
    const monday = new Date(date);
    const day = monday.getDay();
    const diff = day === 0 ? 6 : day - 1;
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() - diff);
    return monday.toISOString().slice(0, 10);
  }

  private addWeeks(date: Date, weeks: number): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + weeks * 7);
    return next;
  }

  async getUserPointsHistory(userId: number, page = 1, limit = 20) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const offset = (safePage - 1) * safeLimit;

    const [countRow] = await db
      .select({ total: sql<number>`count(*)` })
      .from(pointTransactions)
      .where(eq(pointTransactions.userId, userId));

    const rows = await db
      .select({
        id: pointTransactions.id,
        amount: pointTransactions.amount,
        tierName: pointTransactions.tierName,
        description: pointTransactions.description,
        createdAt: pointTransactions.createdAt,
        roleplayId: pointTransactions.roleplayId,
        attemptId: pointTransactions.attemptId,
        roleplayTitle: roleplays.title,
        tierColor: scenarioRewardTiers.color,
        tierIcon: scenarioRewardTiers.icon,
      })
      .from(pointTransactions)
      .leftJoin(roleplays, eq(pointTransactions.roleplayId, roleplays.id))
      .leftJoin(
        scenarioRewardTiers,
        and(
          eq(scenarioRewardTiers.roleplayId, pointTransactions.roleplayId),
          eq(scenarioRewardTiers.tierName, pointTransactions.tierName),
        ),
      )
      .where(eq(pointTransactions.userId, userId))
      .orderBy(desc(pointTransactions.createdAt))
      .limit(safeLimit)
      .offset(offset);

    const items = rows.map((row) => {
      const display = row.tierName
        ? resolveRewardTierDisplay({
            tierName: row.tierName,
            color: row.tierColor,
            icon: row.tierIcon,
          })
        : null;
      return {
        ...row,
        tierColor: display?.color ?? null,
        tierStarLevel: display?.starLevel ?? null,
      };
    });

    return {
      items,
      total: Number(countRow?.total ?? 0),
      page: safePage,
      limit: safeLimit,
    };
  }

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

  async resolveNextTierForScore(
    roleplayId: number,
    userId: number,
    bestScore: number | null,
  ): Promise<{
    rewardTiers: Awaited<ReturnType<PointsController["getRewardTiersForRoleplay"]>>;
    nextTier: ScenarioProgressTier | null;
  }> {
    const tiers = await this.getRewardTiersForRoleplay(roleplayId);
    const sortedAsc = [...tiers].sort((a, b) => a.minScorePercent - b.minScorePercent);

    const tierReward = await this.getUserTierReward(userId, roleplayId);
    let currentTier: ScenarioProgressTier | null = null;
    if (tierReward?.highestTierId) {
      const tier = tiers.find((t) => t.id === tierReward.highestTierId);
      if (tier) {
        const display = resolveRewardTierDisplay(tier);
        currentTier = {
          tierName: tier.tierName,
          starLevel: tier.starLevel,
          color: display.color,
          minScorePercent: tier.minScorePercent,
          rewardPoints: tier.rewardPoints,
        };
      }
    }

    const nextTierRow =
      bestScore != null
        ? sortedAsc.find((t) => t.minScorePercent > bestScore)
        : sortedAsc[0];

    let nextTier: ScenarioProgressTier | null = null;
    if (nextTierRow && (!currentTier || nextTierRow.minScorePercent > currentTier.minScorePercent)) {
      const display = resolveRewardTierDisplay(nextTierRow);
      nextTier = {
        tierName: nextTierRow.tierName,
        starLevel: nextTierRow.starLevel,
        color: display.color,
        minScorePercent: nextTierRow.minScorePercent,
        rewardPoints: nextTierRow.rewardPoints,
      };
    }

    return { rewardTiers: tiers, nextTier };
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

    const thisScore =
      attempt.score != null ? parseFloat(String(attempt.score)) : null;
    const bestScoreAfter =
      thisScore != null
        ? Math.max(previousBestScore ?? 0, thisScore)
        : (previousBestScore ?? 0);

    const isNewBest =
      thisScore != null &&
      (previousBestScore == null || thisScore > previousBestScore);

    const attemptCount = attempts.length;
    const maxAttempts = settings?.maxAttempts ?? null;
    const hasUnlimited = !maxAttempts || maxAttempts <= 0;
    const usedCount = attemptCount;
    const isOutOfAttempts = !hasUnlimited && attemptCount >= maxAttempts!;

    const { rewardTiers, nextTier } = await this.resolveNextTierForScore(
      roleplayId,
      userId,
      bestScoreAfter > 0 ? bestScoreAfter : null,
    );

    const topImprovement = this.getTopImprovementFromScores(criterionScores);
    const totalPoints = await this.getUserPointsTotal(userId);

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

  async getPointsForAttempt(attemptId: number) {
    const [row] = await db
      .select({
        amount: pointTransactions.amount,
        tierName: pointTransactions.tierName,
      })
      .from(pointTransactions)
      .where(eq(pointTransactions.attemptId, attemptId))
      .limit(1);
    return row ?? null;
  }

  async getUserTierReward(userId: number, roleplayId: number) {
    const [row] = await db
      .select()
      .from(userScenarioTierRewards)
      .where(
        and(
          eq(userScenarioTierRewards.userId, userId),
          eq(userScenarioTierRewards.roleplayId, roleplayId),
        ),
      )
      .limit(1);
    return row ?? null;
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

    const [pointsRow] = await db
      .select({ total: sql<number>`COALESCE(SUM(${pointTransactions.amount}), 0)` })
      .from(pointTransactions)
      .where(
        and(
          eq(pointTransactions.userId, userId),
          eq(pointTransactions.roleplayId, roleplayId),
        ),
      );
    const pointsEarned = Number(pointsRow?.total ?? 0);

    const tiers = await this.getRewardTiersForRoleplay(roleplayId);
    const sortedAsc = [...tiers].sort((a, b) => a.minScorePercent - b.minScorePercent);

    const tierReward = await this.getUserTierReward(userId, roleplayId);
    let currentTier: ScenarioProgressTier | null = null;
    if (tierReward?.highestTierId) {
      const tier = tiers.find((t) => t.id === tierReward.highestTierId);
      if (tier) {
        const display = resolveRewardTierDisplay(tier);
        currentTier = {
          tierName: tier.tierName,
          starLevel: tier.starLevel,
          color: display.color,
          minScorePercent: tier.minScorePercent,
          rewardPoints: tier.rewardPoints,
        };
      }
    }

    const nextTierRow =
      bestScore != null
        ? sortedAsc.find((t) => t.minScorePercent > bestScore)
        : sortedAsc[0];

    let nextTier: ScenarioProgressTier | null = null;
    if (nextTierRow && (!currentTier || nextTierRow.minScorePercent > currentTier.minScorePercent)) {
      const display = resolveRewardTierDisplay(nextTierRow);
      nextTier = {
        tierName: nextTierRow.tierName,
        starLevel: nextTierRow.starLevel,
        color: display.color,
        minScorePercent: nextTierRow.minScorePercent,
        rewardPoints: nextTierRow.rewardPoints,
      };
    }

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

  async getLeaderboard(options: {
    scope: "global" | "category";
    categorySlug?: string;
    period: "all_time" | "month";
    limit?: number;
    currentUserId?: number;
  }): Promise<{ entries: LeaderboardEntry[]; currentUser: LeaderboardEntry | null }> {
    const safeLimit = Math.min(50, Math.max(1, options.limit ?? 20));
    const entries = await this.queryLeaderboardEntries({ ...options, limit: safeLimit });

    let currentUser =
      options.currentUserId != null
        ? entries.find((e) => e.userId === options.currentUserId) ?? null
        : null;

    if (options.currentUserId != null && !currentUser) {
      currentUser = await this.getCurrentUserLeaderboardEntry(options);
    } else if (currentUser) {
      currentUser = { ...currentUser, isCurrentUser: true };
    }

    return { entries, currentUser };
  }

  async getRecentStarAchievements(options: {
    limit?: number;
    currentUserId?: number;
  }): Promise<{ items: RecentStarAchievement[] }> {
    const safeLimit = Math.min(50, Math.max(1, options.limit ?? 15));

    const rows = await db
      .select({
        id: pointTransactions.id,
        userId: pointTransactions.userId,
        firstName: users.firstName,
        email: users.email,
        roleplayId: pointTransactions.roleplayId,
        scenarioTitle: roleplays.title,
        tierName: pointTransactions.tierName,
        tierColor: scenarioRewardTiers.color,
        tierIcon: scenarioRewardTiers.icon,
        createdAt: pointTransactions.createdAt,
      })
      .from(pointTransactions)
      .innerJoin(users, eq(pointTransactions.userId, users.id))
      .innerJoin(roleplays, eq(pointTransactions.roleplayId, roleplays.id))
      .leftJoin(
        scenarioRewardTiers,
        and(
          eq(scenarioRewardTiers.roleplayId, pointTransactions.roleplayId),
          eq(scenarioRewardTiers.tierName, pointTransactions.tierName),
        ),
      )
      .where(
        and(
          isNotNull(pointTransactions.tierName),
          eq(roleplays.status, "published"),
        ),
      )
      .orderBy(desc(pointTransactions.createdAt))
      .limit(safeLimit);

    const items: RecentStarAchievement[] = rows
      .filter((row) => row.roleplayId != null && row.tierName != null)
      .map((row) => {
        const display = resolveRewardTierDisplay({
          tierName: row.tierName!,
          color: row.tierColor,
          icon: row.tierIcon,
        });
        return {
          id: row.id,
          userId: row.userId,
          userName: row.firstName?.trim() || row.email,
          roleplayId: row.roleplayId!,
          scenarioTitle: row.scenarioTitle,
          tierName: row.tierName!,
          starLevel: display.starLevel,
          tierColor: display.color,
          createdAt: row.createdAt.toISOString(),
          isCurrentUser: options.currentUserId === row.userId,
        };
      });

    return { items };
  }

  private async queryLeaderboardEntries(options: {
    scope: "global" | "category";
    categorySlug?: string;
    period: "all_time" | "month";
    limit: number;
    currentUserId?: number;
  }): Promise<LeaderboardEntry[]> {
    const monthStart = sql`date_trunc('month', now())`;
    const periodFilter =
      options.period === "month"
        ? gte(pointTransactions.createdAt, monthStart)
        : undefined;

    if (options.scope === "category") {
      if (!options.categorySlug?.trim()) {
        return [];
      }

      const categorySlug = options.categorySlug.trim();

      const rows = await db
        .select({
          userId: pointTransactions.userId,
          points: sql<number>`SUM(${pointTransactions.amount})`,
          firstName: users.firstName,
          email: users.email,
        })
        .from(pointTransactions)
        .innerJoin(roleplays, eq(pointTransactions.roleplayId, roleplays.id))
        .innerJoin(
          roleplayClassificationLinks,
          eq(roleplayClassificationLinks.roleplayId, roleplays.id),
        )
        .innerJoin(
          classificationOptions,
          eq(roleplayClassificationLinks.optionId, classificationOptions.id),
        )
        .innerJoin(
          classificationDimensions,
          eq(classificationOptions.dimensionId, classificationDimensions.id),
        )
        .innerJoin(users, eq(pointTransactions.userId, users.id))
        .where(
          and(
            eq(classificationDimensions.slug, "category"),
            eq(classificationOptions.slug, categorySlug),
            periodFilter,
          ),
        )
        .groupBy(pointTransactions.userId, users.firstName, users.email)
        .orderBy(desc(sql`SUM(${pointTransactions.amount})`))
        .limit(options.limit);

      return rows.map((row, index) => ({
        userId: row.userId,
        name: row.firstName?.trim() || row.email,
        points: Number(row.points),
        rank: index + 1,
        isCurrentUser: options.currentUserId === row.userId,
      }));
    }

    const rows = await db
      .select({
        userId: pointTransactions.userId,
        points: sql<number>`SUM(${pointTransactions.amount})`,
        firstName: users.firstName,
        email: users.email,
      })
      .from(pointTransactions)
      .innerJoin(users, eq(pointTransactions.userId, users.id))
      .where(periodFilter)
      .groupBy(pointTransactions.userId, users.firstName, users.email)
      .orderBy(desc(sql`SUM(${pointTransactions.amount})`))
      .limit(options.limit);

    return rows.map((row, index) => ({
      userId: row.userId,
      name: row.firstName?.trim() || row.email,
      points: Number(row.points),
      rank: index + 1,
      isCurrentUser: options.currentUserId === row.userId,
    }));
  }

  private async getCurrentUserLeaderboardEntry(options: {
    scope: "global" | "category";
    categorySlug?: string;
    period: "all_time" | "month";
    currentUserId?: number;
  }): Promise<LeaderboardEntry | null> {
    if (options.currentUserId == null) return null;

    const monthStart = sql`date_trunc('month', now())`;
    const periodFilter =
      options.period === "month"
        ? gte(pointTransactions.createdAt, monthStart)
        : undefined;

    const userId = options.currentUserId;

    if (options.scope === "category") {
      if (!options.categorySlug?.trim()) return null;
      const categorySlug = options.categorySlug.trim();

      const [userRow] = await db
        .select({
          points: sql<number>`COALESCE(SUM(${pointTransactions.amount}), 0)`,
          firstName: users.firstName,
          email: users.email,
        })
        .from(pointTransactions)
        .innerJoin(roleplays, eq(pointTransactions.roleplayId, roleplays.id))
        .innerJoin(
          roleplayClassificationLinks,
          eq(roleplayClassificationLinks.roleplayId, roleplays.id),
        )
        .innerJoin(
          classificationOptions,
          eq(roleplayClassificationLinks.optionId, classificationOptions.id),
        )
        .innerJoin(
          classificationDimensions,
          eq(classificationOptions.dimensionId, classificationDimensions.id),
        )
        .innerJoin(users, eq(pointTransactions.userId, users.id))
        .where(
          and(
            eq(pointTransactions.userId, userId),
            eq(classificationDimensions.slug, "category"),
            eq(classificationOptions.slug, categorySlug),
            periodFilter,
          ),
        )
        .groupBy(users.firstName, users.email);

      if (!userRow || Number(userRow.points) <= 0) return null;

      const userPoints = Number(userRow.points);

      const rankResult = await db.execute(sql`
        WITH scores AS (
          SELECT pt.user_id, SUM(pt.amount)::int AS points
          FROM point_transactions pt
          INNER JOIN roleplays r ON pt.roleplay_id = r.id
          INNER JOIN roleplay_classification_links rcl ON rcl.roleplay_id = r.id
          INNER JOIN classification_options co ON rcl.option_id = co.id
          INNER JOIN classification_dimensions cd ON co.dimension_id = cd.id
          WHERE cd.slug = 'category' AND co.slug = ${categorySlug}
          ${options.period === "month" ? sql`AND pt.created_at >= date_trunc('month', now())` : sql``}
          GROUP BY pt.user_id
        )
        SELECT
          (SELECT COUNT(*)::int FROM scores s2 WHERE s2.points > (SELECT points FROM scores WHERE user_id = ${userId})) + 1 AS rank
      `);

      const rank = Number((rankResult.rows[0] as { rank?: number })?.rank ?? 0);
      if (!rank) return null;

      return {
        userId,
        name: userRow.firstName?.trim() || userRow.email,
        points: userPoints,
        rank,
        isCurrentUser: true,
      };
    }

    const [userRow] = await db
      .select({
        points: sql<number>`COALESCE(SUM(${pointTransactions.amount}), 0)`,
        firstName: users.firstName,
        email: users.email,
      })
      .from(pointTransactions)
      .innerJoin(users, eq(pointTransactions.userId, users.id))
      .where(and(eq(pointTransactions.userId, userId), periodFilter))
      .groupBy(users.firstName, users.email);

    if (!userRow || Number(userRow.points) <= 0) return null;

    const userPoints = Number(userRow.points);

    const rankResult = await db.execute(sql`
      WITH scores AS (
        SELECT pt.user_id, SUM(pt.amount)::int AS points
        FROM point_transactions pt
        ${options.period === "month" ? sql`WHERE pt.created_at >= date_trunc('month', now())` : sql``}
        GROUP BY pt.user_id
      )
      SELECT
        (SELECT COUNT(*)::int FROM scores s2 WHERE s2.points > (SELECT points FROM scores WHERE user_id = ${userId})) + 1 AS rank
    `);

    const rank = Number((rankResult.rows[0] as { rank?: number })?.rank ?? 0);
    if (!rank) return null;

    return {
      userId,
      name: userRow.firstName?.trim() || userRow.email,
      points: userPoints,
      rank,
      isCurrentUser: true,
    };
  }
}

export const pointsController = new PointsController();
