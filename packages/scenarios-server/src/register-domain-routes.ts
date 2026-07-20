import express from "express";
import roleplayRoutes from "./routes/roleplays.ts";
import roleplayConfigRoutes from "./routes/roleplay-config.ts";
import { configureRoleplayStrategies } from "./roleplay/strategies.ts";
import type { ScenariosServerDeps } from "./scenarios-server-deps.ts";

export type { ScenariosServerDeps };

/**
 * Mounts Scenarios domain routers only (no platform surfaces). Composed shells
 * (e.g. bray-premium) call this alongside their own shared media/taxonomy/
 * gamification/teams wiring.
 */
export function registerDomainRoutes(
  app: express.Application,
  deps: ScenariosServerDeps = {},
): void {
  configureRoleplayStrategies(deps);
  app.use("/api/roleplays", roleplayRoutes);
  app.use("/api/roleplay-config", roleplayConfigRoutes);
}
