import { nanoid } from "nanoid";
import { and, eq, isNull, lt } from "drizzle-orm";
import { db } from "../db.ts";
import { authExchangeCodes } from "../../shared/schemas/auth-exchange-codes.ts";
import { userController } from "../controllers/user.controller.ts";
import { generateToken, generateRefreshToken } from "../middleware/auth.ts";
import { createLogger } from "../utils/logger.ts";

const log = createLogger("sso");

const EXCHANGE_CODE_TTL_MS = 60_000;

async function pruneExpiredExchangeCodes() {
  await db.delete(authExchangeCodes).where(lt(authExchangeCodes.expiresAt, new Date()));
}

export async function createExchangeCode(userId: number): Promise<string> {
  const code = nanoid(32);
  const expiresAt = new Date(Date.now() + EXCHANGE_CODE_TTL_MS);
  await db.insert(authExchangeCodes).values({
    code,
    userId,
    expiresAt,
  });
  return code;
}

export async function completeExchange(code: string) {
  await pruneExpiredExchangeCodes();

  const [row] = await db
    .select()
    .from(authExchangeCodes)
    .where(and(eq(authExchangeCodes.code, code), isNull(authExchangeCodes.usedAt)))
    .limit(1);

  if (!row) {
    log.warn("SSO exchange code not found or already used");
    throw new Error("Invalid or expired sign-in code");
  }

  if (row.expiresAt < new Date()) {
    log.warn("SSO exchange code expired", { userId: row.userId });
    throw new Error("Invalid or expired sign-in code");
  }

  await db
    .update(authExchangeCodes)
    .set({ usedAt: new Date() })
    .where(eq(authExchangeCodes.id, row.id));

  const userWithRole = await userController.getUserWithRole(row.userId);
  if (!userWithRole) {
    log.error("SSO exchange user not found", { userId: row.userId });
    throw new Error("User not found");
  }

  const token = generateToken(row.userId, userWithRole.roleId);
  const refreshToken = generateRefreshToken(row.userId);

  log.info("SSO session established", {
    userId: row.userId,
    role: userWithRole.role?.name,
  });

  return {
    token,
    refreshToken,
    user: userWithRole,
    expiresIn: 86400,
  };
}
