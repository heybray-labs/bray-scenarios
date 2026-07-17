import { db } from "@heybray/server-kit";
import { roleplayAttempts, roleplays } from "../schema/roleplay-core.ts";
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

export type MemberContentHistoryItem = {
  contentId: number;
  title: string;
  coverImageMediaId: number | null;
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
  contents: MemberContentHistoryItem[];
};

export type MemberContentHistoryPayload = {
  userId: number;
  name: string;
  avatarInitials: string;
  teamName: string | null;
  totalPoints: number;
  passRate: number;
  categories: MemberContentHistoryCategory[];
};

/** @deprecated Legacy response shape — categories use `scenarios` instead of `contents`. */
export type MemberScenarioHistoryScenario = MemberContentHistoryItem;

/** @deprecated Legacy response shape — categories use `scenarios` instead of `contents`. */
export type MemberScenarioHistoryCategory = Omit<MemberContentHistoryCategory, "contents"> & {
  scenarios: MemberContentHistoryItem[];
};

/** @deprecated Legacy response shape — use MemberContentHistoryPayload. */
export type MemberScenarioHistoryResponse = Omit<MemberContentHistoryPayload, "categories"> & {
  categories: MemberScenarioHistoryCategory[];
};

/**
 * App-side adapter over the generic @heybray/gamification TeamStarMapService.
 * getStarMap / getMemberProgress pass through unchanged (identical shapes); content
 * history enriches generic entries with app-owned coverImageMediaId.
 */
export const teamStarMapController = {
  async getStarMap(user: UserWithRole, teamId: number | "all"): Promise<StarMapResponse> {
    return teamStarMap.getStarMap(user, teamId);
  },

  async getMemberProgress(user: UserWithRole, teamId: number | "all", memberUserId: number) {
    return teamStarMap.getMemberProgress(user, teamId, memberUserId);
  },

  async getMemberContentHistory(
    user: UserWithRole,
    teamId: number | "all",
    memberUserId: number,
  ): Promise<MemberContentHistoryPayload> {
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
        contents: category.contents.map((content) => ({
          contentId: content.contentId,
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

  /** @deprecated Legacy alias — returns `scenarios` key for back-compat clients. */
  async getMemberScenarioHistory(
    user: UserWithRole,
    teamId: number | "all",
    memberUserId: number,
  ): Promise<MemberScenarioHistoryResponse> {
    const neutral = await this.getMemberContentHistory(user, teamId, memberUserId);
    return {
      ...neutral,
      categories: neutral.categories.map(({ contents, ...category }) => ({
        ...category,
        scenarios: contents,
      })),
    };
  },

  async getMemberContentAttempts(
    user: UserWithRole,
    teamId: number | "all",
    memberUserId: number,
    contentId: number,
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
          eq(roleplayAttempts.roleplayId, contentId),
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

  /** @deprecated Legacy alias for getMemberContentAttempts. */
  async getMemberScenarioAttempts(
    user: UserWithRole,
    teamId: number | "all",
    memberUserId: number,
    roleplayId: number,
  ) {
    return this.getMemberContentAttempts(user, teamId, memberUserId, roleplayId);
  },
};
