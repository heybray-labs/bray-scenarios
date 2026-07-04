import { Router, Response } from "express";
import { z } from "zod";
import { classificationService } from "../services/classification.service.ts";
import { requirePermission, authenticateToken, requirePasswordChanged, type AuthRequest } from "../middleware/auth.ts";
import { platformLogger } from "../utils/logger.ts";

const router = Router();

router.use(authenticateToken);
router.use(requirePasswordChanged);

router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const includeInactive = req.query.includeInactive === "true";
    const canManage = req.user?.role?.permissions?.includes("roleplay:manage") ?? false;
    const dimensions = canManage && includeInactive
      ? await classificationService.getDimensionsWithAllOptions()
      : await classificationService.getDimensionsWithOptions(false);
    res.json({ dimensions });
  } catch (error) {
    platformLogger.error("list classifications error", error instanceof Error ? error : undefined);
    res.status(500).json({ error: "Failed to get classifications" });
  }
});

const createOptionSchema = z.object({
  dimensionSlug: z.string().min(1),
  label: z.string().min(1),
  slug: z.string().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
});

router.post("/options", requirePermission("roleplay:manage"), async (req: AuthRequest, res: Response) => {
  try {
    const parsed = createOptionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      return;
    }
    const option = await classificationService.createOption(parsed.data);
    res.status(201).json({ option });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create option";
    platformLogger.error("create classification option error", error instanceof Error ? error : undefined);
    res.status(400).json({ error: message });
  }
});

const updateOptionSchema = z.object({
  label: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
});

const reorderSchema = z.object({
  direction: z.enum(["up", "down"]),
});

const reorderOptionsSchema = z.object({
  dimensionSlug: z.string().min(1),
  orderedOptionIds: z.array(z.coerce.number().int().positive()).min(1),
});

router.patch("/options/reorder", requirePermission("roleplay:manage"), async (req: AuthRequest, res: Response) => {
  try {
    const parsed = reorderOptionsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      return;
    }
    await classificationService.reorderOptions(
      parsed.data.dimensionSlug,
      parsed.data.orderedOptionIds,
    );
    res.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to reorder options";
    platformLogger.error("bulk reorder classification options error", error instanceof Error ? error : undefined);
    res.status(400).json({ error: message });
  }
});

router.patch("/options/:id", requirePermission("roleplay:manage"), async (req: AuthRequest, res: Response) => {
  try {
    const optionId = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(optionId)) {
      res.status(400).json({ error: "Invalid option id" });
      return;
    }
    const parsed = updateOptionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      return;
    }
    const option = await classificationService.updateOption(optionId, parsed.data);
    res.json({ option });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update option";
    platformLogger.error("update classification option error", error instanceof Error ? error : undefined);
    res.status(400).json({ error: message });
  }
});

router.patch("/options/:id/reorder", requirePermission("roleplay:manage"), async (req: AuthRequest, res: Response) => {
  try {
    const optionId = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(optionId)) {
      res.status(400).json({ error: "Invalid option id" });
      return;
    }
    const parsed = reorderSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      return;
    }
    const option = await classificationService.reorderOption(optionId, parsed.data.direction);
    res.json({ option });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to reorder option";
    platformLogger.error("reorder classification option error", error instanceof Error ? error : undefined);
    res.status(400).json({ error: message });
  }
});

router.delete("/options/:id", requirePermission("roleplay:manage"), async (req: AuthRequest, res: Response) => {
  try {
    const optionId = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(optionId)) {
      res.status(400).json({ error: "Invalid option id" });
      return;
    }
    await classificationService.deleteOption(optionId);
    res.status(204).send();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete option";
    platformLogger.error("delete classification option error", error instanceof Error ? error : undefined);
    res.status(400).json({ error: message });
  }
});

export default router;
