import { Router, Response } from "express";
import { authenticateToken, requirePasswordChanged, type AuthRequest } from "@heybray/identity";
import { createLogger } from "@heybray/server-kit";
import { GamificationService, type GamificationConfig } from "./service.ts";

const log = createLogger("gamification");

/**
 * Builds the /api/points routes (same paths as the app's legacy points router).
 * The public query contract is unchanged: `scope=category&category=<slug>` maps
 * onto the service's generic `dimension-option` scope + option slug.
 */
export function createGamificationRouter(config: GamificationConfig): Router {
  const service = new GamificationService(config);
  const router = Router();

  router.use(authenticateToken);
  router.use(requirePasswordChanged);

  router.get("/me", async (req: AuthRequest, res: Response) => {
    try {
      const summary = await service.getUserPointsSummary(req.user!.id);
      res.json(summary);
    } catch (error) {
      log.error("get points total error", error instanceof Error ? error : undefined);
      res.status(500).json({ error: "Failed to get points total" });
    }
  });

  router.get("/me/stats", async (req: AuthRequest, res: Response) => {
    try {
      const stats = await service.getUserProgressStats(req.user!.id);
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
      const history = await service.getUserPointsHistory(req.user!.id, page, limit);
      res.json(history);
    } catch (error) {
      log.error("get points history error", error instanceof Error ? error : undefined);
      res.status(500).json({ error: "Failed to get points history" });
    }
  });

  router.get("/recent-stars", async (req: AuthRequest, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 15;
      const result = await service.getRecentStarAchievements({
        limit,
        currentUserId: req.user!.id,
      });
      res.json(result);
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

      const result = await service.getLeaderboard({
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

  return router;
}
