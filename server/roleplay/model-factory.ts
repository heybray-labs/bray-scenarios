import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import {
  roleplayConfigService,
  RoleplayNotConfiguredError,
  type RoleplayProvider,
} from "../services/roleplay-config.service.ts";
import { createLogger } from "../utils/logger.ts";

const log = createLogger("roleplay-model");

export { RoleplayNotConfiguredError };

/**
 * OpenAI reasoning-model families only accept the API default temperature (1).
 * Passing any other value (including 0.2 for grading) returns 400.
 */
export function openAiSupportsCustomTemperature(model: string): boolean {
  const normalized = model.toLowerCase().trim();
  if (/^o[0-9]+(-|$)/.test(normalized)) return false;
  if (normalized.startsWith("gpt-5")) return false;
  if (normalized.includes("reasoning")) return false;
  return true;
}

function resolveTemperature(
  provider: RoleplayProvider,
  model: string,
  requested?: number,
): number | undefined {
  const temperature = requested ?? 0.7;
  if (provider === "openai" && !openAiSupportsCustomTemperature(model)) {
    return undefined;
  }
  return temperature;
}

export interface CreateRoleplayChatModelOptions {
  provider: RoleplayProvider;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Build a chat model for roleplay using explicit provider+model.
 */
export async function createRoleplayChatModel(
  options: CreateRoleplayChatModelOptions,
): Promise<BaseChatModel> {
  const { provider, model } = options;
  const apiKey = await roleplayConfigService.getDecryptedApiKeyForProvider(provider);

  if (!apiKey) {
    throw new RoleplayNotConfiguredError(
      `No API key configured for ${provider}. Configure it in Settings → AI.`,
    );
  }

  const temperature = resolveTemperature(provider, model, options.temperature);
  const maxTokens = options.maxTokens;

  log.debug("Creating roleplay chat model", { provider, model });

  switch (provider) {
    case "openai": {
      const openAiOptions: ConstructorParameters<typeof ChatOpenAI>[0] = {
        model,
        apiKey,
        ...(maxTokens !== undefined ? { maxTokens } : {}),
      };
      if (temperature !== undefined) {
        openAiOptions.temperature = temperature;
      }
      return new ChatOpenAI(openAiOptions);
    }
    case "anthropic": {
      const anthropic = new ChatAnthropic({
        model,
        apiKey,
        temperature,
        maxTokens,
      });
      (anthropic as { topP?: number; topK?: number }).topP = undefined;
      (anthropic as { topP?: number; topK?: number }).topK = undefined;
      return anthropic;
    }
    case "google":
      return new ChatGoogleGenerativeAI({
        model,
        apiKey,
        temperature,
        maxOutputTokens: maxTokens,
      });
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google Gemini",
};

/**
 * Turn a raw LLM/provider SDK error into a short, human-readable explanation
 * suitable for showing to an admin configuring the roleplay LLM.
 */
export function describeRoleplayModelError(
  error: unknown,
  provider?: string,
  model?: string,
): string {
  const providerLabel = (provider && PROVIDER_LABELS[provider]) || "the AI provider";
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const lower = raw.toLowerCase();

  if (
    lower.includes("401") ||
    lower.includes("incorrect api key") ||
    lower.includes("invalid api key") ||
    lower.includes("invalid_api_key") ||
    lower.includes("unauthorized") ||
    lower.includes("authentication") ||
    lower.includes("api key not valid") ||
    lower.includes("permission_denied")
  ) {
    return `${providerLabel} rejected the API key (authentication failed). Check that the key is correct, active, and belongs to ${providerLabel}.`;
  }

  if (lower.includes("429") || lower.includes("rate limit") || lower.includes("quota") || lower.includes("insufficient_quota") || lower.includes("billing")) {
    return `${providerLabel} rejected the request due to rate limits or insufficient quota/billing on this API key.`;
  }

  if (
    lower.includes("model") &&
    (lower.includes("not found") || lower.includes("does not exist") || lower.includes("404") || lower.includes("not_found") || lower.includes("do not have access"))
  ) {
    return `${providerLabel} does not recognise the model${model ? ` "${model}"` : ""}, or this API key can't access it. Pick a different model and try again.`;
  }

  if (lower.includes("temperature") && lower.includes("does not support")) {
    return `${providerLabel} model${model ? ` "${model}"` : ""} only supports the default temperature. Roleplay will omit custom temperature for this model automatically — retry the attempt. If this persists, choose a chat model such as gpt-4o-mini for more control.`;
  }

  if (lower.includes("top_p") && lower.includes("-1")) {
    return `${providerLabel} rejected invalid sampling parameters for${model ? ` "${model}"` : " this model"}. Retry the attempt — if it persists, try a different model.`;
  }

  if (lower.includes("timeout") || lower.includes("etimedout") || lower.includes("econnrefused") || lower.includes("enotfound") || lower.includes("network")) {
    return `Could not reach ${providerLabel} (network error). Check connectivity and try again.`;
  }

  const firstLine = raw.split("\n").find((l) => l.trim().length > 0)?.trim() || "Unknown error";
  return `${providerLabel} returned an error: ${firstLine}`;
}
