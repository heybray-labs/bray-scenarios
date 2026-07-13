import { Router } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
import {
  authenticateToken,
  requirePasswordChanged,
  requireRole,
  type AuthRequest,
} from "../middleware/auth.ts";
import { userController } from "../controllers/user.controller.ts";
import { adminCreateUserSchema, updateUserRoleSchema } from "../schema/users.ts";
import { isSsoEnabled } from "../auth-config.ts";
import { roles } from "../schema/roles.ts";
import { eq } from "drizzle-orm";
import { createLogger, db, eventBus } from "@heybray/server-kit";

const log = createLogger("users");
const router = Router();

router.use(authenticateToken);
router.use(requirePasswordChanged);
router.use(requireRole("admin"));

router.get("/", async (req: AuthRequest, res) => {
  try {
    const users = await userController.listUsers();
    res.json({ users });
  } catch (error) {
    log.error("Failed to list users", error instanceof Error ? error : undefined, {
      requestId: req.requestId,
    });
    res.status(500).json({ message: "Failed to list users" });
  }
});

router.post("/", async (req: AuthRequest, res) => {
  if (isSsoEnabled()) {
    return res.status(403).json({ message: "User creation is disabled when SSO is enabled" });
  }

  try {
    const { email, firstName, password, role } = adminCreateUserSchema.parse(req.body);

    const existing = await userController.getUserByEmail(email);
    if (existing) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const [roleRow] = await db.select().from(roles).where(eq(roles.name, role)).limit(1);
    if (!roleRow) {
      return res.status(500).json({ message: `Role not configured: ${role}` });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await userController.createUser({
      email,
      password: hashed,
      firstName,
      roleId: roleRow.id,
      mustChangePassword: true,
    });

    log.info("Admin created user", {
      userId: user.id,
      role,
      requestId: req.requestId,
    });

    const userWithRole = await userController.getUserWithRole(user.id);
    res.status(201).json({ user: userWithRole });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", details: error.errors });
    }
    log.error("Failed to create user", error instanceof Error ? error : undefined, {
      requestId: req.requestId,
    });
    res.status(500).json({ message: "Failed to create user" });
  }
});

const userIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

router.patch("/:id/role", async (req: AuthRequest, res) => {
  try {
    const { id: targetId } = userIdParamSchema.parse(req.params);
    const { role } = updateUserRoleSchema.parse(req.body);
    const actorId = req.user!.id;

    if (targetId === actorId) {
      return res.status(403).json({ message: "Cannot change your own role" });
    }

    const target = await userController.getUserById(targetId);
    if (!target) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!target.isActive || target.isSuspended) {
      return res.status(400).json({ message: "Cannot change role for inactive or suspended user" });
    }

    const targetWithRole = await userController.getUserWithRole(targetId);
    const currentRole = targetWithRole?.role?.name;

    if (currentRole === "admin" && role === "user") {
      const adminCount = await userController.countAdmins();
      if (adminCount <= 1) {
        return res.status(403).json({ message: "Cannot remove the last admin" });
      }
    }

    if (currentRole === role) {
      const userWithRole = await userController.getUserWithRole(targetId);
      return res.json({ user: userWithRole });
    }

    const updated = await userController.updateUserRole(targetId, role);
    if (!updated) {
      return res.status(404).json({ message: "User not found" });
    }

    log.info("User role updated", {
      targetId,
      role,
      actorId,
      requestId: req.requestId,
    });
    eventBus.emit("user.role.changed", {
      actorId,
      targetUserId: targetId,
      previousRole: currentRole ?? "unknown",
      newRole: role,
    });

    const userWithRole = await userController.getUserWithRole(targetId);
    res.json({ user: userWithRole });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", details: error.errors });
    }
    log.error("Failed to update user role", error instanceof Error ? error : undefined, {
      requestId: req.requestId,
    });
    res.status(500).json({ message: "Failed to update user role" });
  }
});

export default router;
