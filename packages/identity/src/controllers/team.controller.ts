import { db } from "@heybray/server-kit";
import { teams, type CreateTeam, type UpdateTeam } from "../schema/teams.ts";
import { users } from "../schema/users.ts";
import type { UserWithRole } from "../schema/types.ts";
import { and, asc, count, eq, inArray, sql } from "drizzle-orm";

export type TeamSummary = {
  id: number;
  name: string;
  managerId: number | null;
  managerName: string | null;
  memberCount: number;
};

export function userDisplayName(firstName: string | null | undefined, email: string): string {
  const trimmed = firstName?.trim();
  return trimmed || email;
}

export function avatarInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase() || "?";
}

export function hasManagePermission(user: UserWithRole): boolean {
  return user.role?.permissions?.includes("roleplay:manage") ?? false;
}

export async function isTeamManager(userId: number): Promise<boolean> {
  const [row] = await db
    .select({ total: count() })
    .from(teams)
    .where(eq(teams.managerId, userId));
  return Number(row?.total ?? 0) > 0;
}

export async function canAccessTeamView(user: UserWithRole): Promise<boolean> {
  if (hasManagePermission(user)) return true;
  return isTeamManager(user.id);
}

export class TeamAccessError extends Error {
  constructor() {
    super("Forbidden");
    this.name = "TeamAccessError";
  }
}

export async function assertTeamAccess(
  user: UserWithRole,
  teamId: number | "all",
): Promise<{ isAdmin: boolean }> {
  const isAdmin = hasManagePermission(user);
  if (isAdmin) return { isAdmin };

  const manages = await db
    .select({ id: teams.id })
    .from(teams)
    .where(and(eq(teams.managerId, user.id), eq(teams.id, teamId as number)))
    .limit(1);

  if (!manages.length) {
    throw new TeamAccessError();
  }

  return { isAdmin: false };
}

export async function assertMemberTeamAccess(
  user: UserWithRole,
  teamId: number | "all",
  memberUserId: number,
): Promise<void> {
  if (teamId === "all") {
    if (!hasManagePermission(user)) throw new TeamAccessError();
  } else {
    await assertTeamAccess(user, teamId);
    const [member] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, memberUserId), eq(users.teamId, teamId)))
      .limit(1);
    if (!member) throw new TeamAccessError();
  }
}

export async function canViewMemberAttempt(
  viewer: UserWithRole,
  memberUserId: number,
): Promise<boolean> {
  if (viewer.id === memberUserId) return true;
  if (hasManagePermission(viewer)) return true;

  const [member] = await db
    .select({ teamId: users.teamId })
    .from(users)
    .where(eq(users.id, memberUserId))
    .limit(1);
  if (!member?.teamId) return false;

  const [managed] = await db
    .select({ id: teams.id })
    .from(teams)
    .where(and(eq(teams.id, member.teamId), eq(teams.managerId, viewer.id)))
    .limit(1);
  return !!managed;
}

export const teamController = {
  async listTeamsForUser(user: UserWithRole): Promise<TeamSummary[]> {
    const isAdmin = hasManagePermission(user);
    if (!isAdmin) {
      const managesAny = await isTeamManager(user.id);
      if (!managesAny) throw new TeamAccessError();
    }

    const teamRows = isAdmin
      ? await db.select().from(teams).orderBy(asc(teams.name))
      : await db
          .select()
          .from(teams)
          .where(eq(teams.managerId, user.id))
          .orderBy(asc(teams.name));

    if (!teamRows.length) return [];

    const teamIds = teamRows.map((t) => t.id);
    const memberCounts = await db
      .select({ teamId: users.teamId, total: count() })
      .from(users)
      .where(inArray(users.teamId, teamIds))
      .groupBy(users.teamId);

    const countByTeam = new Map(memberCounts.map((r) => [r.teamId, Number(r.total)]));

    const managerIds = teamRows
      .map((t) => t.managerId)
      .filter((id): id is number => id != null);

    const managerRows =
      managerIds.length > 0
        ? await db
            .select({ id: users.id, firstName: users.firstName, email: users.email })
            .from(users)
            .where(inArray(users.id, managerIds))
        : [];

    const managerNameById = new Map(
      managerRows.map((m) => [m.id, userDisplayName(m.firstName, m.email)]),
    );

    return teamRows.map((team) => ({
      id: team.id,
      name: team.name,
      managerId: team.managerId,
      managerName: team.managerId ? (managerNameById.get(team.managerId) ?? null) : null,
      memberCount: countByTeam.get(team.id) ?? 0,
    }));
  },

  async listTeamsAdmin(): Promise<TeamSummary[]> {
    const teamRows = await db.select().from(teams).orderBy(asc(teams.name));
    if (!teamRows.length) return [];

    const teamIds = teamRows.map((t) => t.id);
    const memberCounts = await db
      .select({ teamId: users.teamId, total: count() })
      .from(users)
      .where(inArray(users.teamId, teamIds))
      .groupBy(users.teamId);

    const countByTeam = new Map(memberCounts.map((r) => [r.teamId, Number(r.total)]));

    const managerIds = teamRows
      .map((t) => t.managerId)
      .filter((id): id is number => id != null);

    const managerRows =
      managerIds.length > 0
        ? await db
            .select({ id: users.id, firstName: users.firstName, email: users.email })
            .from(users)
            .where(inArray(users.id, managerIds))
        : [];

    const managerNameById = new Map(
      managerRows.map((m) => [m.id, userDisplayName(m.firstName, m.email)]),
    );

    return teamRows.map((team) => ({
      id: team.id,
      name: team.name,
      managerId: team.managerId,
      managerName: team.managerId ? (managerNameById.get(team.managerId) ?? null) : null,
      memberCount: countByTeam.get(team.id) ?? 0,
    }));
  },

  async createTeam(data: CreateTeam) {
    const [team] = await db
      .insert(teams)
      .values({
        name: data.name.trim(),
        managerId: data.managerId ?? null,
        updatedAt: new Date(),
      })
      .returning();
    return team;
  },

  async updateTeam(teamId: number, data: UpdateTeam) {
    const updates: Partial<typeof teams.$inferInsert> = { updatedAt: new Date() };
    if (data.name !== undefined) updates.name = data.name.trim();
    if (data.managerId !== undefined) updates.managerId = data.managerId;

    const [team] = await db
      .update(teams)
      .set(updates)
      .where(eq(teams.id, teamId))
      .returning();
    return team ?? null;
  },

  async deleteTeam(teamId: number): Promise<boolean> {
    await db.update(users).set({ teamId: null }).where(eq(users.teamId, teamId));
    const result = await db.delete(teams).where(eq(teams.id, teamId)).returning({ id: teams.id });
    return result.length > 0;
  },

  async setTeamMembers(teamId: number, memberIds: number[]) {
    const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
    if (!team) return null;

    const uniqueIds = [...new Set(memberIds)];

    if (uniqueIds.length > 0) {
      await db
        .update(users)
        .set({ teamId: null })
        .where(and(inArray(users.id, uniqueIds), sql`${users.teamId} IS NOT NULL AND ${users.teamId} <> ${teamId}`));
    }

    await db.update(users).set({ teamId: null }).where(eq(users.teamId, teamId));

    if (uniqueIds.length > 0) {
      await db.update(users).set({ teamId: teamId }).where(inArray(users.id, uniqueIds));
    }

    return team;
  },

  async getTeamById(teamId: number) {
    const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
    return team ?? null;
  },
};
