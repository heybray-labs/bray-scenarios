import express from "express";
import bcrypt from "bcrypt";
import { loginSchema, setupAdminSchema, changePasswordSchema } from "../../shared/schemas/users.ts";
import { userController } from "../controllers/user.controller.ts";
import {
  authenticateToken,
  generateToken,
  generateRefreshToken,
  type AuthRequest,
} from "../middleware/auth.ts";
import { resolveTenantForLogin } from "../middleware/tenant.ts";
import {
  getPublicAuthConfig,
  isSsoEnabled,
  getAppUrl,
  getOidcRedirectUri,
} from "../config/auth-config.ts";
import { oidcAuthService, OIDC_STATE_COOKIE } from "../services/oidc-auth.service.ts";
import { samlAuthService, SAML_STATE_COOKIE } from "../services/saml-auth.service.ts";
import { completeExchange } from "../services/sso-exchange.service.ts";
import { db } from "../db.ts";
import { roles } from "../../shared/schemas/roles.ts";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { createLogger } from "../utils/logger.ts";

const log = createLogger("auth");

const router = express.Router();

router.get("/config", (_req, res) => {
  res.json(getPublicAuthConfig());
});

router.get("/setup-status", resolveTenantForLogin, async (req, res) => {
  try {
    const tenantId = (req as AuthRequest).tenantId!;
    const hasAdmin = await userController.hasAdminUser(tenantId);
    res.json({ needsSetup: !hasAdmin });
  } catch {
    res.status(500).json({ message: "Failed to check setup status" });
  }
});

