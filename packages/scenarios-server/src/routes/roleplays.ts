import { Router, Response } from "express";
import { isCheatModeEnabled } from "../config/cheat-mode.ts";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@heybray/server-kit";
import { roleplayAttempts } from "../schema/roleplay-core.ts";
import { roleplaySystemController } from "../controllers/roleplay-system.controller.ts";
import { scenarioResultsController } from "../controllers/scenario-results.controller.ts";
import { canViewMemberAttempt } from "@heybray/identity";
import { roleplayConfigService } from "../services/roleplay-config.service.ts";
import { RoleplayNotConfiguredError, describeRoleplayModelError } from "../roleplay/model-factory.ts";
import {
  nextRoleplayRunId,
  subscribeToRoleplayRun,
  setupRoleplaySse,
} from "../roleplay/roleplay-events.ts";
import { platformLogger } from "@heybray/server-kit";
import { requirePermission, authenticateToken, requirePasswordChanged, type AuthRequest } from "@heybray/identity";
import {
  transferImportBodySchema,
  transferScenarioSchema,
} from "../schema/roleplay-transfer.ts";
import {
  ROLEPLAY_PUBLISH_AI_REQUIRED_ERROR,
  ROLEPLAY_PUBLISH_ALLOWLIST_ERROR,
} from "../lib/roleplay-publish-rules.ts";

const bulkRoleplayPayloadSchema = z.object({
  roleplay: z.object({}).passthrough(),
  settings: z.object({}).passthrough().optional(),
  persona: z.object({}).passthrough().optional(),
  criteria: z.array(z.object({}).passthrough()).optional(),
  rewardTiers: z
    .array(
      z.object({
        id: z.number().optional(),
        starLevel: z.number().optional(),
        tierName: z.string(),
        minScorePercent: z.number(),
        rewardPoints: z.number(),
        orderIndex: z.number().optional(),
        color: z.string().nullable().optional(),
        icon: z.string().nullable().optional(),
      }),
    )
    .optional(),
  classifications: z
    .object({
      category: z.string().nullable().optional(),
      audienceLevel: z.string().nullable().optional(),
      duration: z.string().nullable().optional(),
      tags: z.array(z.string()).optional(),
    })
    .optional(),
});

function canManageRoleplays(user: AuthRequest["user"]): boolean {
  return user?.role?.permissions?.includes("roleplay:manage") ?? false;
}

function isDraftRoleplay(roleplay: { status?: string | null }): boolean {
  return roleplay.status !== "published";
}

async function getRoleplayForUser(
  req: AuthRequest,
  res: Response,
  roleplayId: number,
) {
  const roleplay = await roleplaySystemController.getRoleplayById(roleplayId);
  if (!roleplay) {
    res.status(404).json({ error: "Roleplay not found" });
    return null;
  }
  if (!canManageRoleplays(req.user) && isDraftRoleplay(roleplay)) {
    res.status(404).json({ error: "Roleplay not found" });
    return null;
  }
  return roleplay;
}

const router = Router();

function parseQueryStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String).map((t) => t.trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value.split(",").map((t) => t.trim()).filter(Boolean);
  }
  return [];
}

router.use(authenticateToken);
router.use(requirePasswordChanged);

router.get("/config-status", async (_req: AuthRequest, res: Response) => {
  try {
    const isReady = await roleplayConfigService.isConfigReady();
    res.json({ isReady, cheatModeEnabled: isCheatModeEnabled() });
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
    const page = req.query.page ? parseInt(String(req.query.page), 10) : undefined;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : undefined;
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const categories = parseQueryStringList(req.query.category);
    const audienceLevels = parseQueryStringList(req.query.audience_level);
    const durations = parseQueryStringList(req.query.duration);
    const difficulties = parseQueryStringList(req.query.difficulty);
    const tags = parseQueryStringList(req.query.tag);
    const myStatus =
      typeof req.query.myStatus === "string" ? req.query.myStatus : undefined;
    const sort =
      req.query.sort === "publishedAt" ? "publishedAt" : "createdAt";
    const publishedSinceRaw =
      typeof req.query.publishedSince === "string" ? req.query.publishedSince : undefined;
    const publishedSince = publishedSinceRaw ? new Date(publishedSinceRaw) : undefined;

    const [listResult, bestAttempts, pointsEarned, inProgressAttempts] = await Promise.all([
      roleplaySystemController.getRoleplays({
        publishedOnly: !canManageRoleplays(req.user),
        page,
        limit,
        search,
        categories,
        audienceLevels,
        durations,
        tags,
        difficulties,
        userId,
        myStatus,
        sort,
        publishedSince:
          publishedSince && !Number.isNaN(publishedSince.getTime())
            ? publishedSince
            : undefined,
      }),
      roleplaySystemController.getUserBestAttemptsByRoleplay(userId),
      roleplaySystemController.getUserPointsEarnedByRoleplay(userId),
      roleplaySystemController.getUserInProgressAttemptsByRoleplay(userId),
    ]);

    res.json({
      items: listResult.items.map((roleplay) => ({
        ...roleplay,
        myBestAttempt: bestAttempts.get((roleplay as { id: number }).id) ?? null,
        myPointsEarned: pointsEarned.get((roleplay as { id: number }).id) ?? 0,
        myInProgressAttempt:
          inProgressAttempts.get((roleplay as { id: number }).id) ?? null,
      })),
      total: listResult.total,
      page: listResult.page,
      limit: listResult.limit,
    });
  } catch (error) {
    platformLogger.error("list roleplays error", error instanceof Error ? error : undefined);
    res.status(500).json({ error: "Failed to get roleplays" });
  }
});

