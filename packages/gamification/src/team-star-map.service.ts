import { db } from "@heybray/server-kit";
import { and, asc, count, eq, inArray, max, sql } from "drizzle-orm";
import { users, teams } from "@heybray/identity/schema";
import type { UserWithRole } from "@heybray/identity/schema";
import {
  hasManagePermission,
  userDisplayName,
  avatarInitials,
  TeamAccessError,
  assertTeamAccess,
  assertMemberTeamAccess,
} from "@heybray/identity";
import { classificationDimensions, classificationOptions } from "@heybray/taxonomy/schema";
import {
  rewardTiers,
  userContentTierAwards,
  activityLog,
  gamificationContent,
  contentClassificationLinks,
} from "./schema/index.ts";
import type { GamificationService } from "./service.ts";

export type StarMapCategory = { slug: string; label: string };

export type StarMapMember = {
  userId: number;
  name: string;
  avatarInitials: string;
  lastActiveAt: string | null;
  totalPoints: number;
  monthPoints: number;
  starCounts: { gold: number; silver: number; bronze: number };
  publishedCount: number;
  passRate: number;
  currentWeekActive: boolean;
  categoryMastery: Array<{
    slug: string;
    label: string;
    total: number;
    gold: number;
    silver: number;
    bronze: number;
  }>;
};

export type StarMapResponse = {
  team: { id: number | "all"; name: string; managerName: string | null };
  categories: StarMapCategory[];
  members: StarMapMember[];
  teamSummary: {
    totalPoints: number;
    monthPoints: number;
    starCounts: { gold: number; silver: number; bronze: number };
    passRate: number;
    activeThisWeek: number;
    memberCount: number;
  };
};

export type MemberContentHistoryEntry = {
  contentId: number;
  title: string;
  starLevel: 0 | 1 | 2 | 3;
  bestScore: number | null;
  lastAttemptAt: string | null;
  attemptCount: number;
};

export type MemberContentHistoryCategory = {
  slug: string;
  label: string;
  total: number;
  starCounts: { gold: number; silver: number; bronze: number };
  contents: MemberContentHistoryEntry[];
};

export type MemberContentHistoryResponse = {
  userId: number;
  name: string;
  avatarInitials: string;
  teamName: string | null;
  totalPoints: number;
  passRate: number;
  categories: MemberContentHistoryCategory[];
};

export interface TeamStarMapConfig {
  contentType: string;
  masteryDimensionSlug: string;
}

function sortByTierThenTitle(
  entries: MemberContentHistoryEntry[],
): MemberContentHistoryEntry[] {
  return [...entries].sort((a, b) => {
    if (a.starLevel !== b.starLevel) return b.starLevel - a.starLevel;
    return a.title.localeCompare(b.title);
  });
}

export class TeamStarMapService {
  constructor(
    private readonly gamification: GamificationService,
    private readonly config: TeamStarMapConfig,
  ) {}

  async getLastActiveAt(userIds: number[]): Promise<Map<number, Date | null>> {
    if (!userIds.length) return new Map();

    const rows = await db
      .select({
        userId: activityLog.userId,
        lastActive: max(activityLog.occurredAt),
      })
      .from(activityLog)
      .where(inArray(activityLog.userId, userIds))
      .groupBy(activityLog.userId);

    const map = new Map<number, Date | null>();
    for (const id of userIds) map.set(id, null);
    for (const row of rows) {
      map.set(row.userId, row.lastActive ? new Date(row.lastActive) : null);
    }
    return map;
  }

