import { Router, Response } from "express";
import { z } from "zod";
import { roleplaySystemController } from "../controllers/roleplay-system.controller.ts";
import { roleplayConfigService } from "../services/roleplay-config.service.ts";
import { RoleplayNotConfiguredError, describeRoleplayModelError } from "../roleplay/model-factory.ts";
import {
  nextRoleplayRunId,
  subscribeToRoleplayRun,
  setupRoleplaySse,
} from "../roleplay/roleplay-events.ts";
import { platformLogger } from "../utils/logger.ts";
import { requirePermission, authenticateToken, requirePasswordChanged, type AuthRequest } from "../middleware/auth.ts";

const bulkRoleplayPayloadSchema = z.object({
  roleplay: z.object({}).passthrough(),
  settings: z.object({}).passthrough().optional(),
  persona: z.object({}).passthrough().optional(),
  criteria: z.array(z.object({}).passthrough()).optional(),
});

const router = Router();

router.use(authenticateToken);
router.use(requirePasswordChanged);

router.get("/config-status", async (_req: AuthRequest, res: Response) => {
  try {
    const isReady = await roleplayConfigService.isConfigReady();
    res.json({ isReady });
  } catch (error) {
    platformLogger.error("config-status error", error instanceof Error ? error : undefined);
    res.status(500).json({ error: "Failed to get config status" });
  }
});

router.get("/available-models", async (req: AuthRequest, res: Response) => {
  try {
    const models = await roleplayConfigService.getUnifiedAllowlist();
    res.json({ models });
  } catch (error) {
    platformLogger.error("available-models error", error instanceof Error ? error : undefined);
    res.status(500).json({ error: "Failed to get available models" });
  }
});

router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const [roleplays, bestAttempts] = await Promise.all([
      roleplaySystemController.getRoleplays(),
      roleplaySystemController.getUserBestAttemptsByRoleplay(userId),
    ]);
    res.json(
      roleplays.map((roleplay) => ({
        ...roleplay,
        myBestAttempt: bestAttempts.get(roleplay.id) ?? null,
      })),
    );
  } catch (error) {
    platformLogger.error("list roleplays error", error instanceof Error ? error : undefined);
    res.status(500).json({ error: "Failed to get roleplays" });
  }
});

router.post("/", requirePermission("roleplay:manage"), async (req: AuthRequest, res: Response) => {
  try {
    const parsed = bulkRoleplayPayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid payload", details: parsed.error.errors });
    }
    const roleplay = await roleplaySystemController.bulkSaveRoleplay(
      null,
      req.user!.id,
      parsed.data,
    );
    res.status(201).json(roleplay);
  } catch (error) {
    platformLogger.error("create roleplay error", error instanceof Error ? error : undefined);
    res.status(500).json({ error: "Failed to create roleplay" });
  }
});

router.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const roleplayId = parseInt(req.params.id);
    const roleplay = await roleplaySystemController.getRoleplayById(roleplayId);
    if (!roleplay) return res.status(404).json({ error: "Roleplay not found" });
    res.json(roleplay);
  } catch (error) {
    platformLogger.error("get roleplay error", error instanceof Error ? error : undefined);
    res.status(500).json({ error: "Failed to get roleplay" });
  }
});

router.put("/:id", requirePermission("roleplay:manage"), async (req: AuthRequest, res: Response) => {
  try {
    const roleplayId = parseInt(req.params.id);
    const parsed = bulkRoleplayPayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid payload", details: parsed.error.errors });
    }
    const roleplay = await roleplaySystemController.bulkSaveRoleplay(
      roleplayId,
      req.user!.id,
      parsed.data,
    );
    res.json(roleplay);
  } catch (error) {
    platformLogger.error("update roleplay error", error instanceof Error ? error : undefined);
    res.status(500).json({ error: "Failed to update roleplay" });
  }
});

router.delete("/:id", requirePermission("roleplay:manage"), async (req: AuthRequest, res: Response) => {
  try {
    const roleplayId = parseInt(req.params.id);
    const success = await roleplaySystemController.deleteRoleplay(roleplayId);
    if (!success) return res.status(404).json({ error: "Roleplay not found" });
    res.json({ message: "Deleted" });
  } catch (error) {
    platformLogger.error("delete roleplay error", error instanceof Error ? error : undefined);
    res.status(500).json({ error: "Failed to delete roleplay" });
  }
});

router.post("/:id/publish", requirePermission("roleplay:manage"), async (req: AuthRequest, res: Response) => {
  try {
    const roleplayId = parseInt(req.params.id);
    const roleplay = await roleplaySystemController.publishRoleplay(roleplayId);
    if (!roleplay) return res.status(404).json({ error: "Roleplay not found" });
    res.json(roleplay);
  } catch (error) {
    platformLogger.error("publish error", error instanceof Error ? error : undefined);
    res.status(500).json({ error: "Failed to publish" });
  }
});

router.post("/:id/unpublish", requirePermission("roleplay:manage"), async (req: AuthRequest, res: Response) => {
  try {
    const roleplayId = parseInt(req.params.id);
    const roleplay = await roleplaySystemController.unpublishRoleplay(roleplayId);
    if (!roleplay) return res.status(404).json({ error: "Roleplay not found" });
    res.json(roleplay);
  } catch (error) {
    platformLogger.error("unpublish error", error instanceof Error ? error : undefined);
    res.status(500).json({ error: "Failed to unpublish" });
  }
});

