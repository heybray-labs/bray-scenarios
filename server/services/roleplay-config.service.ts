import { db } from "../db.ts";
import {
  roleplayTenantConfig,
  roleplayTenantProviderKeys,
  roleplayTenantPersonaModels,
  roleplayTenantGraderModels,
} from "../../shared/schemas/agent/roleplay-tenant-config.ts";
import { roleplaySettings } from "../../shared/schemas/roleplay-core.ts";
import { encryptSecret, decryptSecret } from "../utils/secret-encryption.ts";
import { platformLogger } from "../utils/logger.ts";
import { and, eq } from "drizzle-orm";

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
  personaAllowlist: RoleplayModelRef[];
  graderAllowlist: RoleplayModelRef[];
  isReady: boolean;
  updatedAt?: Date;
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
 * Per-tenant roleplay LLM configuration. Managed by global admins only.
 */
export class RoleplayConfigService {
  private async ensureTenantRow(tenantId: number) {
    const existing = await db
      .select()
      .from(roleplayTenantConfig)
      .where(eq(roleplayTenantConfig.tenantId, tenantId))
      .limit(1);
    if (existing.length) return existing[0];
    const [created] = await db
      .insert(roleplayTenantConfig)
      .values({ tenantId })
      .returning();
    return created;
  }

  async getProviderKeys(tenantId: number): Promise<RoleplayProviderKeyStatus[]> {
    const rows = await db
      .select()
      .from(roleplayTenantProviderKeys)
      .where(eq(roleplayTenantProviderKeys.tenantId, tenantId));
    const byProvider = new Map(rows.map((r) => [r.provider, r]));
    return PROVIDERS.map((provider) => ({
      provider,
      hasKey: !!byProvider.get(provider)?.encryptedApiKey,
    }));
  }

