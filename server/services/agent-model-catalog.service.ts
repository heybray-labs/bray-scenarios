import OpenAI from "openai";
import type { AgentProvider } from "./agent-config.service.ts";
import { createLogger, logExternalCall } from "../utils/logger.ts";

const log = createLogger("model-catalog");

const LITELLM_PRICING_URL =
  "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export type AgentModelOption = {
  id: string;
  displayName: string;
  provider: AgentProvider;
  contextWindow?: number;
  maxOutputTokens?: number;
  inputPricePer1MUsd?: number;
  outputPricePer1MUsd?: number;
  supportsVision?: boolean;
  supportsTools?: boolean;
  source: "catalog" | "live" | "merged";
};

type LiteLlmEntry = {
  max_tokens?: number;
  max_input_tokens?: number;
  max_output_tokens?: number;
  input_cost_per_token?: number;
  output_cost_per_token?: number;
  supports_vision?: boolean;
  supports_function_calling?: boolean;
  mode?: string;
};

let catalogCache: {
  fetchedAt: number;
  byKey: Map<string, LiteLlmEntry>;
} | null = null;

function perMillion(perToken?: number): number | undefined {
  if (perToken == null || !Number.isFinite(perToken)) return undefined;
  return Math.round(perToken * 1_000_000 * 100) / 100;
}

function contextFromEntry(entry: LiteLlmEntry): number | undefined {
  return entry.max_input_tokens ?? entry.max_tokens;
}

async function loadLiteLlmCatalog(): Promise<Map<string, LiteLlmEntry>> {
  if (catalogCache && Date.now() - catalogCache.fetchedAt < CACHE_TTL_MS) {
    return catalogCache.byKey;
  }

  try {
    const fetchStart = Date.now();
    const res = await fetch(LITELLM_PRICING_URL, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      throw new Error(`LiteLLM catalog HTTP ${res.status}`);
    }
    const data = (await res.json()) as Record<string, LiteLlmEntry>;
    const byKey = new Map(Object.entries(data));
    catalogCache = { fetchedAt: Date.now(), byKey };
    const durationMs = Date.now() - fetchStart;
    logExternalCall({
      service: "litellm",
      operation: "fetch_catalog",
      durationMs,
      status: res.status,
      meta: { modelCount: byKey.size },
    });
    log.info("Agent model catalog loaded", {
      modelCount: byKey.size,
      durationMs,
    });
    return byKey;
  } catch (error) {
    log.warn("Failed to load LiteLLM model catalog", {
      error: error instanceof Error ? error.message : String(error),
    });
    if (catalogCache) {
      return catalogCache.byKey;
    }
    return new Map();
  }
}

function catalogKeysForProvider(
  provider: AgentProvider,
  key: string,
): string[] {
  const candidates = [key];
  if (provider === "google" && !key.startsWith("gemini/")) {
    candidates.push(`gemini/${key}`, `vertex_ai/${key}`);
  }
  if (provider === "anthropic" && !key.startsWith("anthropic/")) {
    candidates.push(`anthropic/${key}`);
  }
  return candidates;
}

function lookupCatalogEntry(
  catalog: Map<string, LiteLlmEntry>,
  provider: AgentProvider,
  modelId: string,
): LiteLlmEntry | undefined {
  for (const key of catalogKeysForProvider(provider, modelId)) {
    const entry = catalog.get(key);
    if (entry) return entry;
  }
  return undefined;
}

function matchesProvider(provider: AgentProvider, key: string): boolean {
  const k = key.toLowerCase();
  switch (provider) {
    case "openai":
      if (k.includes("/")) return false;
      return (
        k.startsWith("gpt-") ||
        k.startsWith("o1") ||
        k.startsWith("o3") ||
        k.startsWith("o4") ||
        k.startsWith("chatgpt-")
      );
    case "anthropic":
      return (
        k.startsWith("claude-") ||
        k.startsWith("anthropic/claude") ||
        k.includes("claude-")
      );
    case "google":
      return (
        k.startsWith("gemini") ||
        k.startsWith("gemini/") ||
        k.includes("gemini-")
      );
    default:
      return false;
  }
}

