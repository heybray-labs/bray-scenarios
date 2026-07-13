import { Router, type NextFunction, type Request, type RequestHandler, type Response } from "express";
import { getTenantContext } from "./request-context.ts";

export interface RequestContext {
  userId?: number;
  tenantId?: string;
}

export interface EntitlementProvider {
  isEnabled(featureKey: string, ctx: RequestContext): Promise<boolean>;
}

/**
 * OSS default: everything is enabled unless explicitly disabled via the
 * comma-separated, case-insensitive `DISABLED_FEATURES` env var. Read at call
 * time (not cached) so tests can flip it without a process restart.
 */
export class EnvEntitlements implements EntitlementProvider {
  async isEnabled(featureKey: string): Promise<boolean> {
    const disabled = (process.env.DISABLED_FEATURES ?? "")
      .split(",")
      .map((key) => key.trim().toLowerCase())
      .filter(Boolean);
    return !disabled.includes(featureKey.toLowerCase());
  }
}

let currentProvider: EntitlementProvider = new EnvEntitlements();

export function setEntitlementProvider(provider: EntitlementProvider): void {
  currentProvider = provider;
}

/** Minimal request shape needed to build a RequestContext, without depending on @heybray/identity. */
interface RequestWithOptionalUser extends Request {
  user?: { id?: number };
}

function buildRequestContext(req: RequestWithOptionalUser): RequestContext {
  return {
    userId: req.user?.id,
    tenantId: getTenantContext()?.tenantId,
  };
}

/** 403s with `{ message }` when the feature is disabled for the current request. */
export function requireFeature(key: string): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    currentProvider
      .isEnabled(key, buildRequestContext(req as RequestWithOptionalUser))
      .then((enabled) => {
        if (!enabled) {
          res.status(403).json({ message: `Feature "${key}" is disabled` });
          return;
        }
        next();
      })
      .catch(next);
  };
}

/**
 * GET /?keys=a,b,c -> { [key]: boolean }. Auth is the caller's responsibility
 * (mount behind authenticateToken, same pattern as other identity-gated routers)
 * — server-kit itself must not depend on @heybray/identity.
 */
export function createFeaturesRouter(): Router {
  const router = Router();

  router.get("/", async (req: RequestWithOptionalUser, res: Response) => {
    const raw = typeof req.query.keys === "string" ? req.query.keys : "";
    const keys = raw
      .split(",")
      .map((key) => key.trim())
      .filter(Boolean);

    const ctx = buildRequestContext(req);
    const entries = await Promise.all(
      keys.map(async (key) => [key, await currentProvider.isEnabled(key, ctx)] as const),
    );

    res.json(Object.fromEntries(entries));
  });

  return router;
}
