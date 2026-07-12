import { Router } from "express";
import { z } from "zod";
import {
  authenticateToken,
  requirePasswordChanged,
  requireRole,
  type AuthRequest,
} from "../middleware/auth.ts";
import {
  teamController,
  TeamAccessError,
  canAccessTeamView,
} from "../controllers/team.controller.ts";
import {
  createTeamSchema,
  updateTeamSchema,
  setTeamMembersSchema,
} from "../../shared/schemas/teams.ts";
import { createLogger } from "../utils/logger.ts";

const log = createLogger("teams");
const router = Router();

router.use(authenticateToken);
router.use(requirePasswordChanged);

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

const memberRoleplayParamSchema = z.object({
  id: z.union([z.literal("all"), z.coerce.number().int().positive()]),
  userId: z.coerce.number().int().positive(),
  roleplayId: z.coerce.number().int().positive(),
});

const numericTeamIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

router.get("/", requireTeamViewAccess, async (req: AuthRequest, res) => {
  try {
    const teams = await teamController.listTeamsForUser(req.user!);
    res.json({ teams });
  } catch (error) {
    if (error instanceof TeamAccessError) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    log.error("Failed to list teams", error instanceof Error ? error : undefined, {
      requestId: req.requestId,
    });
    res.status(500).json({ message: "Failed to list teams" });
  }
});

router.post("/", requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    const data = createTeamSchema.parse(req.body);
    const team = await teamController.createTeam(data);
    log.info("Team created", { teamId: team.id, requestId: req.requestId });
    res.status(201).json({ team });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", details: error.errors });
    }
    log.error("Failed to create team", error instanceof Error ? error : undefined, {
      requestId: req.requestId,
    });
    res.status(500).json({ message: "Failed to create team" });
  }
});

router.get("/:id/star-map", requireTeamViewAccess, async (req: AuthRequest, res) => {
  try {
    const { id } = teamIdParamSchema.parse(req.params);
    const data = await teamController.getStarMap(req.user!, id);
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
      const data = await teamController.getMemberProgress(req.user!, id, userId);
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
  "/:id/members/:userId/scenario-history",
  requireTeamViewAccess,
  async (req: AuthRequest, res) => {
    try {
      const { id, userId } = memberUserIdParamSchema.parse(req.params);
      const data = await teamController.getMemberScenarioHistory(req.user!, id, userId);
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
  "/:id/members/:userId/roleplays/:roleplayId/attempts",
  requireTeamViewAccess,
  async (req: AuthRequest, res) => {
    try {
      const { id, userId, roleplayId } = memberRoleplayParamSchema.parse(req.params);
      const attempts = await teamController.getMemberScenarioAttempts(
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

router.patch("/:id", requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    const { id } = numericTeamIdSchema.parse(req.params);
    const data = updateTeamSchema.parse(req.body);
    const team = await teamController.updateTeam(id, data);
    if (!team) return res.status(404).json({ message: "Team not found" });
    res.json({ team });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", details: error.errors });
    }
    log.error("Failed to update team", error instanceof Error ? error : undefined, {
      requestId: req.requestId,
    });
    res.status(500).json({ message: "Failed to update team" });
  }
});

router.delete("/:id", requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    const { id } = numericTeamIdSchema.parse(req.params);
    const deleted = await teamController.deleteTeam(id);
    if (!deleted) return res.status(404).json({ message: "Team not found" });
    log.info("Team deleted", { teamId: id, requestId: req.requestId });
    res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", details: error.errors });
    }
    log.error("Failed to delete team", error instanceof Error ? error : undefined, {
      requestId: req.requestId,
    });
    res.status(500).json({ message: "Failed to delete team" });
  }
});

router.put("/:id/members", requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    const { id } = numericTeamIdSchema.parse(req.params);
    const { memberIds } = setTeamMembersSchema.parse(req.body);
    const team = await teamController.setTeamMembers(id, memberIds);
    if (!team) return res.status(404).json({ message: "Team not found" });
    res.json({ team });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", details: error.errors });
    }
    log.error("Failed to set team members", error instanceof Error ? error : undefined, {
      requestId: req.requestId,
    });
    res.status(500).json({ message: "Failed to set team members" });
  }
});

export default router;
