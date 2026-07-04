import { Router } from "express";
import { z } from "zod";
import {
  authenticateToken,
  requirePasswordChanged,
  requirePermission,
  type AuthRequest,
} from "../middleware/auth.ts";
import {
  roleplayConfigService,
  type RoleplayProvider,
} from "../services/roleplay-config.service.ts";
import {
  createRoleplayChatModel,
  describeRoleplayModelError,
  RoleplayNotConfiguredError,
} from "../roleplay/model-factory.ts";
import { agentModelCatalogService } from "../services/agent-model-catalog.service.ts";
import type { AgentProvider } from "../services/agent-config.service.ts";
import { platformLogger } from "../utils/logger.ts";

const router = Router();

const modelRefSchema = z.object({
  provider: z.enum(["openai", "anthropic", "google"]),
  model: z.string().min(1).max(200),
});

const keysSchema = z.object({
  openai: z.string().min(1).optional(),
  anthropic: z.string().min(1).optional(),
  google: z.string().min(1).optional(),
});

const allowlistsSchema = z.object({
  persona: z.array(modelRefSchema),
  grader: z.array(modelRefSchema),
});

const testSchema = z.object({
  purpose: z.enum(["persona", "grader"]).optional(),
  provider: z.enum(["openai", "anthropic", "google"]).optional(),
  model: z.string().min(1).max(200).optional(),
});

router.use(authenticateToken);
router.use(requirePasswordChanged);
router.use(requirePermission("roleplay:manage"));

const updateConfigSchema = z.object({
  keys: keysSchema.optional(),
  removeProviders: z.array(z.enum(["openai", "anthropic", "google"])).optional(),
  models: z.array(modelRefSchema),
});

router.get("/", async (_req: AuthRequest, res) => {
  try {
    const config = await roleplayConfigService.getFullConfig();
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/", async (req: AuthRequest, res) => {
  try {
    const parsed = updateConfigSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.errors });
    }
    const config = await roleplayConfigService.updateFullConfig(parsed.data);
    res.json(config);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Internal server error" });
  }
});

router.put("/keys", async (req: AuthRequest, res) => {
  try {
    const parsed = keysSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.errors });
    }
    const keys = await roleplayConfigService.upsertProviderKeys(parsed.data);
    res.json({ keys });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Internal server error" });
  }
});

router.put("/allowlists", async (req: AuthRequest, res) => {
  try {
    const parsed = allowlistsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.errors });
    }
    const allowlists = await roleplayConfigService.setAllowlists(parsed.data);
    res.json(allowlists);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Internal server error" });
  }
});

const modelCatalogSchema = z.object({
  provider: z.enum(["openai", "anthropic", "google"]),
  refresh: z.boolean().optional(),
  /** Unsaved key (e.g. after a successful test) — never log this value. */
  apiKey: z.string().min(1).optional(),
});

async function handleModelCatalog(
  provider: AgentProvider,
  options: { refresh?: boolean; apiKey?: string },
  res: import("express").Response,
) {
  try {
    const result = await agentModelCatalogService.getModelsForProvider(provider, options);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to load model catalog" });
  }
}

router.get("/model-catalog", async (req, res) => {
  const provider = req.query.provider as AgentProvider | undefined;
  if (!provider || !["openai", "anthropic", "google"].includes(provider)) {
    return res.status(400).json({ error: "Query param provider is required (openai | anthropic | google)" });
  }
  const refresh = req.query.refresh === "true";
  await handleModelCatalog(provider, { refresh }, res);
});

router.post("/model-catalog", async (req: AuthRequest, res) => {
  const parsed = modelCatalogSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: "provider is required (openai | anthropic | google)" });
  }
  const { provider, refresh, apiKey } = parsed.data;
  await handleModelCatalog(provider, { refresh, apiKey }, res);
});

const testKeySchema = z.object({
  provider: z.enum(["openai", "anthropic", "google"]),
  apiKey: z.string().min(1).optional(),
});

router.post("/test-key", async (req: AuthRequest, res) => {
  try {
    const parsed = testKeySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: "provider is required" });
    }
    const { provider } = parsed.data;
    let apiKey = parsed.data.apiKey?.trim();
    if (!apiKey) {
      apiKey = (await roleplayConfigService.getDecryptedApiKeyForProvider(provider)) ?? undefined;
    }
    if (!apiKey) {
      return res.json({ success: false, error: "Enter an API key to test." });
    }
    await agentModelCatalogService.testProviderApiKey(provider, apiKey);
    res.json({ success: true, provider });
  } catch (error) {
    platformLogger.warn("Roleplay API key test failed");
    const message =
      error instanceof Error ? error.message : "API key test failed";
    res.json({ success: false, error: message });
  }
});

router.post("/test", async (req: AuthRequest, res) => {
  let ref: { provider: RoleplayProvider; model: string } | null = null;
  try {
    const parsed = testSchema.safeParse(req.body ?? {});
    const purpose = parsed.success ? parsed.data.purpose ?? "persona" : "persona";
    if (!parsed.success || !parsed.data.provider || !parsed.data.model) {
      return res.json({
        success: false,
        error: "provider and model are required to test a connection.",
      });
    }
    ref = {
      provider: parsed.data.provider as RoleplayProvider,
      model: parsed.data.model,
    };

    await roleplayConfigService.assertModelAllowedForPurpose(purpose, ref);
    const temperature = purpose === "grader" ? 0.2 : 0;
    const model = await createRoleplayChatModel({
      provider: ref.provider,
      model: ref.model,
      temperature,
    });
    const response = await model.invoke([{ role: "user", content: "Reply with exactly: OK" }]);
    const text =
      typeof response.content === "string" ? response.content : JSON.stringify(response.content);
    res.json({ success: true, response: text.slice(0, 200), provider: ref.provider, model: ref.model, purpose });
  } catch (error) {
    if (error instanceof RoleplayNotConfiguredError) {
      return res.json({
        success: false,
        error: "No API key is saved for the selected provider.",
      });
    }
    const friendly = describeRoleplayModelError(error, ref?.provider, ref?.model);
    platformLogger.warn("Roleplay config test failed");
    res.json({ success: false, error: friendly });
  }
});

export default router;
