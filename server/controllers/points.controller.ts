import { db } from "../db.ts";
import { and, desc, eq, gte, sql, inArray } from "drizzle-orm";
import {
  scenarioRewardTiers,
  userScenarioTierRewards,
  pointTransactions,
  resolveRewardTierDisplay,
} from "../../shared/schemas/points.ts";
import { roleplays, roleplayAttempts, roleplaySettings } from "../../shared/schemas/roleplay-core.ts";
import { users } from "../../shared/schemas/users.ts";
import {
  classificationDimensions,
  classificationOptions,
  roleplayClassificationLinks,
} from "../../shared/schemas/roleplay-classifications.ts";
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

export type ScenarioProgressTier = {
  tierName: string;
  color: string;
  icon: string;
  minScorePercent: number;
  rewardPoints: number;
};

export type ScenarioProgress = {
  bestScore: number | null;
  attemptCount: number;
  remainingAttempts: number | null;
  pointsEarned: number;
  currentTier: ScenarioProgressTier | null;
  nextTier: ScenarioProgressTier | null;
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
        tierIcon: display?.icon ?? null,
      };
    });

    return {
      items,
      total: Number(countRow?.total ?? 0),
      page: safePage,
      limit: safeLimit,
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
      .select({ score: roleplayAttempts.score, status: roleplayAttempts.status })
      .from(roleplayAttempts)
      .where(
        and(
          eq(roleplayAttempts.roleplayId, roleplayId),
          eq(roleplayAttempts.userId, userId),
        ),
      );

    const completedScores = attempts
      .filter((a) => a.status === "completed")
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
          color: display.color,
          icon: display.icon,
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
        color: display.color,
        icon: display.icon,
        minScorePercent: nextTierRow.minScorePercent,
        rewardPoints: nextTierRow.rewardPoints,
      };
    }

    return {
      bestScore,
      attemptCount,
      remainingAttempts,
      pointsEarned,
      currentTier,
      nextTier,
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
