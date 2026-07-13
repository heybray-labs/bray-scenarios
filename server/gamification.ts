import { GamificationService, TeamStarMapService, type ReconcileReport } from "@heybray/gamification";
import { db } from "./db.ts";
import { roleplays } from "../shared/schemas/roleplay-core.ts";
import { createLogger } from "@heybray/server-kit";

const log = createLogger("gamification");

/** The single content type this deployment gamifies. */
export const SCENARIO_CONTENT_TYPE = "scenario";

/** Classification dimension used for mastery / category leaderboards. */
export const MASTERY_DIMENSION_SLUG = "category";

/** Permission string that gates management actions in the platform packages. */
export const MANAGE_PERMISSION = "roleplay:manage";

export const gamification = new GamificationService({
  contentTypes: [{ type: SCENARIO_CONTENT_TYPE, label: "Scenario" }],
  masteryDimensionSlug: MASTERY_DIMENSION_SLUG,
  managePermission: MANAGE_PERMISSION,
});

export const teamStarMap = new TeamStarMapService(gamification, {
  contentType: SCENARIO_CONTENT_TYPE,
  masteryDimensionSlug: MASTERY_DIMENSION_SLUG,
});

/**
 * Rebuilds the gamification_content projection from the app's roleplays table.
 * Called at boot after migrations; logs a warning on drift but does not crash.
 */
export async function reconcileGamificationProjection(): Promise<ReconcileReport> {
  const rows = await db
    .select({
      id: roleplays.id,
      title: roleplays.title,
      status: roleplays.status,
      published: roleplays.published,
    })
    .from(roleplays);

  const report = await gamification.reconcile(
    rows.map((r) => ({
      contentType: SCENARIO_CONTENT_TYPE,
      contentId: r.id,
      title: r.title,
      isActive: r.status === "published" && !!r.published,
    })),
  );

  if (report.inserted > 0 || report.updated > 0 || report.deactivated > 0) {
    log.warn("Gamification content projection drift reconciled", report);
  }

  return report;
}
