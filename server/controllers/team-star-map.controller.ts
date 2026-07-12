import { db } from "../db.ts";
import { users, teams } from "@heybray/identity/schema";
import { roleplayAttempts, roleplays } from "../../shared/schemas/roleplay-core.ts";
import { classificationDimensions, classificationOptions } from "@heybray/taxonomy/schema";
import { roleplayClassificationLinks } from "../../shared/schemas/roleplay-classification-links.ts";
import {
  scenarioRewardTiers,
  userScenarioTierRewards,
  pointTransactions,
  starLevelFromTierName,
} from "../../shared/schemas/points.ts";
import { pointsController } from "./points.controller.ts";
import type { UserWithRole } from "@heybray/identity/schema";
import {
  hasManagePermission,
  userDisplayName,
  avatarInitials,
  TeamAccessError,
  assertTeamAccess,
  assertMemberTeamAccess,
} from "@heybray/identity";
import { and, asc, count, desc, eq, inArray, max, sql } from "drizzle-orm";

export type StarMapCategory = {
  slug: string;
  label: string;
};

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

export type MemberScenarioHistoryScenario = {
  roleplayId: number;
  title: string;
  coverImageMediaId: number | null;
  starLevel: 0 | 1 | 2 | 3;
  bestScore: number | null;
  lastAttemptAt: string | null;
  attemptCount: number;
};

export type MemberScenarioHistoryCategory = {
  slug: string;
  label: string;
  total: number;
  starCounts: { gold: number; silver: number; bronze: number };
  scenarios: MemberScenarioHistoryScenario[];
};

export type MemberScenarioHistoryResponse = {
  userId: number;
  name: string;
  avatarInitials: string;
  teamName: string | null;
  totalPoints: number;
  passRate: number;
  categories: MemberScenarioHistoryCategory[];
};

function sortScenariosByTierThenTitle(
  scenarios: MemberScenarioHistoryScenario[],
): MemberScenarioHistoryScenario[] {
  return [...scenarios].sort((a, b) => {
    if (a.starLevel !== b.starLevel) return b.starLevel - a.starLevel;
    return a.title.localeCompare(b.title);
  });
}

