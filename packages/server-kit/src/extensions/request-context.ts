import { AsyncLocalStorage } from "node:async_hooks";
import type { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Extension seam: resolves the current request's tenant. The OSS default
 * (`NullTenantResolver`) always returns `null` — Scenarios itself is single-tenant.
 * An enterprise package can call `setTenantResolver()` to supply a real one.
 */
export interface TenantContext {
  tenantId: string;
}

export interface TenantResolver {
  resolve(req: Request): Promise<TenantContext | null>;
}

export class NullTenantResolver implements TenantResolver {
  async resolve(): Promise<null> {
    return null;
  }
}

let currentResolver: TenantResolver = new NullTenantResolver();

export function setTenantResolver(resolver: TenantResolver): void {
  currentResolver = resolver;
}

const tenantContextStorage = new AsyncLocalStorage<TenantContext | null>();

/** The tenant context for the request currently executing, or `null` outside one. */
export function getTenantContext(): TenantContext | null {
  return tenantContextStorage.getStore() ?? null;
}

export function runWithTenantContext<T>(context: TenantContext | null, fn: () => T): T {
  return tenantContextStorage.run(context, fn);
}

/** Resolves the tenant for the request, then runs downstream middleware inside its ALS context. */
export function tenantContextMiddleware(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    currentResolver
      .resolve(req)
      .then((context) => {
        tenantContextStorage.run(context, next);
      })
      .catch(next);
  };
}