router.get("/export", requirePermission("roleplay:manage"), async (req: AuthRequest, res: Response) => {
  try {
    const idsParam = typeof req.query.ids === "string" ? req.query.ids : "";
    const ids = idsParam
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !Number.isNaN(n));
    if (!ids.length) {
      return res.status(400).json({ error: "Query parameter ids is required (comma-separated)" });
    }
    const { buffer, filename } = await roleplaySystemController.exportRoleplaysZip(ids);
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to export roleplays";
    if (message.startsWith("Roleplay not found")) {
      return res.status(404).json({ error: message });
    }
    platformLogger.error("export roleplays error", error instanceof Error ? error : undefined);
    res.status(500).json({ error: message });
  }
});

router.post("/import/preview", requirePermission("roleplay:manage"), async (req: AuthRequest, res: Response) => {
  try {
    const multer = (await import("multer")).default;
    const upload = multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024, files: 1 },
    });
    await new Promise<void>((resolve, reject) => {
      upload.single("file")(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    const file = (req as AuthRequest & { file?: Express.Multer.File }).file;
    if (!file) {
      return res.status(400).json({ error: "Zip file is required (field name: file)" });
    }
    const result = await roleplaySystemController.previewImportFromZip(file.buffer);
    res.json(result);
  } catch (error) {
    platformLogger.error("import preview error", error instanceof Error ? error : undefined);
    const message = error instanceof Error ? error.message : "Failed to preview import";
    res.status(400).json({ error: message });
  }
});

router.post("/import", requirePermission("roleplay:manage"), async (req: AuthRequest, res: Response) => {
  try {
    const contentType = req.headers["content-type"] ?? "";
    if (contentType.includes("multipart/form-data")) {
      const multer = (await import("multer")).default;
      const upload = multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: 20 * 1024 * 1024, files: 1 },
      });
      await new Promise<void>((resolve, reject) => {
        upload.single("file")(req, res, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      const file = (req as AuthRequest & { file?: Express.Multer.File }).file;
      if (!file) {
        return res.status(400).json({ error: "Zip file is required (field name: file)" });
      }
      const createMissingClassifications =
        (req.body as { createMissingClassifications?: string })?.createMissingClassifications ===
        "true";
      const result = await roleplaySystemController.importRoleplaysFromZip(
        req.user!.id,
        file.buffer,
        { createMissingClassifications },
      );
      return res.status(201).json(result);
    }

    const parsed = transferImportBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid payload", details: parsed.error.errors });
    }
    const scenarios = [];
    for (const s of parsed.data.scenarios) {
      const item = transferScenarioSchema.safeParse(s);
      if (!item.success) {
        return res.status(400).json({ error: "Invalid scenario", details: item.error.errors });
      }
      scenarios.push(item.data);
    }
    const result = await roleplaySystemController.importRoleplays(req.user!.id, scenarios);
    res.status(201).json(result);
  } catch (error) {
    platformLogger.error("import roleplays error", error instanceof Error ? error : undefined);
    const message = error instanceof Error ? error.message : "Failed to import roleplays";
    res.status(500).json({ error: message });
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
    if (error instanceof Error && error.name === "MediaValidationError") {
      return res.status(400).json({ error: error.message });
    }
    platformLogger.error("create roleplay error", error instanceof Error ? error : undefined);
    res.status(500).json({ error: "Failed to create roleplay" });
  }
});

