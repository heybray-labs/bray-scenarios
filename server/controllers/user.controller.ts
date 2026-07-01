import { db } from "../db.ts";
import { users } from "../../shared/schemas/users.ts";
import { roles } from "../../shared/schemas/roles.ts";
import { userIdentities } from "../../shared/schemas/user-identities.ts";
import { eq, and, sql, asc } from "drizzle-orm";
import type { TenantUserSummary, UserWithRole } from "../../shared/schemas/types.ts";
import { getOidcProviderName, getSamlProviderName } from "../config/auth-config.ts";

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
  async getUserByEmail(email: string, tenantId: number) {
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.email, email.toLowerCase()), eq(users.tenantId, tenantId)))
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
      tenantId: row.user.tenantId,
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

  async hasAdminUser(tenantId: number): Promise<boolean> {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(and(eq(users.tenantId, tenantId), eq(roles.name, "admin")))
      .limit(1);
    return (row?.count ?? 0) > 0;
  },

  async createAdminUser(data: {
    email: string;
    password: string;
    firstName?: string;
    tenantId: number;
    roleId: number;
  }) {
    const [user] = await db
      .insert(users)
      .values({
        email: data.email.toLowerCase(),
        password: data.password,
        firstName: data.firstName ?? null,
        roleId: data.roleId,
        tenantId: data.tenantId,
        isEmailVerified: true,
        approvalStatus: "approved",
        isTenantAdmin: true,
        tenantRole: "admin",
      })
      .returning();
    return user;
  },

  async createUser(data: {
    email: string;
    password: string;
    firstName?: string;
    roleId: number;
    tenantId: number;
    mustChangePassword?: boolean;
    isTenantAdmin?: boolean;
    tenantRole?: string;
  }) {
    const [user] = await db
      .insert(users)
      .values({
        email: data.email.toLowerCase(),
        password: data.password,
        firstName: data.firstName ?? null,
        roleId: data.roleId,
        tenantId: data.tenantId,
        isEmailVerified: true,
        approvalStatus: "approved",
        mustChangePassword: data.mustChangePassword ?? false,
        isTenantAdmin: data.isTenantAdmin ?? false,
        tenantRole: data.tenantRole ?? "member",
      })
      .returning();
    return user;
  },

  async listTenantUsers(tenantId: number): Promise<TenantUserSummary[]> {
    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        hasPassword: sql<boolean>`${users.password} IS NOT NULL`,
        roleId: roles.id,
        roleName: roles.name,
      })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(eq(users.tenantId, tenantId))
      .orderBy(asc(users.email));

    const identities = await db
      .select({
        userId: userIdentities.userId,
        provider: userIdentities.provider,
        providerDisplayName: userIdentities.providerDisplayName,
      })
      .from(userIdentities)
      .where(eq(userIdentities.tenantId, tenantId));

    const identityByUserId = new Map(
      identities.map((identity) => [identity.userId, identity]),
    );

    return rows.map((row) => {
      const identity = identityByUserId.get(row.id);
      return {
        id: row.id,
        email: row.email,
        firstName: row.firstName,
        signInMethod: resolveSignInMethod(row.hasPassword, identity),
        role: {
          id: row.roleId,
          name: row.roleName,
        },
      };
    });
  },

  async countAdmins(tenantId: number): Promise<number> {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(
        and(
          eq(users.tenantId, tenantId),
          eq(roles.name, "admin"),
          eq(users.isActive, true),
          eq(users.isSuspended, false),
        ),
      )
      .limit(1);
    return row?.count ?? 0;
  },

  async updateUserRole(userId: number, tenantId: number, roleName: "admin" | "user") {
    const [role] = await db.select().from(roles).where(eq(roles.name, roleName)).limit(1);
    if (!role) {
      throw new Error(`Role not configured: ${roleName}`);
    }

    const isAdmin = roleName === "admin";
    const [user] = await db
      .update(users)
      .set({
        roleId: role.id,
        isTenantAdmin: isAdmin,
        tenantRole: isAdmin ? "admin" : "member",
        updatedAt: new Date(),
      })
      .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)))
      .returning();

    return user ?? null;
  },

  async createSsoUser(data: {
    email: string;
    firstName?: string;
    roleId: number;
    tenantId: number;
  }) {
    const [user] = await db
      .insert(users)
      .values({
        email: data.email.toLowerCase(),
        password: null,
        firstName: data.firstName ?? null,
        roleId: data.roleId,
        tenantId: data.tenantId,
        isEmailVerified: true,
        approvalStatus: "approved",
      })
      .returning();
    return user;
  },
};
