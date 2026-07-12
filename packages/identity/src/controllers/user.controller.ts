import { db } from "@heybray/server-kit";
import { users } from "../schema/users.ts";
import { roles } from "../schema/roles.ts";
import { userIdentities } from "../schema/user-identities.ts";
import { eq, and, sql, asc } from "drizzle-orm";
import type { UserSummary, UserWithRole } from "../schema/types.ts";
import { getOidcProviderName, getSamlProviderName } from "../auth-config.ts";

function resolveSignInMethod(
  hasPassword: boolean,
  identity?: {
    provider: string;
    providerDisplayName: string | null;
  },
): string {
  if (identity) {
    if (identity.providerDisplayName) {
      return identity.providerDisplayName;
    }
    if (identity.provider === "oidc") {
      return getOidcProviderName();
    }
    if (identity.provider === "saml") {
      return getSamlProviderName();
    }
  }
  if (hasPassword) {
    return "Local";
  }
  return "—";
}

export const userController = {
  async getUserByEmail(email: string) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);
    return user ?? null;
  },

  async getUserWithRole(userId: number): Promise<UserWithRole | null> {
    const [row] = await db
      .select({ user: users, role: roles })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.id))
      .where(eq(users.id, userId))
      .limit(1);

    if (!row?.user) return null;

    return {
      id: row.user.id,
      email: row.user.email,
      roleId: row.user.roleId,
      isActive: row.user.isActive,
      isSuspended: row.user.isSuspended,
      isEmailVerified: row.user.isEmailVerified,
      approvalStatus: row.user.approvalStatus,
      twoFactorEnabled: row.user.twoFactorEnabled,
      mustChangePassword: row.user.mustChangePassword,
      role: row.role
        ? {
            id: row.role.id,
            name: row.role.name,
            permissions: row.role.permissions ?? [],
            description: row.role.description,
          }
        : null,
      profile: {
        firstName: row.user.firstName,
        lastName: null,
      },
    };
  },

  async getUserById(userId: number) {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    return user ?? null;
  },

  async updatePassword(userId: number, passwordHash: string) {
    const [user] = await db
      .update(users)
      .set({
        password: passwordHash,
        mustChangePassword: false,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return user ?? null;
  },

  async hasAdminUser(): Promise<boolean> {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(eq(roles.name, "admin"))
      .limit(1);
    return (row?.count ?? 0) > 0;
  },

  async hasPasswordUsers(): Promise<boolean> {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(sql`${users.password} IS NOT NULL`)
      .limit(1);
    return (row?.count ?? 0) > 0;
  },

  async deletePasswordlessUsers(): Promise<void> {
    await db.delete(users).where(sql`${users.password} IS NULL`);
  },

  async createAdminUser(data: {
    email: string;
    password: string;
    firstName?: string;
    roleId: number;
  }) {
    const [user] = await db
      .insert(users)
      .values({
        email: data.email.toLowerCase(),
        password: data.password,
        firstName: data.firstName ?? null,
        roleId: data.roleId,
        isEmailVerified: true,
        approvalStatus: "approved",
      })
      .returning();
    return user;
  },

  async createUser(data: {
    email: string;
    password: string;
    firstName?: string;
    roleId: number;
    mustChangePassword?: boolean;
  }) {
    const [user] = await db
      .insert(users)
      .values({
        email: data.email.toLowerCase(),
        password: data.password,
        firstName: data.firstName ?? null,
        roleId: data.roleId,
        isEmailVerified: true,
        approvalStatus: "approved",
        mustChangePassword: data.mustChangePassword ?? false,
      })
      .returning();
    return user;
  },

  async listUsers(): Promise<UserSummary[]> {
    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        teamId: users.teamId,
        hasPassword: sql<boolean>`${users.password} IS NOT NULL`,
        roleId: roles.id,
        roleName: roles.name,
      })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .orderBy(asc(users.email));

    const identities = await db
      .select({
        userId: userIdentities.userId,
        provider: userIdentities.provider,
        providerDisplayName: userIdentities.providerDisplayName,
      })
      .from(userIdentities);

    const identityByUserId = new Map(
      identities.map((identity) => [identity.userId, identity]),
    );

    return rows.map((row) => {
      const identity = identityByUserId.get(row.id);
      return {
        id: row.id,
        email: row.email,
        firstName: row.firstName,
        teamId: row.teamId,
        signInMethod: resolveSignInMethod(row.hasPassword, identity),
        role: {
          id: row.roleId,
          name: row.roleName,
        },
      };
    });
  },

  async countAdmins(): Promise<number> {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(
        and(
          eq(roles.name, "admin"),
          eq(users.isActive, true),
          eq(users.isSuspended, false),
        ),
      )
      .limit(1);
    return row?.count ?? 0;
  },

  async updateUserRole(userId: number, roleName: "admin" | "user") {
    const [role] = await db.select().from(roles).where(eq(roles.name, roleName)).limit(1);
    if (!role) {
      throw new Error(`Role not configured: ${roleName}`);
    }

    const [user] = await db
      .update(users)
      .set({
        roleId: role.id,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    return user ?? null;
  },

  async createSsoUser(data: {
    email: string;
    firstName?: string;
    roleId: number;
  }) {
    const [user] = await db
      .insert(users)
      .values({
        email: data.email.toLowerCase(),
        password: null,
        firstName: data.firstName ?? null,
        roleId: data.roleId,
        isEmailVerified: true,
        approvalStatus: "approved",
      })
      .returning();
    return user;
  },
};