  async buildMemberStats(userId: number, lastActive: Date | null): Promise<StarMapMember> {
    const [userRow] = await db
      .select({ firstName: users.firstName, email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const stats = await this.gamification.getUserProgressStats(userId);
    const name = userDisplayName(userRow?.firstName, userRow?.email ?? "");
    const passRate = stats.publishedCount > 0 ? stats.passedCount / stats.publishedCount : 0;

    return {
      userId,
      name,
      avatarInitials: avatarInitials(name),
      lastActiveAt: lastActive?.toISOString() ?? null,
      totalPoints: stats.totalPoints,
      monthPoints: stats.monthPoints,
      starCounts: stats.starCounts,
      publishedCount: stats.publishedCount,
      passRate,
      currentWeekActive: stats.currentWeekActive,
      categoryMastery: stats.categoryMastery.map((row) => ({
        slug: row.slug,
        label: row.label,
        total: row.total,
        gold: row.starCounts.gold,
        silver: row.starCounts.silver,
        bronze: row.starCounts.bronze,
      })),
    };
  }

  async getStarMap(user: UserWithRole, teamId: number | "all"): Promise<StarMapResponse> {
    if (teamId === "all") {
      if (!hasManagePermission(user)) throw new TeamAccessError();
    } else {
      await assertTeamAccess(user, teamId);
    }

    let teamName: string;
    let managerName: string | null = null;

    if (teamId === "all") {
      teamName = "All teams";
    } else {
      const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
      if (!team) throw new Error("Team not found");
      teamName = team.name;
      if (team.managerId) {
        const [manager] = await db
          .select({ firstName: users.firstName, email: users.email })
          .from(users)
          .where(eq(users.id, team.managerId))
          .limit(1);
        if (manager) managerName = userDisplayName(manager.firstName, manager.email);
      }
    }

    const memberUserRows =
      teamId === "all"
        ? await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.isActive, true))
            .orderBy(asc(users.firstName), asc(users.email))
        : await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.teamId, teamId))
            .orderBy(asc(users.firstName), asc(users.email));

    const memberIds = memberUserRows.map((r) => r.id);
    const lastActiveMap = await this.getLastActiveAt(memberIds);

    const members = await Promise.all(
      memberIds.map((id) => this.buildMemberStats(id, lastActiveMap.get(id) ?? null)),
    );

    const categorySlugSet = new Set<string>();
    for (const member of members) {
      for (const cat of member.categoryMastery) {
        categorySlugSet.add(cat.slug);
      }
    }

    const categoryOptions =
      categorySlugSet.size > 0
        ? await db
            .select({
              slug: classificationOptions.slug,
              label: classificationOptions.label,
              sortOrder: classificationOptions.sortOrder,
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
                inArray(classificationOptions.slug, [...categorySlugSet]),
              ),
            )
            .orderBy(asc(classificationOptions.sortOrder), asc(classificationOptions.label))
        : [];

    const categories: StarMapCategory[] = categoryOptions.map((opt) => ({
      slug: opt.slug,
      label: opt.label,
    }));

    const teamSummary = {
      totalPoints: members.reduce((sum, m) => sum + m.totalPoints, 0),
      monthPoints: members.reduce((sum, m) => sum + m.monthPoints, 0),
      starCounts: {
        gold: members.reduce((sum, m) => sum + m.starCounts.gold, 0),
        silver: members.reduce((sum, m) => sum + m.starCounts.silver, 0),
        bronze: members.reduce((sum, m) => sum + m.starCounts.bronze, 0),
      },
      passRate:
        members.length > 0
          ? members.reduce((sum, m) => sum + m.passRate, 0) / members.length
          : 0,
      activeThisWeek: members.filter((m) => m.currentWeekActive).length,
      memberCount: members.length,
    };

    return {
      team: { id: teamId, name: teamName, managerName },
      categories,
      members,
      teamSummary,
    };
  }

  async getMemberProgress(user: UserWithRole, teamId: number | "all", memberUserId: number) {
    await assertMemberTeamAccess(user, teamId, memberUserId);

    const stats = await this.gamification.getUserProgressStats(memberUserId);
    const [userRow] = await db
      .select({ firstName: users.firstName, email: users.email, teamId: users.teamId })
      .from(users)
      .where(eq(users.id, memberUserId))
      .limit(1);

    if (!userRow) throw new Error("User not found");

    let teamName: string | null = null;
    if (userRow.teamId) {
      const [team] = await db
        .select({ name: teams.name })
        .from(teams)
        .where(eq(teams.id, userRow.teamId))
        .limit(1);
      teamName = team?.name ?? null;
    }

    const name = userDisplayName(userRow.firstName, userRow.email);

    return {
      userId: memberUserId,
      name,
      avatarInitials: avatarInitials(name),
      teamName,
      ...stats,
    };
  }

  async getMemberContentHistory(
    user: UserWithRole,
    teamId: number | "all",
    memberUserId: number,
  ): Promise<MemberContentHistoryResponse> {
    await assertMemberTeamAccess(user, teamId, memberUserId);

    const [userRow] = await db
      .select({ firstName: users.firstName, email: users.email, teamId: users.teamId })
      .from(users)
      .where(eq(users.id, memberUserId))
      .limit(1);

    if (!userRow) throw new Error("User not found");

    let teamName: string | null = null;
    if (userRow.teamId) {
      const [team] = await db
        .select({ name: teams.name })
        .from(teams)
        .where(eq(teams.id, userRow.teamId))
        .limit(1);
      teamName = team?.name ?? null;
    }

    const name = userDisplayName(userRow.firstName, userRow.email);
    const stats = await this.gamification.getUserProgressStats(memberUserId);
    const passRate = stats.publishedCount > 0 ? stats.passedCount / stats.publishedCount : 0;

    const categoryRows = await db
      .select({
        slug: classificationOptions.slug,
        label: classificationOptions.label,
        sortOrder: classificationOptions.sortOrder,
        contentId: gamificationContent.contentId,
        title: gamificationContent.title,
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

    const [tierRows, attemptStatsRows] = await Promise.all([
      db
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
            eq(userContentTierAwards.userId, memberUserId),
            eq(gamificationContent.isActive, true),
          ),
        ),
      db
        .select({
          contentId: activityLog.contentId,
          attemptCount: count(),
          bestScore: max(activityLog.scorePercent),
          lastAttemptAt: max(activityLog.occurredAt),
        })
        .from(activityLog)
        .innerJoin(
          gamificationContent,
          and(
            eq(gamificationContent.contentType, activityLog.contentType),
            eq(gamificationContent.contentId, activityLog.contentId),
          ),
        )
        .where(
          and(eq(activityLog.userId, memberUserId), eq(gamificationContent.isActive, true)),
        )
        .groupBy(activityLog.contentId),
    ]);

    const starLevelByContent = new Map<number, number>(
      tierRows.map((r) => [r.contentId, r.starLevel ?? 0]),
    );
    const attemptStatsByContent = new Map(
      attemptStatsRows.map((r) => [
        r.contentId,
        {
          attemptCount: Number(r.attemptCount) || 0,
          bestScore: r.bestScore != null ? Number(r.bestScore) : null,
          lastAttemptAt: r.lastAttemptAt ? new Date(r.lastAttemptAt).toISOString() : null,
        },
      ]),
    );

    const categoryMeta = new Map<
      string,
      { label: string; sortOrder: number; contents: MemberContentHistoryEntry[] }
    >();

    for (const row of categoryRows) {
      const starLevelRaw = starLevelByContent.get(row.contentId) ?? 0;
      const starLevel = Math.min(3, Math.max(0, starLevelRaw)) as 0 | 1 | 2 | 3;
      const attemptStats = attemptStatsByContent.get(row.contentId);

      const entry: MemberContentHistoryEntry = {
        contentId: row.contentId,
        title: row.title,
        starLevel,
        bestScore: attemptStats?.bestScore ?? null,
        lastAttemptAt: attemptStats?.lastAttemptAt ?? null,
        attemptCount: attemptStats?.attemptCount ?? 0,
      };

      const existing = categoryMeta.get(row.slug) ?? {
        label: row.label,
        sortOrder: row.sortOrder ?? 0,
        contents: [],
      };
      existing.contents.push(entry);
      categoryMeta.set(row.slug, existing);
    }

    const categories: MemberContentHistoryCategory[] = [...categoryMeta.entries()]
      .sort((a, b) => a[1].sortOrder - b[1].sortOrder || a[1].label.localeCompare(b[1].label))
      .map(([slug, meta]) => {
        const starCounts = { gold: 0, silver: 0, bronze: 0 };
        for (const entry of meta.contents) {
          if (entry.starLevel === 3) starCounts.gold++;
          else if (entry.starLevel === 2) starCounts.silver++;
          else if (entry.starLevel === 1) starCounts.bronze++;
        }
        return {
          slug,
          label: meta.label,
          total: meta.contents.length,
          starCounts,
          contents: sortByTierThenTitle(meta.contents),
        };
      });

    return {
      userId: memberUserId,
      name,
      avatarInitials: avatarInitials(name),
      teamName,
      totalPoints: stats.totalPoints,
      passRate,
      categories,
    };
  }
}