router.post("/setup-admin", resolveTenantForLogin, async (req, res) => {
  try {
    const { name, email, password } = setupAdminSchema.parse(req.body);
    const tenantId = (req as AuthRequest).tenantId!;

    const hasAdmin = await userController.hasAdminUser(tenantId);
    if (hasAdmin) {
      return res.status(403).json({ message: "Admin account already exists" });
    }

    const existing = await userController.getUserByEmail(email, tenantId);
    if (existing) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const [adminRole] = await db.select().from(roles).where(eq(roles.name, "admin")).limit(1);
    if (!adminRole) {
      return res.status(500).json({ message: "Admin role not configured" });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await userController.createAdminUser({
      email,
      password: hashed,
      firstName: name,
      tenantId,
      roleId: adminRole.id,
    });

    const userWithRole = await userController.getUserWithRole(user.id);
    const token = generateToken(user.id, user.roleId, tenantId);
    const refreshToken = generateRefreshToken(user.id);

    log.info("Setup admin created", {
      userId: user.id,
      tenantId,
      requestId: (req as AuthRequest).requestId,
    });

    res.status(201).json({
      token,
      refreshToken,
      user: userWithRole,
      expiresIn: 86400,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", details: error.errors });
    }
    res.status(500).json({ message: "Failed to create admin account" });
  }
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().optional(),
});

router.post("/login", resolveTenantForLogin, async (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const tenantId = (req as AuthRequest).tenantId!;

    const user = await userController.getUserByEmail(email, tenantId);
    if (!user) {
      log.warn("Login failed", {
        reason: "unknown_user",
        tenantId,
        requestId: (req as AuthRequest).requestId,
      });
      log.debug("Login failed detail", { email, tenantId });
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (!user.password) {
      log.warn("Login failed", {
        reason: "sso_only_account",
        tenantId,
        userId: user.id,
        requestId: (req as AuthRequest).requestId,
      });
      return res.status(401).json({ message: "This account uses SSO sign-in" });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      log.warn("Login failed", {
        reason: "invalid_password",
        tenantId,
        userId: user.id,
        requestId: (req as AuthRequest).requestId,
      });
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const userWithRole = await userController.getUserWithRole(user.id);
    if (!userWithRole) {
      return res.status(401).json({ message: "User not found" });
    }

    const token = generateToken(user.id, user.roleId, tenantId);
    const refreshToken = generateRefreshToken(user.id);

    log.info("Login success", {
      userId: user.id,
      tenantId,
      requestId: (req as AuthRequest).requestId,
    });
    log.debug("Login success detail", { email, tenantId });

    res.json({
      token,
      refreshToken,
      user: userWithRole,
      expiresIn: 86400,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", details: error.errors });
    }
    res.status(500).json({ message: "Login failed" });
  }
});

router.post("/register", resolveTenantForLogin, async (req, res) => {
  if (isSsoEnabled()) {
    log.info("Registration blocked — SSO enabled", {
      requestId: (req as AuthRequest).requestId,
    });
    return res.status(403).json({ message: "Registration is disabled. Sign in with SSO." });
  }

  try {
    const { email, password, firstName } = registerSchema.parse(req.body);
    const tenantId = (req as AuthRequest).tenantId!;

    const existing = await userController.getUserByEmail(email, tenantId);
    if (existing) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const [userRole] = await db.select().from(roles).where(eq(roles.name, "user")).limit(1);
    if (!userRole) {
      return res.status(500).json({ message: "Default role not configured" });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await userController.createUser({
      email,
      password: hashed,
      firstName,
      roleId: userRole.id,
      tenantId,
    });

    const userWithRole = await userController.getUserWithRole(user.id);
    const token = generateToken(user.id, user.roleId, tenantId);
    const refreshToken = generateRefreshToken(user.id);

    log.info("User registered", {
      userId: user.id,
      tenantId,
      requestId: (req as AuthRequest).requestId,
    });

    res.status(201).json({
      token,
      refreshToken,
      user: userWithRole,
      expiresIn: 86400,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", details: error.errors });
    }
    res.status(500).json({ message: "Registration failed" });
  }
});

router.get("/me", authenticateToken, async (req: AuthRequest, res) => {
  res.json({ user: req.user });
});

router.post("/change-password", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    const userId = req.user!.id;

    const user = await userController.getUserById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.password) {
      return res.status(400).json({ message: "SSO accounts do not use a local password" });
    }

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      log.warn("Change password failed", {
        reason: "invalid_current_password",
        userId,
        requestId: req.requestId,
      });
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await userController.updatePassword(userId, hashed);

    log.info("Password changed", { userId, requestId: req.requestId });

    const userWithRole = await userController.getUserWithRole(userId);
    res.json({ user: userWithRole });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", details: error.errors });
    }
    res.status(500).json({ message: "Failed to change password" });
  }
});

router.get("/oidc/login", resolveTenantForLogin, async (req, res) => {
  const authReq = req as AuthRequest;
  try {
    const tenantId = authReq.tenantId!;
    log.info("OIDC login requested", { tenantId, requestId: authReq.requestId });
    await oidcAuthService.startLogin(res, tenantId);
  } catch (error) {
    log.error("OIDC login start failed", error instanceof Error ? error : undefined, {
      requestId: authReq.requestId,
      tenantId: authReq.tenantId,
    });
    const message = error instanceof Error ? error.message : "OIDC login failed";
    res.redirect(`${getAppUrl()}/login?error=${encodeURIComponent(message)}`);
  }
});

router.get("/oidc/callback", async (req, res) => {
  const authReq = req as AuthRequest;

  const providerError = typeof req.query.error === "string" ? req.query.error : undefined;
  if (providerError) {
    const description =
      typeof req.query.error_description === "string" ? req.query.error_description : undefined;
    log.warn("OIDC provider returned error", {
      error: providerError,
      description,
      requestId: authReq.requestId,
    });
    res.clearCookie(OIDC_STATE_COOKIE, { path: "/" });
    const message = description || providerError;
    return res.redirect(`${getAppUrl()}/login?error=${encodeURIComponent(message)}`);
  }

  try {
    const callbackUrl = new URL(getOidcRedirectUri());
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === "string") {
        callbackUrl.searchParams.set(key, value);
      }
    }
    const redirectUrl = await oidcAuthService.handleCallback(
      callbackUrl,
      req.cookies?.[OIDC_STATE_COOKIE],
    );
    res.clearCookie(OIDC_STATE_COOKIE, { path: "/" });
    log.debug("OIDC callback redirecting to SPA", { requestId: authReq.requestId });
    res.redirect(redirectUrl);
  } catch (error) {
    log.error("OIDC callback failed", error instanceof Error ? error : undefined, {
      requestId: authReq.requestId,
    });
    res.clearCookie(OIDC_STATE_COOKIE, { path: "/" });
    const message = error instanceof Error ? error.message : "OIDC sign-in failed";
    res.redirect(`${getAppUrl()}/login?error=${encodeURIComponent(message)}`);
  }
});

