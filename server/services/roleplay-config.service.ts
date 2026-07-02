import { db } from "../db.ts";
import {
  roleplayAppConfig,
  roleplayProviderKeys,
  roleplayAllowedPersonaModels,
  roleplayAllowedGraderModels,
} from "../../shared/schemas/agent/roleplay-app-config.ts";
import { roleplaySettings } from "../../shared/schemas/roleplay-core.ts";
import { encryptSecret, decryptSecret } from "../utils/secret-encryption.ts";
import { platformLogger } from "../utils/logger.ts";
import { eq } from "drizzle-orm";

export type RoleplayProvider = "openai" | "anthropic" | "google";
export type RoleplayModelPurpose = "persona" | "grader";

export interface RoleplayModelRef {
  provider: RoleplayProvider;
  model: string;
}

export interface RoleplayProviderKeyStatus {
  provider: RoleplayProvider;
  hasKey: boolean;
}

export interface RoleplayFullConfigPublic {
  keys: RoleplayProviderKeyStatus[];
  allowedModels: RoleplayModelRef[];
  isReady: boolean;
  updatedAt?: Date;
}

export interface RoleplayConfigUpdateInput {
  keys?: Partial<Record<RoleplayProvider, string>>;
  removeProviders?: RoleplayProvider[];
  models: RoleplayModelRef[];
}

const PROVIDERS: RoleplayProvider[] = ["openai", "anthropic", "google"];

function assertProvider(provider: string): asserts provider is RoleplayProvider {
  if (!PROVIDERS.includes(provider as RoleplayProvider)) {
    throw new Error(`Invalid provider: ${provider}`);
  }
}

function normalizeModelRef(ref: RoleplayModelRef): RoleplayModelRef {
  assertProvider(ref.provider);
  const model = ref.model?.trim();
  if (!model) throw new Error("Model is required");
  return { provider: ref.provider, model };
}

function modelKey(ref: RoleplayModelRef): string {
  return `${ref.provider}:${ref.model}`;
}

/**
 * Roleplay LLM configuration. Managed by admins only.
 */
export class RoleplayConfigService {
  private async ensureConfigRow() {
    const existing = await db.select().from(roleplayAppConfig).limit(1);
    if (existing.length) return existing[0];
    const [created] = await db.insert(roleplayAppConfig).values({}).returning();
    return created;
  }

  async getProviderKeys(): Promise<RoleplayProviderKeyStatus[]> {
    const rows = await db.select().from(roleplayProviderKeys);
    const byProvider = new Map(rows.map((r) => [r.provider, r]));
    return PROVIDERS.map((provider) => ({
      provider,
      hasKey: !!byProvider.get(provider)?.encryptedApiKey,
    }));
  }

  async getDecryptedApiKeyForProvider(
    provider: RoleplayProvider,
  ): Promise<string | null> {
    const rows = await db
      .select()
      .from(roleplayProviderKeys)
      .where(eq(roleplayProviderKeys.provider, provider))
      .limit(1);
    if (!rows.length || !rows[0].encryptedApiKey) {
      const legacy = await db.select().from(roleplayAppConfig).limit(1);
      if (
        legacy.length &&
        legacy[0].provider === provider &&
        legacy[0].encryptedApiKey
      ) {
        try {
          return decryptSecret(legacy[0].encryptedApiKey);
        } catch {
          return null;
        }
      }
      return null;
    }
    try {
      return decryptSecret(rows[0].encryptedApiKey);
    } catch (error) {
      platformLogger.error(
        "Failed to decrypt roleplay API key",
        error instanceof Error ? error : new Error(String(error)),
        { provider },
      );
      return null;
    }
  }

  /** @deprecated use getDecryptedApiKeyForProvider with explicit provider */
  async getDecryptedApiKey(): Promise<string | null> {
    for (const provider of PROVIDERS) {
      const key = await this.getDecryptedApiKeyForProvider(provider);
      if (key) return key;
    }
    return null;
  }

