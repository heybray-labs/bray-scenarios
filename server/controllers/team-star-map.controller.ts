import { db } from "../db.ts";
import { roleplayAttempts, roleplays } from "../../shared/schemas/roleplay-core.ts";
import { pointTransactions } from "@heybray/gamification/schema";
import { starLevelFromTierName } from "@heybray/gamification";
import type { UserWithRole } from "@heybray/identity/schema";
import { assertMemberTeamAccess } from "@heybray/identity";
import { and, desc, eq, inArray } from "drizzle-orm";
import { teamStarMap } from "../gamification.ts";
import type {
  StarMapResponse,
  MemberContentHistoryResponse,
} from "@heybray/gamification";

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

/**
 * App-side adapter over the generic @heybray/gamification TeamStarMapService.
 * getStarMap / getMemberProgress pass through unchanged (identical shapes); the
 * scenario-history endpoint reshapes generic content entries into the roleplay-
 * shaped payload (adds coverImageMediaId, renames content→scenario) so the client
 * contract is preserved. getMemberScenarioAttempts stays fully app-side.
 */
export const teamStarMapController = {
  async getStarMap(user: UserWithRole, teamId: number | "all"): Promise<StarMapResponse> {
    return teamStarMap.getStarMap(user, teamId);
  },

  async getMemberProgress(user: UserWithRole, teamId: number | "all", memberUserId: number) {
    return teamStarMap.getMemberProgress(user, teamId, memberUserId);
  },

  async getMemberScenarioHistory(
    user: UserWithRole,
    teamId: number | "all",
    memberUserId: number,
  ): Promise<MemberScenarioHistoryResponse> {
    const generic: MemberContentHistoryResponse = await teamStarMap.getMemberContentHistory(
      user,
      teamId,
      memberUserId,
    );

    const contentIds = generic.categories.flatMap((c) => c.contents.map((s) => s.contentId));
    const coverByRoleplay = new Map<number, number | null>();
    if (contentIds.length) {
      const coverRows = await db
        .select({ id: roleplays.id, coverImageMediaId: roleplays.coverImageMediaId })
        .from(roleplays)
        .where(inArray(roleplays.id, contentIds));
      for (const row of coverRows) coverByRoleplay.set(row.id, row.coverImageMediaId);
    }

    return {
      userId: generic.userId,
      name: generic.name,
      avatarInitials: generic.avatarInitials,
      teamName: generic.teamName,
      totalPoints: generic.totalPoints,
      passRate: generic.passRate,
      categories: generic.categories.map((category) => ({
        slug: category.slug,
        label: category.label,
        total: category.total,
        starCounts: category.starCounts,
        scenarios: category.contents.map((content) => ({
          roleplayId: content.contentId,
          title: content.title,
          coverImageMediaId: coverByRoleplay.get(content.contentId) ?? null,
          starLevel: content.starLevel,
          bestScore: content.bestScore,
          lastAttemptAt: content.lastAttemptAt,
          attemptCount: content.attemptCount,
        })),
      })),
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
      .leftJoin(pointTransactions, eq(pointTransactions.activityId, roleplayAttempts.id))
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