function normalizeModelId(provider: AgentProvider, rawId: string): string {
  let id = rawId;
  if (provider === "google" && id.startsWith("models/")) {
    id = id.replace(/^models\//, "");
  }
  if (provider === "anthropic" && id.startsWith("anthropic/")) {
    id = id.replace(/^anthropic\//, "");
  }
  if (provider === "google" && id.startsWith("gemini/")) {
    id = id.replace(/^gemini\//, "");
  }
  return id;
}

function entryToOption(
  provider: AgentProvider,
  modelId: string,
  entry: LiteLlmEntry,
  source: AgentModelOption["source"],
  displayName?: string,
): AgentModelOption {
  return {
    id: modelId,
    displayName: displayName ?? modelId,
    provider,
    contextWindow: contextFromEntry(entry),
    maxOutputTokens: entry.max_output_tokens,
    inputPricePer1MUsd: perMillion(entry.input_cost_per_token),
    outputPricePer1MUsd: perMillion(entry.output_cost_per_token),
    supportsVision: entry.supports_vision,
    supportsTools: entry.supports_function_calling,
    source,
  };
}

async function liveOpenAiModels(apiKey: string): Promise<string[]> {
  const client = new OpenAI({ apiKey });
  const page = await client.models.list();
  return page.data
    .map((m) => m.id)
    .filter((id) => matchesProvider("openai", id));
}

async function liveAnthropicModels(apiKey: string): Promise<
  { id: string; displayName?: string }[]
> {
  const res = await fetch("https://api.anthropic.com/v1/models?limit=100", {
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    throw new Error(`Anthropic models HTTP ${res.status}`);
  }
  const body = (await res.json()) as {
    data?: { id: string; display_name?: string }[];
  };
  return (body.data ?? []).map((m) => ({
    id: normalizeModelId("anthropic", m.id),
    displayName: m.display_name,
  }));
}

async function liveGoogleModels(apiKey: string): Promise<
  { id: string; displayName?: string; inputLimit?: number; outputLimit?: number }[]
> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
    { signal: AbortSignal.timeout(15_000) },
  );
  if (!res.ok) {
    throw new Error(`Google models HTTP ${res.status}`);
  }
  const body = (await res.json()) as {
    models?: {
      name: string;
      displayName?: string;
      inputTokenLimit?: number;
      outputTokenLimit?: number;
      supportedGenerationMethods?: string[];
    }[];
  };

  return (body.models ?? [])
    .filter((m) =>
      (m.supportedGenerationMethods ?? []).some((method) =>
        ["generateContent", "countTokens"].includes(method),
      ),
    )
    .map((m) => ({
      id: normalizeModelId("google", m.name),
      displayName: m.displayName,
      inputLimit: m.inputTokenLimit,
      outputLimit: m.outputTokenLimit,
    }));
}

/** List models from each vendor's official API, enriched with optional LiteLLM metadata. */
async function fetchLiveProviderModels(
  provider: AgentProvider,
  apiKey: string,
  catalog: Map<string, LiteLlmEntry>,
): Promise<AgentModelOption[]> {
  const fetchStart = Date.now();
  const byId = new Map<string, AgentModelOption>();

  if (provider === "openai") {
    const ids = await liveOpenAiModels(apiKey);
    for (const id of ids) {
      const entry = lookupCatalogEntry(catalog, provider, id);
      byId.set(
        id,
        entry
          ? entryToOption(provider, id, entry, "live")
          : { id, displayName: id, provider, source: "live" },
      );
    }
  }

  if (provider === "anthropic") {
    const live = await liveAnthropicModels(apiKey);
    for (const m of live) {
      const entry = lookupCatalogEntry(catalog, provider, m.id);
      byId.set(
        m.id,
        entry
          ? entryToOption(provider, m.id, entry, "live", m.displayName)
          : {
              id: m.id,
              displayName: m.displayName ?? m.id,
              provider,
              source: "live",
            },
      );
    }
  }

  if (provider === "google") {
    const live = await liveGoogleModels(apiKey);
    for (const m of live) {
      const entry = lookupCatalogEntry(catalog, provider, m.id);
      if (entry) {
        const opt = entryToOption(provider, m.id, entry, "live", m.displayName);
        opt.contextWindow = opt.contextWindow ?? m.inputLimit;
        opt.maxOutputTokens = opt.maxOutputTokens ?? m.outputLimit;
        byId.set(m.id, opt);
      } else {
        byId.set(m.id, {
          id: m.id,
          displayName: m.displayName ?? m.id,
          provider,
          contextWindow: m.inputLimit,
          maxOutputTokens: m.outputLimit,
          source: "live",
        });
      }
    }
  }

  const result = [...byId.values()].sort((a, b) =>
    a.displayName.localeCompare(b.displayName),
  );
  logExternalCall({
    service: provider,
    operation: "list_live_models",
    durationMs: Date.now() - fetchStart,
    status: 200,
    meta: { modelCount: result.length },
  });
  return result;
}

/** Static fallback when remote catalog is unavailable. */
const FALLBACK_MODELS: Record<AgentProvider, AgentModelOption[]> = {
  openai: [
    {
      id: "gpt-4o-mini",
      displayName: "GPT-4o mini",
      provider: "openai",
      contextWindow: 128000,
      source: "catalog",
    },
    {
      id: "gpt-4o",
      displayName: "GPT-4o",
      provider: "openai",
      contextWindow: 128000,
      source: "catalog",
    },
  ],
  anthropic: [
    {
      id: "claude-sonnet-4-20250514",
      displayName: "Claude Sonnet 4",
      provider: "anthropic",
      contextWindow: 200000,
      source: "catalog",
    },
  ],
  google: [
    {
      id: "gemini-2.0-flash",
      displayName: "Gemini 2.0 Flash",
      provider: "google",
      contextWindow: 1048576,
      source: "catalog",
    },
  ],
};

export class AgentModelCatalogService {
  async getModelsForProvider(
    provider: AgentProvider,
    options?: { refresh?: boolean; apiKey?: string },
  ): Promise<{
    provider: AgentProvider;
    models: AgentModelOption[];
    catalogUpdatedAt?: string;
    liveEnriched: boolean;
  }> {
    if (options?.refresh) {
      catalogCache = null;
    }

    let apiKey = options?.apiKey?.trim();
    if (!apiKey) {
      const { roleplayConfigService } = await import("./roleplay-config.service.ts");
      apiKey =
        (await roleplayConfigService.getDecryptedApiKeyForProvider(provider)) ??
        undefined;
    }

    if (!apiKey) {
      return {
        provider,
        models: [],
        liveEnriched: false,
      };
    }

    const catalog = await loadLiteLlmCatalog();

    try {
      const models = await fetchLiveProviderModels(provider, apiKey, catalog);
      return {
        provider,
        models,
        catalogUpdatedAt:
          catalogCache ?
            new Date(catalogCache.fetchedAt).toISOString()
          : undefined,
        liveEnriched: true,
      };
    } catch (error) {
      log.warn("Live model list failed; using static fallback", {
        provider,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        provider,
        models: FALLBACK_MODELS[provider],
        catalogUpdatedAt:
          catalogCache ?
            new Date(catalogCache.fetchedAt).toISOString()
          : undefined,
        liveEnriched: false,
      };
    }
  }

  /** Verify an API key by calling the provider's models list endpoint. */
  async testProviderApiKey(provider: AgentProvider, apiKey: string): Promise<void> {
    switch (provider) {
      case "openai":
        await liveOpenAiModels(apiKey);
        break;
      case "anthropic":
        await liveAnthropicModels(apiKey);
        break;
      case "google":
        await liveGoogleModels(apiKey);
        break;
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }
}

export const agentModelCatalogService = new AgentModelCatalogService();