  async getAllowlist(purpose: RoleplayModelPurpose): Promise<RoleplayModelRef[]> {
    if (purpose === "persona") {
      const rows = await db.select().from(roleplayAllowedPersonaModels);
      return rows.map((r) => ({
        provider: r.provider as RoleplayProvider,
        model: r.model,
      }));
    }
    const rows = await db.select().from(roleplayAllowedGraderModels);
    return rows.map((r) => ({
      provider: r.provider as RoleplayProvider,
      model: r.model,
    }));
  }

  /** Union of persona and grader allowlists, deduped by provider:model. */
  async getUnifiedAllowlist(): Promise<RoleplayModelRef[]> {
    const [persona, grader] = await Promise.all([
      this.getAllowlist("persona"),
      this.getAllowlist("grader"),
    ]);
    const seen = new Set<string>();
    const result: RoleplayModelRef[] = [];
    for (const m of [...persona, ...grader]) {
      const key = modelKey(m);
      if (!seen.has(key)) {
        seen.add(key);
        result.push(m);
      }
    }
    return result;
  }

  async getDefaults(): Promise<{
    persona: RoleplayModelRef | null;
    grader: RoleplayModelRef | null;
  }> {
    const rows = await db.select().from(roleplayAppConfig).limit(1);
    if (!rows.length) {
      return { persona: null, grader: null };
    }
    const row = rows[0];
    const persona =
      row.defaultPersonaProvider && row.defaultPersonaModel
        ? {
            provider: row.defaultPersonaProvider as RoleplayProvider,
            model: row.defaultPersonaModel,
          }
        : row.provider && row.model
          ? { provider: row.provider as RoleplayProvider, model: row.model }
          : null;
    const grader =
      row.defaultGraderProvider && row.defaultGraderModel
        ? {
            provider: row.defaultGraderProvider as RoleplayProvider,
            model: row.defaultGraderModel,
          }
        : row.provider && row.model
          ? { provider: row.provider as RoleplayProvider, model: row.model }
          : null;
    return { persona, grader };
  }

  async getFullConfig(): Promise<RoleplayFullConfigPublic> {
    await this.ensureConfigRow();
    const [keys, allowedModels, row] = await Promise.all([
      this.getProviderKeys(),
      this.getUnifiedAllowlist(),
      db.select().from(roleplayAppConfig).limit(1),
    ]);
    const isReady = await this.isConfigReady();
    return {
      keys,
      allowedModels,
      isReady,
      updatedAt: row[0]?.updatedAt,
    };
  }

  async isConfigReady(): Promise<boolean> {
    const allowedModels = await this.getUnifiedAllowlist();
    if (!allowedModels.length) return false;

    const providersNeeded = new Set<RoleplayProvider>();
    for (const m of allowedModels) {
      providersNeeded.add(m.provider);
    }
    for (const provider of providersNeeded) {
      const key = await this.getDecryptedApiKeyForProvider(provider);
      if (!key) return false;
    }
    return true;
  }

  /** @deprecated use isConfigReady */
  async isConfigured(): Promise<boolean> {
    return this.isConfigReady();
  }

  assertModelAllowed(
    purpose: RoleplayModelPurpose,
    ref: RoleplayModelRef,
    allowlist?: RoleplayModelRef[],
  ): void {
    const normalized = normalizeModelRef(ref);
    const list = allowlist;
    if (!list) {
      throw new Error(`Model ${normalized.model} is not in the ${purpose} allowlist`);
    }
    const allowed = list.some((m) => modelKey(m) === modelKey(normalized));
    if (!allowed) {
      throw new Error(
        `Model ${normalized.provider}/${normalized.model} is not in the ${purpose} allowlist`,
      );
    }
  }

  async assertModelAllowedForPurpose(
    purpose: RoleplayModelPurpose,
    ref: RoleplayModelRef,
  ): Promise<void> {
    const allowlist = await this.getUnifiedAllowlist();
    this.assertModelAllowed(purpose, ref, allowlist);
    const key = await this.getDecryptedApiKeyForProvider(ref.provider);
    if (!key) {
      throw new Error(`No API key configured for provider ${ref.provider}`);
    }
  }

