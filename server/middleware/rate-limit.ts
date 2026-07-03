import rateLimit from "express-rate-limit";
import type { Request } from "express";

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const n = parseInt(value ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const windowMs = parsePositiveInt(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000);
const globalMax = parsePositiveInt(process.env.RATE_LIMIT_MAX, 300);
const authMax = parsePositiveInt(process.env.AUTH_RATE_LIMIT_MAX, 20);

function isHealthCheck(req: Request): boolean {
  return req.path === "/api/health" || req.path === "/health";
}

/** Applied to all requests (API, static files, SPA fallback). */
export const globalRateLimiter = rateLimit({
  windowMs,
  max: globalMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later." },
  skip: isHealthCheck,
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
});