  async getDecryptedApiKeyForProvider(
    tenantId: number,
    provider: RoleplayProvider,
  ): Promise<string | null> {
    const rows = await db
      .select()
      .from(roleplayTenantProviderKeys)
      .where(
        and(
          eq(roleplayTenantProviderKeys.tenantId, tenantId),
          eq(roleplayTenantProviderKeys.provider, provider),
        ),
      )
      .limit(1);
    if (!rows.length || !rows[0].encryptedApiKey) {
      // Legacy fallback: single key on tenant config row
      const legacy = await db
        .select()
        .from(roleplayTenantConfig)
        .where(eq(roleplayTenantConfig.tenantId, tenantId))
        .limit(1);
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
        { tenantId, provider },
      );
      return null;
    }
  }

  /** @deprecated use getDecryptedApiKeyForProvider with explicit provider */
  async getDecryptedApiKey(tenantId: number): Promise<string | null> {
    for (const provider of PROVIDERS) {
      const key = await this.getDecryptedApiKeyForProvider(tenantId, provider);
      if (key) return key;
    }
    return null;
  }

  async getAllowlist(
    tenantId: number,
    purpose: RoleplayModelPurpose,
  ): Promise<RoleplayModelRef[]> {
    if (purpose === "persona") {
      const rows = await db
        .select()
        .from(roleplayTenantPersonaModels)
        .where(eq(roleplayTenantPersonaModels.tenantId, tenantId));
      return rows.map((r) => ({
        provider: r.provider as RoleplayProvider,
        model: r.model,
      }));
    }
    const rows = await db
      .select()
      .from(roleplayTenantGraderModels)
      .where(eq(roleplayTenantGraderModels.tenantId, tenantId));
    return rows.map((r) => ({
      provider: r.provider as RoleplayProvider,
      model: r.model,
    }));
  }

  async getDefaults(tenantId: number): Promise<{
    persona: RoleplayModelRef | null;
    grader: RoleplayModelRef | null;
  }> {
    const rows = await db
      .select()
      .from(roleplayTenantConfig)
      .where(eq(roleplayTenantConfig.tenantId, tenantId))
      .limit(1);
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

  async getFullConfig(tenantId: number): Promise<RoleplayFullConfigPublic> {
    await this.ensureTenantRow(tenantId);
    const [keys, personaAllowlist, graderAllowlist, row] = await Promise.all([
      this.getProviderKeys(tenantId),
      this.getAllowlist(tenantId, "persona"),
      this.getAllowlist(tenantId, "grader"),
      db
        .select()
        .from(roleplayTenantConfig)
        .where(eq(roleplayTenantConfig.tenantId, tenantId))
        .limit(1),
    ]);
    const isReady = await this.isTenantReady(tenantId);
    return {
      keys,
      personaAllowlist,
      graderAllowlist,
      isReady,
      updatedAt: row[0]?.updatedAt,
    };
  }

  async isTenantReady(tenantId: number): Promise<boolean> {
    const personaList = await this.getAllowlist(tenantId, "persona");
    const graderList = await this.getAllowlist(tenantId, "grader");
    if (!personaList.length || !graderList.length) return false;

    const providersNeeded = new Set<RoleplayProvider>();
    for (const m of [...personaList, ...graderList]) {
      providersNeeded.add(m.provider);
    }
    for (const provider of providersNeeded) {
      const key = await this.getDecryptedApiKeyForProvider(tenantId, provider);
      if (!key) return false;
    }
    return true;
  }

  /** @deprecated use isTenantReady */
  async isConfigured(tenantId: number): Promise<boolean> {
    return this.isTenantReady(tenantId);
  }

  assertModelAllowed(
    _tenantId: number,
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

  async assertModelAllowedForTenant(
    tenantId: number,
    purpose: RoleplayModelPurpose,
    ref: RoleplayModelRef,
  ): Promise<void> {
    const allowlist = await this.getAllowlist(tenantId, purpose);
    this.assertModelAllowed(tenantId, purpose, ref, allowlist);
    const key = await this.getDecryptedApiKeyForProvider(tenantId, ref.provider);
    if (!key) {
      throw new Error(`No API key configured for provider ${ref.provider}`);
    }
  }

  async resolveModelsForRoleplay(
    roleplayId: number,
    tenantId: number,
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

    await this.assertModelAllowedForTenant(tenantId, "persona", persona);
    await this.assertModelAllowedForTenant(tenantId, "grader", grader);

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
    tenantId: number,
    keys: Partial<Record<RoleplayProvider, string>>,
  ): Promise<RoleplayProviderKeyStatus[]> {
    await this.ensureTenantRow(tenantId);
    for (const provider of PROVIDERS) {
      const raw = keys[provider];
      if (!raw?.trim()) continue;
      const encrypted = encryptSecret(raw.trim());
      const existing = await db
        .select()
        .from(roleplayTenantProviderKeys)
        .where(
          and(
            eq(roleplayTenantProviderKeys.tenantId, tenantId),
            eq(roleplayTenantProviderKeys.provider, provider),
          ),
        )
        .limit(1);
      if (existing.length) {
        await db
          .update(roleplayTenantProviderKeys)
          .set({ encryptedApiKey: encrypted, updatedAt: new Date() })
          .where(eq(roleplayTenantProviderKeys.id, existing[0].id));
      } else {
        await db.insert(roleplayTenantProviderKeys).values({
          tenantId,
          provider,
          encryptedApiKey: encrypted,
        });
      }
    }
    await db
      .update(roleplayTenantConfig)
      .set({ updatedAt: new Date() })
      .where(eq(roleplayTenantConfig.tenantId, tenantId));
    return this.getProviderKeys(tenantId);
  }

  async setAllowlists(
    tenantId: number,
    input: { persona: RoleplayModelRef[]; grader: RoleplayModelRef[] },
  ): Promise<{ persona: RoleplayModelRef[]; grader: RoleplayModelRef[] }> {
    await this.ensureTenantRow(tenantId);
    const persona = input.persona.map(normalizeModelRef);
    const grader = input.grader.map(normalizeModelRef);

    await db
      .delete(roleplayTenantPersonaModels)
      .where(eq(roleplayTenantPersonaModels.tenantId, tenantId));
    await db
      .delete(roleplayTenantGraderModels)
      .where(eq(roleplayTenantGraderModels.tenantId, tenantId));

    if (persona.length) {
      await db.insert(roleplayTenantPersonaModels).values(
        persona.map((m) => ({
          tenantId,
          provider: m.provider,
          model: m.model,
        })),
      );
    }
    if (grader.length) {
      await db.insert(roleplayTenantGraderModels).values(
        grader.map((m) => ({
          tenantId,
          provider: m.provider,
          model: m.model,
        })),
      );
    }

    await db
      .update(roleplayTenantConfig)
      .set({ updatedAt: new Date() })
      .where(eq(roleplayTenantConfig.tenantId, tenantId));

    return { persona, grader };
  }

  async setDefaults(
    tenantId: number,
    input: { persona: RoleplayModelRef; grader: RoleplayModelRef },
  ): Promise<{ persona: RoleplayModelRef; grader: RoleplayModelRef }> {
    await this.ensureTenantRow(tenantId);
    const persona = normalizeModelRef(input.persona);
    const grader = normalizeModelRef(input.grader);
    const personaList = await this.getAllowlist(tenantId, "persona");
    const graderList = await this.getAllowlist(tenantId, "grader");
    this.assertModelAllowed(tenantId, "persona", persona, personaList);
    this.assertModelAllowed(tenantId, "grader", grader, graderList);

    await db
      .update(roleplayTenantConfig)
      .set({
        defaultPersonaProvider: persona.provider,
        defaultPersonaModel: persona.model,
        defaultGraderProvider: grader.provider,
        defaultGraderModel: grader.model,
        // Keep legacy columns in sync for backward compat
        provider: persona.provider,
        model: persona.model,
        updatedAt: new Date(),
      })
      .where(eq(roleplayTenantConfig.tenantId, tenantId));

    return { persona, grader };
  }

  /** Validate per-roleplay model selection in settings payload. */
  async validateRoleplayModelSettings(
    tenantId: number,
    settings: Record<string, unknown>,
  ): Promise<void> {
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

    await this.assertModelAllowedForTenant(tenantId, "persona", {
      provider: personaProvider as RoleplayProvider,
      model: personaModel,
    });
    await this.assertModelAllowedForTenant(tenantId, "grader", {
      provider: graderProvider as RoleplayProvider,
      model: graderModel,
    });
  }
}

/** Re-export for convenience in model-factory */
export class RoleplayNotConfiguredError extends Error {
  constructor(message = "Roleplay AI is not configured for this tenant.") {
    super(message);
    this.name = "RoleplayNotConfiguredError";
  }
}

export const roleplayConfigService = new RoleplayConfigService();
