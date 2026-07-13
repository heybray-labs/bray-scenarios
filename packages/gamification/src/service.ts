import { db, createLogger, eventBus } from "@heybray/server-kit";
import { and, asc, desc, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
import { users } from "@heybray/identity/schema";
import {
  classificationDimensions,
  classificationOptions,
} from "@heybray/taxonomy/schema";
import {
  rewardTiers,
  userContentTierAwards,
  activityLog,
  gamificationContent,
  contentClassificationLinks,
  pointTransactions,
  resolveRewardTierDisplay,
  type RewardTier,
  type RewardTierInput,
} from "./schema/index.ts";

export interface GamificationContentType {
  type: string;
  label: string;
}

export interface GamificationConfig {
  contentTypes: GamificationContentType[];
  /** Classification dimension used for mastery/category leaderboards (Scenarios: "category"). */
  masteryDimensionSlug: string;
  managePermission: string;
  tierDefaults?: RewardTierInput[];
}

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
  contentId: number;
  contentTitle: string;
  tierName: string;
  starLevel: number;
  tierColor: string | null;
  createdAt: string;
  isCurrentUser: boolean;
};

export type ProgressTier = {
  tierName: string;
  starLevel: number;
  color: string;
  minScorePercent: number;
  rewardPoints: number;
};

export type ContentProgress = {
  bestScore: number | null;
  pointsEarned: number;
  starLevel: number;
  currentTier: ProgressTier | null;
  nextTier: ProgressTier | null;
  rewardTiers: RewardTier[];
};

export type RecordResultInput = {
  userId: number;
  contentType: string;
  contentId: number;
  activityId?: number | null;
  scorePercent?: number | null;
  passed?: boolean | null;
  occurredAt: Date;
  /** Award tier points only when true; the activity is always logged either way. */
  eligibleForAward: boolean;
};

export type SyncContentItem = {
  contentType: string;
  contentId: number;
  title: string;
  isActive: boolean;
};

export type ReconcileReport = {
  inserted: number;
  updated: number;
  deactivated: number;
};

const log = createLogger("gamification");

export class GamificationService {
  private readonly contentTypeList: string[];

  constructor(private readonly config: GamificationConfig) {
    this.contentTypeList = config.contentTypes.map((c) => c.type);
  }

  // ---- reward tiers ---------------------------------------------------------

  async getRewardTiers(contentType: string, contentId: number) {
    return db
      .select()
      .from(rewardTiers)
      .where(and(eq(rewardTiers.contentType, contentType), eq(rewardTiers.contentId, contentId)))
      .orderBy(rewardTiers.orderIndex);
  }

  async getRewardTiersForContents(contentType: string, contentIds: number[]) {
    if (!contentIds.length) return new Map<number, RewardTier[]>();

    const rows = await db
      .select()
      .from(rewardTiers)
      .where(and(eq(rewardTiers.contentType, contentType), inArray(rewardTiers.contentId, contentIds)))
      .orderBy(rewardTiers.orderIndex);

    const map = new Map<number, RewardTier[]>();
    for (const row of rows) {
      const existing = map.get(row.contentId) ?? [];
      existing.push(row);
      map.set(row.contentId, existing);
    }
    return map;
  }

  // ---- recording results / awarding points ----------------------------------

  async recordResult(input: RecordResultInput): Promise<PointsAwardResult | null> {
    // Always log the completion so streaks / last-active reflect ALL completions.
    await db.insert(activityLog).values({
      userId: input.userId,
      contentType: input.contentType,
      contentId: input.contentId,
      activityId: input.activityId ?? null,
      scorePercent: input.scorePercent != null ? String(input.scorePercent) : null,
      passed: input.passed ?? null,
      occurredAt: input.occurredAt,
    });

    eventBus.emit("activity.recorded", {
      userId: input.userId,
      contentType: input.contentType,
      contentId: input.contentId,
    });

    if (!input.eligibleForAward) return null;

    const result = await this.awardPoints(
      input.contentType,
      input.contentId,
      input.userId,
      input.scorePercent ?? 0,
      input.activityId ?? null,
    );

    if (result && result.pointsAwarded > 0 && result.tierName) {
      eventBus.emit("points.awarded", {
        userId: input.userId,
        contentType: input.contentType,
        contentId: input.contentId,
        points: result.pointsAwarded,
        tierName: result.tierName,
      });
    }

    return result;
  }

