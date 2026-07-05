import { Router, Response } from "express";
import { pointsController } from "../controllers/points.controller.ts";
import { authenticateToken, requirePasswordChanged, type AuthRequest } from "../middleware/auth.ts";
import { createLogger } from "../utils/logger.ts";

const log = createLogger("points");
const router = Router();

router.use(authenticateToken);
router.use(requirePasswordChanged);

router.get("/me", async (req: AuthRequest, res: Response) => {
  try {
    const summary = await pointsController.getUserPointsSummary(req.user!.id);
    res.json(summary);
  } catch (error) {
    log.error("get points total error", error instanceof Error ? error : undefined);
    res.status(500).json({ error: "Failed to get points total" });
  }
});

router.get("/me/history", async (req: AuthRequest, res: Response) => {
  try {
    const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;
    const history = await pointsController.getUserPointsHistory(req.user!.id, page, limit);
    res.json(history);
  } catch (error) {
    log.error("get points history error", error instanceof Error ? error : undefined);
    res.status(500).json({ error: "Failed to get points history" });
  }
});

router.get("/leaderboard", async (req: AuthRequest, res: Response) => {
  try {
    const scope = req.query.scope === "category" ? "category" : "global";
    const period = req.query.period === "month" ? "month" : "all_time";
    const category =
      typeof req.query.category === "string" ? req.query.category : undefined;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;

    const result = await pointsController.getLeaderboard({
      scope,
      categorySlug: category,
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
