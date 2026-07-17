import { Router } from "express";
import { z } from "zod";
import {
  type AuthRequest,
  TeamAccessError,
  canAccessTeamView,
} from "@heybray/identity";
import { teamStarMapController } from "../controllers/team-star-map.controller.ts";
import { createLogger } from "@heybray/server-kit";

const log = createLogger("teams");
const router = Router();

// Auth chain (authenticateToken + requirePasswordChanged) is applied once by the
// parent /api/teams wrapper router in server/app.ts.
async function requireTeamViewAccess(
  req: AuthRequest,
  res: import("express").Response,
  next: import("express").NextFunction,
) {
  if (!req.user) return res.status(401).json({ message: "Authentication required" });
  const allowed = await canAccessTeamView(req.user);
  if (!allowed) {
    return res.status(403).json({ message: "Insufficient permissions" });
  }
  next();
}

const teamIdParamSchema = z.object({
  id: z.union([z.literal("all"), z.coerce.number().int().positive()]),
});

const memberUserIdParamSchema = z.object({
  id: z.union([z.literal("all"), z.coerce.number().int().positive()]),
  userId: z.coerce.number().int().positive(),
});

const memberContentParamSchema = z.object({
  id: z.union([z.literal("all"), z.coerce.number().int().positive()]),
  userId: z.coerce.number().int().positive(),
  contentId: z.coerce.number().int().positive(),
});

/** @deprecated Legacy param shape — roleplayId is the scenario content id. */
const memberRoleplayParamSchema = z.object({
  id: z.union([z.literal("all"), z.coerce.number().int().positive()]),
  userId: z.coerce.number().int().positive(),
  roleplayId: z.coerce.number().int().positive(),
});

router.get("/:id/star-map", requireTeamViewAccess, async (req: AuthRequest, res) => {
  try {
    const { id } = teamIdParamSchema.parse(req.params);
    const data = await teamStarMapController.getStarMap(req.user!, id);
    res.json(data);
  } catch (error) {
    if (error instanceof TeamAccessError) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", details: error.errors });
    }
    if (error instanceof Error && error.message === "Team not found") {
      return res.status(404).json({ message: "Team not found" });
    }
    log.error("Failed to get star map", error instanceof Error ? error : undefined, {
      requestId: req.requestId,
    });
    res.status(500).json({ message: "Failed to get star map" });
  }
});

router.get(
  "/:id/members/:userId/progress",
  requireTeamViewAccess,
  async (req: AuthRequest, res) => {
    try {
      const { id, userId } = memberUserIdParamSchema.parse(req.params);
      const data = await teamStarMapController.getMemberProgress(req.user!, id, userId);
      res.json(data);
    } catch (error) {
      if (error instanceof TeamAccessError) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", details: error.errors });
      }
      log.error("Failed to get member progress", error instanceof Error ? error : undefined, {
        requestId: req.requestId,
      });
      res.status(500).json({ message: "Failed to get member progress" });
    }
  },
);

router.get(
  "/:id/members/:userId/content-history",
  requireTeamViewAccess,
  async (req: AuthRequest, res) => {
    try {
      const { id, userId } = memberUserIdParamSchema.parse(req.params);
      const data = await teamStarMapController.getMemberContentHistory(req.user!, id, userId);
      res.json(data);
    } catch (error) {
      if (error instanceof TeamAccessError) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", details: error.errors });
      }
      log.error("Failed to get member content history", error instanceof Error ? error : undefined, {
        requestId: req.requestId,
      });
      res.status(500).json({ message: "Failed to get member content history" });
    }
  },
);

/** @deprecated Legacy alias for content-history — response uses `scenarios` key. */
router.get(
  "/:id/members/:userId/scenario-history",
  requireTeamViewAccess,
  async (req: AuthRequest, res) => {
    try {
      const { id, userId } = memberUserIdParamSchema.parse(req.params);
      const data = await teamStarMapController.getMemberScenarioHistory(req.user!, id, userId);
      res.json(data);
    } catch (error) {
      if (error instanceof TeamAccessError) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", details: error.errors });
      }
      log.error("Failed to get member scenario history", error instanceof Error ? error : undefined, {
        requestId: req.requestId,
      });
      res.status(500).json({ message: "Failed to get member scenario history" });
    }
  },
);

router.get(
  "/:id/members/:userId/contents/:contentId/attempts",
  requireTeamViewAccess,
  async (req: AuthRequest, res) => {
    try {
      const { id, userId, contentId } = memberContentParamSchema.parse(req.params);
      const attempts = await teamStarMapController.getMemberContentAttempts(
        req.user!,
        id,
        userId,
        contentId,
      );
      res.json({ attempts });
    } catch (error) {
      if (error instanceof TeamAccessError) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", details: error.errors });
      }
      log.error("Failed to get member content attempts", error instanceof Error ? error : undefined, {
        requestId: req.requestId,
      });
      res.status(500).json({ message: "Failed to get member content attempts" });
    }
  },
);

/** @deprecated Legacy alias for contents/:contentId/attempts. */
router.get(
  "/:id/members/:userId/roleplays/:roleplayId/attempts",
  requireTeamViewAccess,
  async (req: AuthRequest, res) => {
    try {
      const { id, userId, roleplayId } = memberRoleplayParamSchema.parse(req.params);
      const attempts = await teamStarMapController.getMemberScenarioAttempts(
        req.user!,
        id,
        userId,
        roleplayId,
      );
      res.json({ attempts });
    } catch (error) {
      if (error instanceof TeamAccessError) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", details: error.errors });
      }
      log.error("Failed to get member scenario attempts", error instanceof Error ? error : undefined, {
        requestId: req.requestId,
      });
      res.status(500).json({ message: "Failed to get member scenario attempts" });
    }
  },
);

export default router;
