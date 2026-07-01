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

export async function resolveUserFromSsoClaims(claims: SsoIdentityClaims, tenantId: number) {
  const [existingIdentity] = await db
    .select()
    .from(userIdentities)
    .where(
      and(
        eq(userIdentities.provider, claims.provider),
        eq(userIdentities.providerUserId, claims.providerUserId),
        eq(userIdentities.tenantId, tenantId),
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
      tenantId,
      provider: claims.provider,
      providerUserId: claims.providerUserId,
    });
    return user;
  }

  const existingUser = await userController.getUserByEmail(claims.email, tenantId);
  if (existingUser) {
    await db.insert(userIdentities).values({
      userId: existingUser.id,
      tenantId,
      provider: claims.provider,
      providerUserId: claims.providerUserId,
      providerDisplayName: claims.providerDisplayName,
      providerEmail: claims.email,
    });
    log.info("SSO user merged by email", {
      userId: existingUser.id,
      tenantId,
      email: claims.email,
      provider: claims.provider,
      providerUserId: claims.providerUserId,
    });
    return existingUser;
  }

  const [userRole] = await db.select().from(roles).where(eq(roles.name, "user")).limit(1);
  if (!userRole) {
    throw new Error("Default user role not configured");
  }

  const user = await userController.createSsoUser({
    email: claims.email,
    firstName: claims.name,
    roleId: userRole.id,
    tenantId,
  });

  await db.insert(userIdentities).values({
    userId: user.id,
    tenantId,
    provider: claims.provider,
    providerUserId: claims.providerUserId,
    providerDisplayName: claims.providerDisplayName,
    providerEmail: claims.email,
  });

  log.info("SSO user provisioned (JIT)", {
    userId: user.id,
    tenantId,
    email: claims.email,
    provider: claims.provider,
    providerUserId: claims.providerUserId,
  });

  return user;
}