  async resolveModelsForRoleplay(
    roleplayId: number,
  ): Promise<{ persona: RoleplayModelRef; grader: RoleplayModelRef }> {
    const [settings] = await db
      .select()
      .from(roleplaySettings)
      .where(eq(roleplaySettings.roleplayId, roleplayId))
      .limit(1);

    if (!settings?.personaProvider || !settings?.personaModel) {
      throw new RoleplayNotConfiguredError(
        "This roleplay does not have a persona model configured.",
      );
    }
    if (!settings?.graderProvider || !settings?.graderModel) {
      throw new RoleplayNotConfiguredError(
        "This roleplay does not have a grader model configured.",
      );
    }

    const persona: RoleplayModelRef = {
      provider: settings.personaProvider as RoleplayProvider,
      model: settings.personaModel,
    };
    const grader: RoleplayModelRef = {
      provider: settings.graderProvider as RoleplayProvider,
      model: settings.graderModel,
    };

    await this.assertModelAllowedForPurpose("persona", persona);
    await this.assertModelAllowedForPurpose("grader", grader);

    return { persona, grader };
  }

  async resolveModelsFromAttemptSnapshot(attempt: {
    personaProvider?: string | null;
    personaModel?: string | null;
    graderProvider?: string | null;
    graderModel?: string | null;
  }): Promise<{ persona: RoleplayModelRef; grader: RoleplayModelRef } | null> {
    if (
      attempt.personaProvider &&
      attempt.personaModel &&
      attempt.graderProvider &&
      attempt.graderModel
    ) {
      return {
        persona: {
          provider: attempt.personaProvider as RoleplayProvider,
          model: attempt.personaModel,
        },
        grader: {
          provider: attempt.graderProvider as RoleplayProvider,
          model: attempt.graderModel,
        },
      };
    }
    return null;
  }

  async upsertProviderKeys(
    keys: Partial<Record<RoleplayProvider, string>>,
  ): Promise<RoleplayProviderKeyStatus[]> {
    await this.ensureConfigRow();
    for (const provider of PROVIDERS) {
      const raw = keys[provider];
      if (!raw?.trim()) continue;
      const encrypted = encryptSecret(raw.trim());
      const existing = await db
        .select()
        .from(roleplayProviderKeys)
        .where(eq(roleplayProviderKeys.provider, provider))
        .limit(1);
      if (existing.length) {
        await db
          .update(roleplayProviderKeys)
          .set({ encryptedApiKey: encrypted, updatedAt: new Date() })
          .where(eq(roleplayProviderKeys.id, existing[0].id));
      } else {
        await db.insert(roleplayProviderKeys).values({
          provider,
          encryptedApiKey: encrypted,
        });
      }
    }
    const configRows = await db.select().from(roleplayAppConfig).limit(1);
    if (configRows.length) {
      await db
        .update(roleplayAppConfig)
        .set({ updatedAt: new Date() })
        .where(eq(roleplayAppConfig.id, configRows[0].id));
    }
    return this.getProviderKeys();
  }

  async setAllowlists(input: {
    persona: RoleplayModelRef[];
    grader: RoleplayModelRef[];
  }): Promise<{ persona: RoleplayModelRef[]; grader: RoleplayModelRef[] }> {
    const models = input.persona.map(normalizeModelRef);
    await this.setUnifiedAllowlist(models);
    return { persona: models, grader: models };
  }

