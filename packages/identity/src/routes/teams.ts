import { Router } from "express";
import { z } from "zod";
import { requireRole, type AuthRequest } from "../middleware/auth.ts";
import {
  teamController,
  TeamAccessError,
  canAccessTeamView,
} from "../controllers/team.controller.ts";
import {
  createTeamSchema,
  updateTeamSchema,
  setTeamMembersSchema,
} from "../schema/teams.ts";
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
