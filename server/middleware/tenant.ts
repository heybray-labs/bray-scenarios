import { Request, Response, NextFunction } from "express";
import type { AuthRequest } from "./auth.ts";

/** Single-tenant: always attach tenant id=1 (or DEFAULT_TENANT_ID). */
export function resolveTenant(req: AuthRequest, _res: Response, next: NextFunction) {
  req.tenantId = parseInt(process.env.DEFAULT_TENANT_ID || "1", 10);
  next();
}

export function resolveTenantForLogin(req: Request, _res: Response, next: NextFunction) {
  (req as AuthRequest).tenantId = parseInt(process.env.DEFAULT_TENANT_ID || "1", 10);
  next();
}