  /**
   * Update the logged result for an existing activity (e.g. a manual re-grade).
   * Does NOT award points — award eligibility is decided once, at recordResult
   * time. Tolerant no-op (warns, never throws) when no matching row exists.
   */
  async updateResult(input: {
    contentType: string;
    contentId: number;
    activityId: number;
    scorePercent: number | null;
    passed: boolean | null;
  }): Promise<void> {
    const updated = await db
      .update(activityLog)
      .set({
        scorePercent: input.scorePercent != null ? String(input.scorePercent) : null,
        passed: input.passed ?? null,
      })
      .where(
        and(
          eq(activityLog.contentType, input.contentType),
          eq(activityLog.contentId, input.contentId),
          eq(activityLog.activityId, input.activityId),
        ),
      )
      .returning({ id: activityLog.id });

    if (!updated.length) {
      log.warn("updateResult matched no activity_log row", {
        contentType: input.contentType,
        contentId: input.contentId,
        activityId: input.activityId,
      });
    }
  }

  private async awardPoints(
    contentType: string,
    contentId: number,
    userId: number,
    scorePercent: number,
    activityId: number | null,
  ): Promise<PointsAwardResult | null> {
    const tiers = await db
      .select()
      .from(rewardTiers)
      .where(and(eq(rewardTiers.contentType, contentType), eq(rewardTiers.contentId, contentId)))
      .orderBy(desc(rewardTiers.minScorePercent));

    if (!tiers.length) return null;

    const achievedTier = tiers.find((t) => scorePercent >= t.minScorePercent);
    if (!achievedTier) return null;

    const [existing] = await db
      .select()
      .from(userContentTierAwards)
      .where(
        and(
          eq(userContentTierAwards.userId, userId),
          eq(userContentTierAwards.contentType, contentType),
          eq(userContentTierAwards.contentId, contentId),
        ),
      )
      .limit(1);

    const previouslyAwarded = existing?.totalPointsAwarded ?? 0;
    const pointsToAward = Math.max(0, achievedTier.rewardPoints - previouslyAwarded);

    if (pointsToAward > 0) {
      const [content] = await db
        .select({ title: gamificationContent.title })
        .from(gamificationContent)
        .where(
          and(
            eq(gamificationContent.contentType, contentType),
            eq(gamificationContent.contentId, contentId),
          ),
        )
        .limit(1);
      const title = content?.title ?? "";

      await db.insert(pointTransactions).values({
        userId,
        amount: pointsToAward,
        contentType,
        contentId,
        activityId,
        tierName: achievedTier.tierName,
        description: `Reached ${achievedTier.tierName} tier on "${title}"`,
      });
    }

    if (existing) {
      await db
        .update(userContentTierAwards)
        .set({
          highestTierId: achievedTier.id,
          totalPointsAwarded: achievedTier.rewardPoints,
          updatedAt: new Date(),
        })
        .where(eq(userContentTierAwards.id, existing.id));
    } else {
      await db.insert(userContentTierAwards).values({
        userId,
        contentType,
        contentId,
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

  // ---- totals / stats -------------------------------------------------------

  async getUserPointsTotal(
    userId: number,
    period: "all_time" | "month" = "all_time",
  ): Promise<number> {
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
      .select({ starLevel: rewardTiers.starLevel })
      .from(userContentTierAwards)
      .innerJoin(rewardTiers, eq(rewardTiers.id, userContentTierAwards.highestTierId))
      .innerJoin(
        gamificationContent,
        and(
          eq(gamificationContent.contentType, userContentTierAwards.contentType),
          eq(gamificationContent.contentId, userContentTierAwards.contentId),
        ),
      )
      .where(
        and(eq(userContentTierAwards.userId, userId), eq(gamificationContent.isActive, true)),
      );

    const starCounts = { gold: 0, silver: 0, bronze: 0 };
    for (const row of starRows) {
      if (row.starLevel === 3) starCounts.gold++;
      else if (row.starLevel === 2) starCounts.silver++;
      else if (row.starLevel === 1) starCounts.bronze++;
    }

    const [publishedCountRow] = await db
      .select({ total: sql<number>`count(*)` })
      .from(gamificationContent)
      .where(
        and(
          eq(gamificationContent.isActive, true),
          inArray(gamificationContent.contentType, this.contentTypeList),
        ),
      );

    const passedRows = await db
      .selectDistinct({ contentId: activityLog.contentId })
      .from(activityLog)
      .innerJoin(
        gamificationContent,
        and(
          eq(gamificationContent.contentType, activityLog.contentType),
          eq(gamificationContent.contentId, activityLog.contentId),
        ),
      )
      .where(
        and(
          eq(activityLog.userId, userId),
          eq(activityLog.passed, true),
          eq(gamificationContent.isActive, true),
        ),
      );

    const activityRows = await db
      .select({ occurredAt: activityLog.occurredAt })
      .from(activityLog)
      .where(eq(activityLog.userId, userId));

    const weekStarts = new Set<string>();
    for (const row of activityRows) {
      if (!row.occurredAt) continue;
      weekStarts.add(this.isoWeekKey(new Date(row.occurredAt)));
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

    const categoryMastery = await this.getMasteryRankings(userId);

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

  async getMasteryRankings(userId: number) {
    const categoryRows = await db
      .select({
        slug: classificationOptions.slug,
        label: classificationOptions.label,
        contentId: gamificationContent.contentId,
      })
      .from(gamificationContent)
      .innerJoin(
        contentClassificationLinks,
        and(
          eq(contentClassificationLinks.contentType, gamificationContent.contentType),
          eq(contentClassificationLinks.contentId, gamificationContent.contentId),
        ),
      )
      .innerJoin(
        classificationOptions,
        eq(classificationOptions.id, contentClassificationLinks.optionId),
      )
      .innerJoin(
        classificationDimensions,
        eq(classificationDimensions.id, classificationOptions.dimensionId),
      )
      .where(
        and(
          eq(gamificationContent.isActive, true),
          eq(classificationDimensions.slug, this.config.masteryDimensionSlug),
        ),
      );

    const tierRows = await db
      .select({
        contentId: userContentTierAwards.contentId,
        starLevel: rewardTiers.starLevel,
      })
      .from(userContentTierAwards)
      .innerJoin(rewardTiers, eq(rewardTiers.id, userContentTierAwards.highestTierId))
      .innerJoin(
        gamificationContent,
        and(
          eq(gamificationContent.contentType, userContentTierAwards.contentType),
          eq(gamificationContent.contentId, userContentTierAwards.contentId),
        ),
      )
      .where(
        and(
          eq(userContentTierAwards.userId, userId),
          eq(gamificationContent.isActive, true),
          sql`${rewardTiers.starLevel} >= 1`,
        ),
      );

    const starLevelByContent = new Map(tierRows.map((r) => [r.contentId, r.starLevel]));

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
      const starLevel = starLevelByContent.get(row.contentId);
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
          eq(classificationDimensions.slug, this.config.masteryDimensionSlug),
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
        const aStarred = a.starCounts.gold + a.starCounts.silver + a.starCounts.bronze;
        const bStarred = b.starCounts.gold + b.starCounts.silver + b.starCounts.bronze;
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

  // ---- history --------------------------------------------------------------

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
        contentId: pointTransactions.contentId,
        activityId: pointTransactions.activityId,
        contentTitle: gamificationContent.title,
        tierColor: rewardTiers.color,
        tierIcon: rewardTiers.icon,
      })
      .from(pointTransactions)
      .leftJoin(
        gamificationContent,
        and(
          eq(gamificationContent.contentType, pointTransactions.contentType),
          eq(gamificationContent.contentId, pointTransactions.contentId),
        ),
      )
      .leftJoin(
        rewardTiers,
        and(
          eq(rewardTiers.contentType, pointTransactions.contentType),
          eq(rewardTiers.contentId, pointTransactions.contentId),
          eq(rewardTiers.tierName, pointTransactions.tierName),
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

  // ---- content progress (generic half of getScenarioProgress) ---------------

  async getUserTierAward(userId: number, contentType: string, contentId: number) {
    const [row] = await db
      .select()
      .from(userContentTierAwards)
      .where(
        and(
          eq(userContentTierAwards.userId, userId),
          eq(userContentTierAwards.contentType, contentType),
          eq(userContentTierAwards.contentId, contentId),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async getPointsForActivity(activityId: number) {
    const [row] = await db
      .select({ amount: pointTransactions.amount, tierName: pointTransactions.tierName })
      .from(pointTransactions)
      .where(eq(pointTransactions.activityId, activityId))
      .limit(1);
    return row ?? null;
  }

  async resolveNextTierForScore(
    contentType: string,
    contentId: number,
    userId: number,
    bestScore: number | null,
  ): Promise<{ rewardTiers: RewardTier[]; currentTier: ProgressTier | null; nextTier: ProgressTier | null }> {
    const tiers = await this.getRewardTiers(contentType, contentId);
    const sortedAsc = [...tiers].sort((a, b) => a.minScorePercent - b.minScorePercent);

    const tierAward = await this.getUserTierAward(userId, contentType, contentId);
    let currentTier: ProgressTier | null = null;
    if (tierAward?.highestTierId) {
      const tier = tiers.find((t) => t.id === tierAward.highestTierId);
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
      bestScore != null ? sortedAsc.find((t) => t.minScorePercent > bestScore) : sortedAsc[0];

    let nextTier: ProgressTier | null = null;
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

    return { rewardTiers: tiers, currentTier, nextTier };
  }

  /** Best completed score for a user on one content, from the activity log. */
  async getBestScore(userId: number, contentType: string, contentId: number): Promise<number | null> {
    const [row] = await db
      .select({ best: sql<string | null>`max(${activityLog.scorePercent})` })
      .from(activityLog)
      .where(
        and(
          eq(activityLog.userId, userId),
          eq(activityLog.contentType, contentType),
          eq(activityLog.contentId, contentId),
        ),
      );
    return row?.best != null ? Number(row.best) : null;
  }

  async getContentPointsEarned(userId: number, contentType: string, contentId: number): Promise<number> {
    const [row] = await db
      .select({ total: sql<number>`COALESCE(SUM(${pointTransactions.amount}), 0)` })
      .from(pointTransactions)
      .where(
        and(
          eq(pointTransactions.userId, userId),
          eq(pointTransactions.contentType, contentType),
          eq(pointTransactions.contentId, contentId),
        ),
      );
    return Number(row?.total ?? 0);
  }

  async getContentProgress(
    userId: number,
    contentType: string,
    contentId: number,
  ): Promise<ContentProgress> {
    const bestScore = await this.getBestScore(userId, contentType, contentId);
    const pointsEarned = await this.getContentPointsEarned(userId, contentType, contentId);
    const { rewardTiers: tiers, currentTier, nextTier } = await this.resolveNextTierForScore(
      contentType,
      contentId,
      userId,
      bestScore,
    );

    return {
      bestScore,
      pointsEarned,
      starLevel: currentTier?.starLevel ?? 0,
      currentTier,
      nextTier,
      rewardTiers: tiers,
    };
  }

  // ---- leaderboard ----------------------------------------------------------

  async getLeaderboard(options: {
    scope: "global" | "dimension-option";
    optionSlug?: string;
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
    scope: "global" | "dimension-option";
    optionSlug?: string;
    period: "all_time" | "month";
    limit: number;
    currentUserId?: number;
  }): Promise<LeaderboardEntry[]> {
    const monthStart = sql`date_trunc('month', now())`;
    const periodFilter =
      options.period === "month" ? gte(pointTransactions.createdAt, monthStart) : undefined;

    if (options.scope === "dimension-option") {
      if (!options.optionSlug?.trim()) {
        return [];
      }

      const optionSlug = options.optionSlug.trim();

      const rows = await db
        .select({
          userId: pointTransactions.userId,
          points: sql<number>`SUM(${pointTransactions.amount})`,
          firstName: users.firstName,
          email: users.email,
        })
        .from(pointTransactions)
        .innerJoin(
          contentClassificationLinks,
          and(
            eq(contentClassificationLinks.contentType, pointTransactions.contentType),
            eq(contentClassificationLinks.contentId, pointTransactions.contentId),
          ),
        )
        .innerJoin(
          classificationOptions,
          eq(contentClassificationLinks.optionId, classificationOptions.id),
        )
        .innerJoin(
          classificationDimensions,
          eq(classificationOptions.dimensionId, classificationDimensions.id),
        )
        .innerJoin(users, eq(pointTransactions.userId, users.id))
        .where(
          and(
            eq(classificationDimensions.slug, this.config.masteryDimensionSlug),
            eq(classificationOptions.slug, optionSlug),
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
    scope: "global" | "dimension-option";
    optionSlug?: string;
    period: "all_time" | "month";
    currentUserId?: number;
  }): Promise<LeaderboardEntry | null> {
    if (options.currentUserId == null) return null;

    const monthStart = sql`date_trunc('month', now())`;
    const periodFilter =
      options.period === "month" ? gte(pointTransactions.createdAt, monthStart) : undefined;

    const userId = options.currentUserId;

    if (options.scope === "dimension-option") {
      if (!options.optionSlug?.trim()) return null;
      const optionSlug = options.optionSlug.trim();
      const dimensionSlug = this.config.masteryDimensionSlug;

      const [userRow] = await db
        .select({
          points: sql<number>`COALESCE(SUM(${pointTransactions.amount}), 0)`,
          firstName: users.firstName,
          email: users.email,
        })
        .from(pointTransactions)
        .innerJoin(
          contentClassificationLinks,
          and(
            eq(contentClassificationLinks.contentType, pointTransactions.contentType),
            eq(contentClassificationLinks.contentId, pointTransactions.contentId),
          ),
        )
        .innerJoin(
          classificationOptions,
          eq(contentClassificationLinks.optionId, classificationOptions.id),
        )
        .innerJoin(
          classificationDimensions,
          eq(classificationOptions.dimensionId, classificationDimensions.id),
        )
        .innerJoin(users, eq(pointTransactions.userId, users.id))
        .where(
          and(
            eq(pointTransactions.userId, userId),
            eq(classificationDimensions.slug, dimensionSlug),
            eq(classificationOptions.slug, optionSlug),
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
          INNER JOIN content_classification_links ccl ON ccl.content_type = pt.content_type AND ccl.content_id = pt.content_id
          INNER JOIN classification_options co ON ccl.option_id = co.id
          INNER JOIN classification_dimensions cd ON co.dimension_id = cd.id
          WHERE cd.slug = ${dimensionSlug} AND co.slug = ${optionSlug}
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
        contentId: pointTransactions.contentId,
        contentTitle: gamificationContent.title,
        tierName: pointTransactions.tierName,
        tierColor: rewardTiers.color,
        tierIcon: rewardTiers.icon,
        createdAt: pointTransactions.createdAt,
      })
      .from(pointTransactions)
      .innerJoin(users, eq(pointTransactions.userId, users.id))
      .innerJoin(
        gamificationContent,
        and(
          eq(gamificationContent.contentType, pointTransactions.contentType),
          eq(gamificationContent.contentId, pointTransactions.contentId),
        ),
      )
      .leftJoin(
        rewardTiers,
        and(
          eq(rewardTiers.contentType, pointTransactions.contentType),
          eq(rewardTiers.contentId, pointTransactions.contentId),
          eq(rewardTiers.tierName, pointTransactions.tierName),
        ),
      )
      .where(and(isNotNull(pointTransactions.tierName), eq(gamificationContent.isActive, true)))
      .orderBy(desc(pointTransactions.createdAt))
      .limit(safeLimit);

    const items: RecentStarAchievement[] = rows
      .filter((row) => row.contentId != null && row.tierName != null)
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
          contentId: row.contentId!,
          contentTitle: row.contentTitle,
          tierName: row.tierName!,
          starLevel: display.starLevel,
          tierColor: display.color,
          createdAt: row.createdAt.toISOString(),
          isCurrentUser: options.currentUserId === row.userId,
        };
      });

    return { items };
  }

  // ---- content projection sync ----------------------------------------------

  async syncContent(items: SyncContentItem[]): Promise<void> {
    if (!items.length) return;
    for (const item of items) {
      await db
        .insert(gamificationContent)
        .values({
          contentType: item.contentType,
          contentId: item.contentId,
          title: item.title,
          isActive: item.isActive,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [gamificationContent.contentType, gamificationContent.contentId],
          set: { title: item.title, isActive: item.isActive, updatedAt: new Date() },
        });
    }
  }

  async onContentDeleted(contentType: string, contentId: number): Promise<void> {
    await db
      .delete(gamificationContent)
      .where(
        and(
          eq(gamificationContent.contentType, contentType),
          eq(gamificationContent.contentId, contentId),
        ),
      );
  }

  /**
   * Rebuilds the gamification_content projection from a caller-supplied source
   * list (the app's own content). Returns a drift report. Never deletes rows —
   * content no longer present is marked inactive so historical points survive.
   */
  async reconcile(items: SyncContentItem[]): Promise<ReconcileReport> {
    const existing = await db
      .select({
        contentType: gamificationContent.contentType,
        contentId: gamificationContent.contentId,
        title: gamificationContent.title,
        isActive: gamificationContent.isActive,
      })
      .from(gamificationContent)
      .where(inArray(gamificationContent.contentType, this.contentTypeList));

    const existingByKey = new Map(existing.map((e) => [`${e.contentType}:${e.contentId}`, e]));
    const sourceKeys = new Set(items.map((i) => `${i.contentType}:${i.contentId}`));

    let inserted = 0;
    let updated = 0;
    let deactivated = 0;

    for (const item of items) {
      const key = `${item.contentType}:${item.contentId}`;
      const current = existingByKey.get(key);
      if (!current) {
        inserted++;
      } else if (current.title !== item.title || current.isActive !== item.isActive) {
        updated++;
      }
    }

    for (const row of existing) {
      const key = `${row.contentType}:${row.contentId}`;
      if (!sourceKeys.has(key) && row.isActive) {
        deactivated++;
        await db
          .update(gamificationContent)
          .set({ isActive: false, updatedAt: new Date() })
          .where(
            and(
              eq(gamificationContent.contentType, row.contentType),
              eq(gamificationContent.contentId, row.contentId),
            ),
          );
      }
    }

    if (items.length) await this.syncContent(items);

    return { inserted, updated, deactivated };
  }
}
