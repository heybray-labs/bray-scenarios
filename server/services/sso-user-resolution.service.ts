import { and, eq } from "drizzle-orm";
import { db } from "../db.ts";
import { roles } from "../../shared/schemas/roles.ts";
import { userIdentities } from "../../shared/schemas/user-identities.ts";
import { userController } from "../controllers/user.controller.ts";
import { createLogger } from "../utils/logger.ts";

const log = createLogger("sso");

export interface SsoIdentityClaims {
  provider: string;
  providerUserId: string;
  providerDisplayName: string;
  email: string;
  name?: string;
}

export async function resolveUserFromSsoClaims(claims: SsoIdentityClaims) {
  const [existingIdentity] = await db
    .select()
    .from(userIdentities)
    .where(
      and(
        eq(userIdentities.provider, claims.provider),
        eq(userIdentities.providerUserId, claims.providerUserId),
      ),
    )
    .limit(1);

  if (existingIdentity) {
    const user = await userController.getUserById(existingIdentity.userId);
    if (!user) {
      log.error("SSO identity linked to missing user", {
        identityId: existingIdentity.id,
        userId: existingIdentity.userId,
        provider: claims.provider,
        providerUserId: claims.providerUserId,
      });
      throw new Error("Linked user account not found");
    }
    log.info("SSO user resolved via existing identity", {
      userId: user.id,
      provider: claims.provider,
      providerUserId: claims.providerUserId,
    });
    return user;
  }

  const existingUser = await userController.getUserByEmail(claims.email);
  if (existingUser) {
    await db.insert(userIdentities).values({
      userId: existingUser.id,
      provider: claims.provider,
      providerUserId: claims.providerUserId,
      providerDisplayName: claims.providerDisplayName,
      providerEmail: claims.email,
    });
    log.info("SSO user merged by email", {
      userId: existingUser.id,
      email: claims.email,
      provider: claims.provider,
      providerUserId: claims.providerUserId,
    });
    return existingUser;
  }

  const hasAdmin = await userController.hasAdminUser();
  const roleName = hasAdmin ? "user" : "admin";
  const [role] = await db.select().from(roles).where(eq(roles.name, roleName)).limit(1);
  if (!role) {
    throw new Error(`Default ${roleName} role not configured`);
  }

  const user = await userController.createSsoUser({
    email: claims.email,
    firstName: claims.name,
    roleId: role.id,
  });

  await db.insert(userIdentities).values({
    userId: user.id,
    provider: claims.provider,
    providerUserId: claims.providerUserId,
    providerDisplayName: claims.providerDisplayName,
    providerEmail: claims.email,
  });

  log.info("SSO user provisioned (JIT)", {
    userId: user.id,
    email: claims.email,
    provider: claims.provider,
    providerUserId: claims.providerUserId,
    role: roleName,
  });

  return user;
}