export const teamStarMapController = {
  async getLastActiveAt(userIds: number[]): Promise<Map<number, Date | null>> {
    if (!userIds.length) return new Map();

    const rows = await db
      .select({
        userId: roleplayAttempts.userId,
        lastActive: max(roleplayAttempts.completedAt),
      })
      .from(roleplayAttempts)
      .where(
        and(
          inArray(roleplayAttempts.userId, userIds),
          eq(roleplayAttempts.status, "completed"),
          sql`${roleplayAttempts.completedAt} IS NOT NULL`,
        ),
      )
      .groupBy(roleplayAttempts.userId);

    const map = new Map<number, Date | null>();
    for (const id of userIds) map.set(id, null);
    for (const row of rows) {
      map.set(row.userId, row.lastActive ? new Date(row.lastActive) : null);
    }
    return map;
  },

  async buildMemberStats(userId: number, lastActive: Date | null): Promise<StarMapMember> {
    const [userRow] = await db
      .select({ firstName: users.firstName, email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const stats = await pointsController.getUserProgressStats(userId);
    const name = userDisplayName(userRow?.firstName, userRow?.email ?? "");
    const passRate =
      stats.publishedCount > 0 ? stats.passedCount / stats.publishedCount : 0;

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
  },

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
                eq(classificationDimensions.slug, "category"),
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
  },

  async getMemberProgress(user: UserWithRole, teamId: number | "all", memberUserId: number) {
    await assertMemberTeamAccess(user, teamId, memberUserId);

    const stats = await pointsController.getUserProgressStats(memberUserId);
    const [userRow] = await db
      .select({
        firstName: users.firstName,
        email: users.email,
        teamId: users.teamId,
      })
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
  },

  async getMemberScenarioHistory(
    user: UserWithRole,
    teamId: number | "all",
    memberUserId: number,
  ): Promise<MemberScenarioHistoryResponse> {
    await assertMemberTeamAccess(user, teamId, memberUserId);

    const [userRow] = await db
      .select({
        firstName: users.firstName,
        email: users.email,
        teamId: users.teamId,
      })
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
    const stats = await pointsController.getUserProgressStats(memberUserId);
    const passRate =
      stats.publishedCount > 0 ? stats.passedCount / stats.publishedCount : 0;

    const categoryRows = await db
      .select({
        slug: classificationOptions.slug,
        label: classificationOptions.label,
        sortOrder: classificationOptions.sortOrder,
        roleplayId: roleplays.id,
        title: roleplays.title,
        coverImageMediaId: roleplays.coverImageMediaId,
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

    const [tierRows, attemptStatsRows] = await Promise.all([
      db
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
            eq(userScenarioTierRewards.userId, memberUserId),
            eq(roleplays.status, "published"),
          ),
        ),
      db
        .select({
          roleplayId: roleplayAttempts.roleplayId,
          attemptCount: count(),
          bestScore: max(roleplayAttempts.score),
          lastAttemptAt: max(roleplayAttempts.completedAt),
        })
        .from(roleplayAttempts)
        .innerJoin(roleplays, eq(roleplays.id, roleplayAttempts.roleplayId))
        .where(
          and(
            eq(roleplayAttempts.userId, memberUserId),
            eq(roleplayAttempts.status, "completed"),
            eq(roleplays.status, "published"),
          ),
        )
        .groupBy(roleplayAttempts.roleplayId),
    ]);

    const starLevelByRoleplay = new Map<number, number>(
      tierRows.map((r) => [r.roleplayId, r.starLevel ?? 0]),
    );
    const attemptStatsByRoleplay = new Map(
      attemptStatsRows.map((r) => [
        r.roleplayId,
        {
          attemptCount: Number(r.attemptCount) || 0,
          bestScore: r.bestScore != null ? Number(r.bestScore) : null,
          lastAttemptAt: r.lastAttemptAt ? new Date(r.lastAttemptAt).toISOString() : null,
        },
      ]),
    );

    const categoryMeta = new Map<
      string,
      { label: string; sortOrder: number; scenarios: MemberScenarioHistoryScenario[] }
    >();

    for (const row of categoryRows) {
      const starLevelRaw = starLevelByRoleplay.get(row.roleplayId) ?? 0;
      const starLevel = Math.min(3, Math.max(0, starLevelRaw)) as 0 | 1 | 2 | 3;
      const attemptStats = attemptStatsByRoleplay.get(row.roleplayId);

      const scenario: MemberScenarioHistoryScenario = {
        roleplayId: row.roleplayId,
        title: row.title,
        coverImageMediaId: row.coverImageMediaId,
        starLevel,
        bestScore: attemptStats?.bestScore ?? null,
        lastAttemptAt: attemptStats?.lastAttemptAt ?? null,
        attemptCount: attemptStats?.attemptCount ?? 0,
      };

      const existing = categoryMeta.get(row.slug) ?? {
        label: row.label,
        sortOrder: row.sortOrder ?? 0,
        scenarios: [],
      };
      existing.scenarios.push(scenario);
      categoryMeta.set(row.slug, existing);
    }

    const categories: MemberScenarioHistoryCategory[] = [...categoryMeta.entries()]
      .sort((a, b) => a[1].sortOrder - b[1].sortOrder || a[1].label.localeCompare(b[1].label))
      .map(([slug, meta]) => {
        const starCounts = { gold: 0, silver: 0, bronze: 0 };
        for (const scenario of meta.scenarios) {
          if (scenario.starLevel === 3) starCounts.gold++;
          else if (scenario.starLevel === 2) starCounts.silver++;
          else if (scenario.starLevel === 1) starCounts.bronze++;
        }
        return {
          slug,
          label: meta.label,
          total: meta.scenarios.length,
          starCounts,
          scenarios: sortScenariosByTierThenTitle(meta.scenarios),
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
  },

  async getMemberScenarioAttempts(
    user: UserWithRole,
    teamId: number | "all",
    memberUserId: number,
    roleplayId: number,
  ) {
    await assertMemberTeamAccess(user, teamId, memberUserId);

    const rows = await db
      .select({
        id: roleplayAttempts.id,
        attemptNumber: roleplayAttempts.attemptNumber,
        score: roleplayAttempts.score,
        isPassed: roleplayAttempts.isPassed,
        status: roleplayAttempts.status,
        completedAt: roleplayAttempts.completedAt,
        tierName: pointTransactions.tierName,
      })
      .from(roleplayAttempts)
      .leftJoin(
        pointTransactions,
        eq(pointTransactions.attemptId, roleplayAttempts.id),
      )
      .where(
        and(
          eq(roleplayAttempts.userId, memberUserId),
          eq(roleplayAttempts.roleplayId, roleplayId),
          eq(roleplayAttempts.status, "completed"),
        ),
      )
      .orderBy(desc(roleplayAttempts.attemptNumber));

    return rows.map((row) => {
      const starLevel = row.tierName ? starLevelFromTierName(row.tierName) : 0;
      return {
        id: row.id,
        attemptNumber: row.attemptNumber,
        score: row.score != null ? Number(row.score) : null,
        isPassed: row.isPassed,
        status: row.status,
        completedAt: row.completedAt ? new Date(row.completedAt).toISOString() : null,
        tierName: row.tierName ?? null,
        starLevel: Math.min(3, Math.max(0, starLevel)) as 0 | 1 | 2 | 3,
      };
    });
  },
};