const ssoCompleteSchema = z.object({
  code: z.string().min(1),
});

async function handleSsoComplete(req: express.Request, res: express.Response, label: string) {
  const authReq = req as AuthRequest;
  try {
    const { code } = ssoCompleteSchema.parse(req.body);
    const result = await completeExchange(code);
    log.info(`${label} sign-in completed`, {
      userId: result.user.id,
      tenantId: result.user.tenantId,
      requestId: authReq.requestId,
    });
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      log.warn(`${label} complete invalid input`, { requestId: authReq.requestId });
      return res.status(400).json({ message: "Invalid input", details: error.errors });
    }
    log.error(`${label} complete failed`, error instanceof Error ? error : undefined, {
      requestId: authReq.requestId,
    });
    const message = error instanceof Error ? error.message : "SSO sign-in failed";
    res.status(401).json({ message });
  }
}

router.post("/sso/complete", (req, res) => handleSsoComplete(req, res, "SSO"));

router.post("/oidc/complete", (req, res) => handleSsoComplete(req, res, "OIDC"));

router.get("/saml/login", resolveTenantForLogin, async (req, res) => {
  const authReq = req as AuthRequest;
  try {
    const tenantId = authReq.tenantId!;
    log.info("SAML login requested", { tenantId, requestId: authReq.requestId });
    await samlAuthService.startLogin(res, tenantId);
  } catch (error) {
    log.error("SAML login start failed", error instanceof Error ? error : undefined, {
      requestId: authReq.requestId,
      tenantId: authReq.tenantId,
    });
    const message = error instanceof Error ? error.message : "SAML login failed";
    res.redirect(`${getAppUrl()}/login?error=${encodeURIComponent(message)}`);
  }
});

router.post(
  "/saml/acs",
  express.urlencoded({ extended: false }),
  async (req, res) => {
    const authReq = req as AuthRequest;
    try {
      const body: Record<string, string> = {};
      for (const [key, value] of Object.entries(req.body ?? {})) {
        if (typeof value === "string") {
          body[key] = value;
        }
      }

      const redirectUrl = await samlAuthService.handleAcs(body, req.cookies?.[SAML_STATE_COOKIE]);
      res.clearCookie(SAML_STATE_COOKIE, { path: "/" });
      log.debug("SAML ACS redirecting to SPA", { requestId: authReq.requestId });
      res.redirect(redirectUrl);
    } catch (error) {
      log.error("SAML ACS failed", error instanceof Error ? error : undefined, {
        requestId: authReq.requestId,
      });
      res.clearCookie(SAML_STATE_COOKIE, { path: "/" });
      const message = error instanceof Error ? error.message : "SAML sign-in failed";
      res.redirect(`${getAppUrl()}/login?error=${encodeURIComponent(message)}`);
    }
  },
);

router.get("/saml/metadata", async (_req, res) => {
  try {
    const metadata = await samlAuthService.getMetadata();
    res.type("application/xml").send(metadata);
  } catch (error) {
    const message = error instanceof Error ? error.message : "SAML metadata unavailable";
    res.status(503).json({ message });
  }
});

export default router;