router.get("/featured", async (req: AuthRequest, res: Response) => {
  try {
    const items = await roleplaySystemController.getFeaturedHeroItems(
      !canManageRoleplays(req.user),
    );
    res.json({ items });
  } catch (error) {
    platformLogger.error("featured roleplays error", error instanceof Error ? error : undefined);
    res.status(500).json({ error: "Failed to get featured scenarios" });
  }
});

router.get("/featured/manage", requirePermission("roleplay:manage"), async (_req: AuthRequest, res: Response) => {
  try {
    const items = await roleplaySystemController.getFeaturedManageList();
    res.json({ items });
  } catch (error) {
    platformLogger.error("featured manage list error", error instanceof Error ? error : undefined);
    res.status(500).json({ error: "Failed to get featured manage list" });
  }
});

router.put("/featured/manage", requirePermission("roleplay:manage"), async (req: AuthRequest, res: Response) => {
  try {
    const parsed = z.object({ roleplayIds: z.array(z.number().int().positive()) }).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid payload", details: parsed.error.errors });
    }
    await roleplaySystemController.setFeaturedManageList(parsed.data.roleplayIds);
    const items = await roleplaySystemController.getFeaturedManageList();
    res.json({ items });
  } catch (error) {
    platformLogger.error("featured manage update error", error instanceof Error ? error : undefined);
    res.status(500).json({ error: "Failed to update featured scenarios" });
  }
});

router.get("/popular", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;
    const ids = await roleplaySystemController.getPopularRoleplayIds(limit);
    const items = await roleplaySystemController.enrichBrowseItemsForUser(
      userId,
      ids,
      !canManageRoleplays(req.user),
    );
    res.json({ items });
  } catch (error) {
    platformLogger.error("popular roleplays error", error instanceof Error ? error : undefined);
    res.status(500).json({ error: "Failed to get popular scenarios" });
  }
});

router.get("/recommended", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;
    const ids = await roleplaySystemController.getRecommendedRoleplayIds(userId, limit);
    const items = await roleplaySystemController.enrichBrowseItemsForUser(
      userId,
      ids,
      !canManageRoleplays(req.user),
    );
    res.json({ items });
  } catch (error) {
    platformLogger.error("recommended roleplays error", error instanceof Error ? error : undefined);
    res.status(500).json({ error: "Failed to get recommended scenarios" });
  }
});

router.get("/room-for-improvement", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;
    const roleplayIds =
      await roleplaySystemController.getRoomForImprovementRoleplayIds(userId, limit);
    const items = await roleplaySystemController.enrichBrowseItemsForUser(
      userId,
      roleplayIds,
      !canManageRoleplays(req.user),
    );
    res.json({ items });
  } catch (error) {
    platformLogger.error(
      "room-for-improvement roleplays error",
      error instanceof Error ? error : undefined,
    );
    res.status(500).json({ error: "Failed to get room-for-improvement scenarios" });
  }
});

router.get("/continue", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 10;
    const continueItems = await roleplaySystemController.getContinueScenarios(userId, limit);
    const ids = continueItems.map((item) => item.roleplayId);
    const items = await roleplaySystemController.enrichBrowseItemsForUser(
      userId,
      ids,
      !canManageRoleplays(req.user),
    );
    res.json({ items });
  } catch (error) {
    platformLogger.error("continue roleplays error", error instanceof Error ? error : undefined);
    res.status(500).json({ error: "Failed to get continue scenarios" });
  }
});

router.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const roleplayId = parseInt(req.params.id);
    const roleplay = await getRoleplayForUser(req, res, roleplayId);
    if (!roleplay) return;

    if (!canManageRoleplays(req.user) && roleplay.persona) {
      const { hiddenObjective, ...personaRest } = roleplay.persona;
      return res.json({
        ...roleplay,
        persona: {
          ...personaRest,
          hasHiddenObjective: !!String(hiddenObjective ?? "").trim(),
        },
      });
    }

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
    if (error instanceof Error && error.name === "MediaValidationError") {
      return res.status(400).json({ error: error.message });
    }
    platformLogger.error("update roleplay error", error instanceof Error ? error : undefined);
    res.status(500).json({ error: "Failed to update roleplay" });
  }
});

router.delete("/:id", requirePermission("roleplay:manage"), async (req: AuthRequest, res: Response) => {
  try {
    const roleplayId = parseInt(req.params.id);
    const success = await roleplaySystemController.deleteRoleplay(roleplayId, req.user!.id);
    if (!success) return res.status(404).json({ error: "Roleplay not found" });
    res.json({ message: "Deleted" });
  } catch (error) {
    platformLogger.error("delete roleplay error", error instanceof Error ? error : undefined);
    res.status(500).json({ error: "Failed to delete roleplay" });
  }
});