router.get("/:id/stats", async (req: AuthRequest, res: Response) => {
  try {
    const roleplayId = parseInt(req.params.id);
    const stats = await roleplaySystemController.getRoleplayStats(roleplayId);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: "Failed to get stats" });
  }
});

router.get("/:id/my-attempts", async (req: AuthRequest, res: Response) => {
  try {
    const roleplayId = parseInt(req.params.id);
    const attempts = await roleplaySystemController.getUserAttempts(roleplayId, req.user!.id);
    res.json(attempts);
  } catch (error) {
    res.status(500).json({ error: "Failed to get attempts" });
  }
});

router.post("/:id/attempts", async (req: AuthRequest, res: Response) => {
  try {
    const roleplayId = parseInt(req.params.id);
    const result = await roleplaySystemController.startAttempt(roleplayId, req.user!.id);
    res.json(result);
  } catch (error) {
    if (error instanceof RoleplayNotConfiguredError) {
      return res.status(409).json({ error: error.message });
    }
    if (error instanceof Error && error.message === "Maximum attempts reached") {
      return res.status(403).json({ error: error.message });
    }
    platformLogger.error("start attempt error", error instanceof Error ? error : undefined);
    const message =
      error instanceof Error
        ? describeRoleplayModelError(error)
        : "Failed to start attempt";
    res.status(500).json({ error: message });
  }
});

router.get("/:id/attempts/:attemptId", async (req: AuthRequest, res: Response) => {
  try {
    const attemptId = parseInt(req.params.attemptId);
    const attempt = await roleplaySystemController.getAttempt(attemptId, req.user!.id);
    if (!attempt) return res.status(404).json({ error: "Attempt not found" });
    const messages = await roleplaySystemController.getAttemptMessages(attemptId);
    res.json({ attempt, messages });
  } catch (error) {
    res.status(500).json({ error: "Failed to get attempt" });
  }
});

router.post("/:id/attempts/:attemptId/turn", async (req: AuthRequest, res: Response) => {
  try {
    const roleplayId = parseInt(req.params.id);
    const attemptId = parseInt(req.params.attemptId);
    const message = z.string().min(1).max(8000).parse(req.body?.message);

    const attempt = await roleplaySystemController.getAttempt(attemptId, req.user!.id);
    if (!attempt) return res.status(404).json({ error: "Attempt not found" });
    if (attempt.status !== "in_progress") {
      return res.status(400).json({ error: "Attempt is not active" });
    }

    const configured = await roleplayConfigService.isConfigured();
    if (!configured) {
      return res.status(409).json({ error: "Roleplay AI is not configured." });
    }

    const runId = nextRoleplayRunId();
    void roleplaySystemController.runPersonaTurn({
      attemptId,
      roleplayId,
      userId: req.user!.id,
      learnerText: message,
      runId,
    });

    res.status(202).json({ runId });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Message is required" });
    }
    res.status(500).json({ error: "Failed to post turn" });
  }
});

router.get("/:id/stream/:runId", async (req: AuthRequest, res: Response) => {
  const runId = parseInt(req.params.runId);
  if (isNaN(runId)) return res.status(400).json({ error: "Invalid run ID" });
  setupRoleplaySse(res);
  const unsubscribe = subscribeToRoleplayRun(runId, res);
  req.on("close", () => unsubscribe());
});

router.post("/:id/attempts/:attemptId/submit", async (req: AuthRequest, res: Response) => {
  try {
    const attemptId = parseInt(req.params.attemptId);
    const endReason = typeof req.body?.endReason === "string" ? req.body.endReason : "manual";
    const results = await roleplaySystemController.submitAttempt(attemptId, req.user!.id, endReason);
    if (!results) return res.status(404).json({ error: "Attempt not found" });
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: "Failed to submit attempt" });
  }
});

router.get("/:id/attempts/:attemptId/results", async (req: AuthRequest, res: Response) => {
  try {
    const attemptId = parseInt(req.params.attemptId);
    const results = await roleplaySystemController.getResults(attemptId, req.user!.id);
    if (!results) return res.status(404).json({ error: "Results not found" });
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: "Failed to get results" });
  }
});

router.get("/:id/attempts", requirePermission("roleplay:manage"), async (req: AuthRequest, res: Response) => {
  try {
    const roleplayId = parseInt(req.params.id);
    const attempts = await roleplaySystemController.getAllAttempts(roleplayId);
    res.json(attempts);
  } catch (error) {
    res.status(500).json({ error: "Failed to get attempts" });
  }
});

router.get("/:id/grading/:attemptId", requirePermission("roleplay:manage"), async (req: AuthRequest, res: Response) => {
  try {
    const attemptId = parseInt(req.params.attemptId);
    const roleplayId = parseInt(req.params.id);
    const all = await roleplaySystemController.getAllAttempts(roleplayId);
    const attempt = all.find((a) => a.id === attemptId);
    if (!attempt) return res.status(404).json({ error: "Attempt not found" });
    const results = await roleplaySystemController.getResults(attemptId, attempt.userId);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: "Failed to get grading detail" });
  }
});

router.post("/:id/criterion-scores/:scoreId/override", requirePermission("roleplay:manage"), async (req: AuthRequest, res: Response) => {
  try {
    const scoreId = parseInt(req.params.scoreId);
    const { score, feedback } = req.body ?? {};
    if (typeof score !== "number") {
      return res.status(400).json({ error: "score (number) is required" });
    }
    const result = await roleplaySystemController.overrideCriterionScore(
      scoreId,
      req.user!.id,
      score,
      typeof feedback === "string" ? feedback : undefined,
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to override score" });
  }
});

export default router;
