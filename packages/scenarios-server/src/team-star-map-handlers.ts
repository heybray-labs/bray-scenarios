import type { UserWithRole } from "@heybray/identity/schema";
import type { StarMapResponse } from "@heybray/gamification";
import { teamStarMapController } from "./controllers/team-star-map.controller.ts";
import type {
  MemberContentHistoryPayload,
} from "./controllers/team-star-map.controller.ts";

/** Team star-map grid — delegates to the platform TeamStarMapService. */
export async function getScenarioStarMap(
  user: UserWithRole,
  teamId: number | "all",
): Promise<StarMapResponse> {
  return teamStarMapController.getStarMap(user, teamId);
}

export async function getScenarioMemberProgress(
  user: UserWithRole,
  teamId: number | "all",
  memberUserId: number,
) {
  return teamStarMapController.getMemberProgress(user, teamId, memberUserId);
}

/** Content history with scenario cover enrichment. */
export async function getScenarioMemberContentHistory(
  user: UserWithRole,
  teamId: number | "all",
  memberUserId: number,
): Promise<MemberContentHistoryPayload> {
  return teamStarMapController.getMemberContentHistory(user, teamId, memberUserId);
}

/** Member drill-in for a scenario (roleplay) content id. */
export async function getScenarioMemberContentAttempts(
  user: UserWithRole,
  teamId: number | "all",
  memberUserId: number,
  contentId: number,
) {
  return teamStarMapController.getMemberContentAttempts(user, teamId, memberUserId, contentId);
}