router.post("/:id/duplicate", requirePermission("roleplay:manage"), async (req: AuthRequest, res: Response) => {
  try {
    const roleplayId = parseInt(req.params.id);
    if (Number.isNaN(roleplayId)) {
      return res.status(400).json({ error: "Invalid roleplay id" });
    }
    const roleplay = await roleplaySystemController.duplicateRoleplay(
      roleplayId,
      req.user!.id,
    );
    if (!roleplay) return res.status(404).json({ error: "Roleplay not found" });
    res.status(201).json(roleplay);
  } catch (error) {
    if (error instanceof Error && error.name === "MediaValidationError") {
      return res.status(400).json({ error: error.message });
    }
    platformLogger.error("duplicate roleplay error", error instanceof Error ? error : undefined);
    res.status(500).json({ error: "Failed to duplicate roleplay" });
  }
});

router.post("/:id/publish", requirePermission("roleplay:manage"), async (req: AuthRequest, res: Response) => {
  try {
    const roleplayId = parseInt(req.params.id);
    const roleplay = await roleplaySystemController.publishRoleplay(roleplayId, req.user!.id);
    if (!roleplay) return res.status(404).json({ error: "Roleplay not found" });
    res.json(roleplay);
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === ROLEPLAY_PUBLISH_AI_REQUIRED_ERROR ||
        error.message === ROLEPLAY_PUBLISH_ALLOWLIST_ERROR)
    ) {
      return res.status(400).json({ error: error.message });
    }
    platformLogger.error("publish error", error instanceof Error ? error : undefined);
    res.status(500).json({ error: "Failed to publish" });
  }
});

router.post("/:id/unpublish", requirePermission("roleplay:manage"), async (req: AuthRequest, res: Response) => {
  try {
    const roleplayId = parseInt(req.params.id);
    const roleplay = await roleplaySystemController.unpublishRoleplay(roleplayId, req.user!.id);
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
    if (!(await getRoleplayForUser(req, res, roleplayId))) return;
    const stats = await roleplaySystemController.getRoleplayStats(roleplayId);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: "Failed to get stats" });
  }
});

router.get("/:id/my-progress", async (req: AuthRequest, res: Response) => {
  try {
    const roleplayId = parseInt(req.params.id);
    if (!(await getRoleplayForUser(req, res, roleplayId))) return;
    const progress = await scenarioResultsController.getScenarioProgress(
      req.user!.id,
      roleplayId,
    );
    res.json(progress);
  } catch (error) {
    res.status(500).json({ error: "Failed to get progress" });
  }
});

router.get("/:id/leaderboard", async (req: AuthRequest, res: Response) => {
  try {
    const roleplayId = parseInt(req.params.id);
    if (!(await getRoleplayForUser(req, res, roleplayId))) return;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 3;
    const leaderboard = await roleplaySystemController.getScenarioLeaderboard(
      roleplayId,
      req.user!.id,
      Number.isNaN(limit) ? 3 : limit,
    );
    res.json(leaderboard);
  } catch (error) {
    res.status(500).json({ error: "Failed to get leaderboard" });
  }
});

router.get("/:id/my-attempts", async (req: AuthRequest, res: Response) => {
  try {
    const roleplayId = parseInt(req.params.id);
    if (!(await getRoleplayForUser(req, res, roleplayId))) return;
    const attempts = await roleplaySystemController.getUserAttempts(roleplayId, req.user!.id);
    res.json(attempts);
  } catch (error) {
    res.status(500).json({ error: "Failed to get attempts" });
  }
});

router.post("/:id/attempts", async (req: AuthRequest, res: Response) => {
  try {
    const roleplayId = parseInt(req.params.id);
    if (!(await getRoleplayForUser(req, res, roleplayId))) return;
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
    let results = await roleplaySystemController.getResults(attemptId, req.user!.id);
    if (!results) {
      const [attempt] = await db
        .select({ userId: roleplayAttempts.userId })
        .from(roleplayAttempts)
        .where(eq(roleplayAttempts.id, attemptId))
        .limit(1);
      if (!attempt) return res.status(404).json({ error: "Results not found" });
      const allowed = await canViewMemberAttempt(req.user!, attempt.userId);
      if (!allowed) return res.status(404).json({ error: "Results not found" });
      results = await roleplaySystemController.getResults(attemptId, attempt.userId);
    }
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
