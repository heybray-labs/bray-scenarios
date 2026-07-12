import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request } from "express";

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const n = parseInt(value ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const windowMs = parsePositiveInt(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000);
const globalMax = parsePositiveInt(process.env.RATE_LIMIT_MAX, 300);
const authMax = parsePositiveInt(process.env.AUTH_RATE_LIMIT_MAX, 20);

function isHealthCheck(req: Request): boolean {
  return req.path === "/health";
}

/** Prefer per-session keys so multiple logged-in users on one IP do not share a bucket. */
function rateLimitKey(req: Request): string {
  const auth = req.headers.authorization;
  if (typeof auth === "string" && auth.length > 0) {
    return `auth:${auth}`;
  }
  return `ip:${ipKeyGenerator(req.ip ?? "")}`;
}

/** Applied to /api routes only (static assets and SPA HTML are not counted). */
export const globalRateLimiter = rateLimit({
  windowMs,
  max: globalMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later." },
  skip: isHealthCheck,
  keyGenerator: rateLimitKey,
});

/**
 * Stricter limit for authentication endpoints that hit the database and
 * run expensive password hashing (bcrypt).
 */
export const authRateLimiter = rateLimit({
  windowMs,
  max: authMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many authentication attempts, please try again later." },
  keyGenerator: rateLimitKey,
});