  async setUnifiedAllowlist(models: RoleplayModelRef[]): Promise<RoleplayModelRef[]> {
    await this.ensureConfigRow();
    const normalized = models.map(normalizeModelRef);

    await db.delete(roleplayAllowedPersonaModels);
    await db.delete(roleplayAllowedGraderModels);

    if (normalized.length) {
      const rows = normalized.map((m) => ({
        provider: m.provider,
        model: m.model,
      }));
      await db.insert(roleplayAllowedPersonaModels).values(rows);
      await db.insert(roleplayAllowedGraderModels).values(rows);
    }

    const configRows = await db.select().from(roleplayAppConfig).limit(1);
    if (configRows.length) {
      await db
        .update(roleplayAppConfig)
        .set({ updatedAt: new Date() })
        .where(eq(roleplayAppConfig.id, configRows[0].id));
    }

    return normalized;
  }

  async removeProviderKeys(providers: RoleplayProvider[]): Promise<void> {
    for (const provider of providers) {
      await db
        .delete(roleplayProviderKeys)
        .where(eq(roleplayProviderKeys.provider, provider));
    }
    const configRows = await db.select().from(roleplayAppConfig).limit(1);
    if (configRows.length) {
      await db
        .update(roleplayAppConfig)
        .set({ updatedAt: new Date() })
        .where(eq(roleplayAppConfig.id, configRows[0].id));
    }
  }

  async updateFullConfig(input: RoleplayConfigUpdateInput): Promise<RoleplayFullConfigPublic> {
    await this.ensureConfigRow();

    if (input.removeProviders?.length) {
      await this.removeProviderKeys(input.removeProviders);
    }

    if (input.keys) {
      await this.upsertProviderKeys(input.keys);
    }

    const models = input.models.map(normalizeModelRef);
    const removeSet = new Set(input.removeProviders ?? []);
    const filtered = models.filter((m) => !removeSet.has(m.provider));
    await this.setUnifiedAllowlist(filtered);

    return this.getFullConfig();
  }

  async setDefaults(input: {
    persona: RoleplayModelRef;
    grader: RoleplayModelRef;
  }): Promise<{ persona: RoleplayModelRef; grader: RoleplayModelRef }> {
    await this.ensureConfigRow();
    const persona = normalizeModelRef(input.persona);
    const grader = normalizeModelRef(input.grader);
    const allowedModels = await this.getUnifiedAllowlist();
    this.assertModelAllowed("persona", persona, allowedModels);
    this.assertModelAllowed("grader", grader, allowedModels);

    const configRows = await db.select().from(roleplayAppConfig).limit(1);
    if (configRows.length) {
      await db
        .update(roleplayAppConfig)
        .set({
          defaultPersonaProvider: persona.provider,
          defaultPersonaModel: persona.model,
          defaultGraderProvider: grader.provider,
          defaultGraderModel: grader.model,
          provider: persona.provider,
          model: persona.model,
          updatedAt: new Date(),
        })
        .where(eq(roleplayAppConfig.id, configRows[0].id));
    }

    return { persona, grader };
  }

  /** Validate per-roleplay model selection in settings payload. */
  async validateRoleplayModelSettings(settings: Record<string, unknown>): Promise<void> {
    const personaProvider = settings.personaProvider as string | undefined | null;
    const personaModel = settings.personaModel as string | undefined | null;
    const graderProvider = settings.graderProvider as string | undefined | null;
    const graderModel = settings.graderModel as string | undefined | null;

    if (!personaProvider || !personaModel) {
      throw new Error("personaProvider and personaModel are required for each roleplay");
    }
    if (!graderProvider || !graderModel) {
      throw new Error("graderProvider and graderModel are required for each roleplay");
    }

    await this.assertModelAllowedForPurpose("persona", {
      provider: personaProvider as RoleplayProvider,
      model: personaModel,
    });
    await this.assertModelAllowedForPurpose("grader", {
      provider: graderProvider as RoleplayProvider,
      model: graderModel,
    });
  }
}

/** Re-export for convenience in model-factory */
export class RoleplayNotConfiguredError extends Error {
  constructor(message = "Roleplay AI is not configured.") {
    super(message);
    this.name = "RoleplayNotConfiguredError";
  }
}

export const roleplayConfigService = new RoleplayConfigService();
