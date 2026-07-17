import express from "express";
import roleplayRoutes from "./routes/roleplays.ts";
import roleplayConfigRoutes from "./routes/roleplay-config.ts";

/** Optional dependency bag for the mountable module. */
export type ScenariosServerDeps = Record<string, unknown>;

/**
 * Mounts Scenarios domain routers only (no platform surfaces). Composed shells
 * (e.g. bray-premium) call this alongside their own shared media/taxonomy/
 * gamification/teams wiring.
 */
export function registerDomainRoutes(
  app: express.Application,
  _deps: ScenariosServerDeps = {},
): void {
  app.use("/api/roleplays", roleplayRoutes);
  app.use("/api/roleplay-config", roleplayConfigRoutes);
}
