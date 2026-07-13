import { Router, Response } from "express";
import { authenticateToken, requirePasswordChanged, type AuthRequest } from "@heybray/identity";
import { createLogger } from "@heybray/server-kit";
import { gamification } from "../gamification.ts";

const log = createLogger("points");
const router = Router();

router.use(authenticateToken);
router.use(requirePasswordChanged);

router.get("/me", async (req: AuthRequest, res: Response) => {
  try {
    const summary = await gamification.getUserPointsSummary(req.user!.id);
    res.json(summary);
  } catch (error) {
    log.error("get points total error", error instanceof Error ? error : undefined);
    res.status(500).json({ error: "Failed to get points total" });
  }
});

router.get("/me/stats", async (req: AuthRequest, res: Response) => {
  try {
    const stats = await gamification.getUserProgressStats(req.user!.id);
    res.json(stats);
  } catch (error) {
    log.error("get progress stats error", error instanceof Error ? error : undefined);
    res.status(500).json({ error: "Failed to get progress stats" });
  }
});

router.get("/me/history", async (req: AuthRequest, res: Response) => {
  try {
    const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;
    const history = await gamification.getUserPointsHistory(req.user!.id, page, limit);
    // Preserve legacy field names until Step 6 renames the payload.
    res.json({
      ...history,
      items: history.items.map(({ contentId, activityId, contentTitle, ...rest }) => ({
        ...rest,
        roleplayId: contentId,
        attemptId: activityId,
        roleplayTitle: contentTitle,
      })),
    });
  } catch (error) {
    log.error("get points history error", error instanceof Error ? error : undefined);
    res.status(500).json({ error: "Failed to get points history" });
  }
});

router.get("/recent-stars", async (req: AuthRequest, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 15;
    const result = await gamification.getRecentStarAchievements({
      limit,
      currentUserId: req.user!.id,
    });
    // Preserve legacy field names until Step 6 renames the payload.
    res.json({
      items: result.items.map(({ contentId, contentTitle, ...rest }) => ({
        ...rest,
        roleplayId: contentId,
        scenarioTitle: contentTitle,
      })),
    });
  } catch (error) {
    log.error("get recent stars error", error instanceof Error ? error : undefined);
    res.status(500).json({ error: "Failed to get recent star achievements" });
  }
});

router.get("/leaderboard", async (req: AuthRequest, res: Response) => {
  try {
    const scope = req.query.scope === "category" ? "dimension-option" : "global";
    const period = req.query.period === "month" ? "month" : "all_time";
    const optionSlug =
      typeof req.query.category === "string" ? req.query.category : undefined;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;

    const result = await gamification.getLeaderboard({
      scope,
      optionSlug,
      period,
      limit,
      currentUserId: req.user!.id,
    });

    res.json(result);
  } catch (error) {
    log.error("get leaderboard error", error instanceof Error ? error : undefined);
    res.status(500).json({ error: "Failed to get leaderboard" });
  }
});

export default router;
