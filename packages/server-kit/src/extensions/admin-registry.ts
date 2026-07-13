import type { Router } from "express";

/**
 * Extension seam for enterprise packages that need to mount additional admin
 * routes dynamically. Nothing in Scenarios OSS needs this today — its 8 route
 * mounts are static `app.use(...)` calls in `server/app.ts` — so this ships
 * as a defined-but-unused interface + light in-memory class. This is a
 * deliberate scope reduction; see docs/phase-3-implementation.md. The client
 * half of AdminRegistry (`@heybray/react`'s `registerAdminPanel`) is real and
 * used.
 */
export interface AdminModule {
  /** Mount path, e.g. "/api/enterprise-billing". */
  path: string;
  router: Router;
}

export interface AdminModuleRegistry {
  register(module: AdminModule): void;
  list(): AdminModule[];
}

export class InMemoryAdminModuleRegistry implements AdminModuleRegistry {
  private readonly modules: AdminModule[] = [];

  register(module: AdminModule): void {
    this.modules.push(module);
  }

  list(): AdminModule[] {
    return [...this.modules];
  }
}

let registry: AdminModuleRegistry = new InMemoryAdminModuleRegistry();

export function setAdminModuleRegistry(next: AdminModuleRegistry): void {
  registry = next;
}

export function registerAdminModule(module: AdminModule): void {
  registry.register(module);
}

export function getAdminModules(): AdminModule[] {
  return registry.list();
}
