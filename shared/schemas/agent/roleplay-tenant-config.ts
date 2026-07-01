import { pgTable, text, serial, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { tenants } from "../tenants.ts";

export type RoleplayProviderName = "openai" | "anthropic" | "google";

/**
 * Per-tenant anchor for roleplay LLM configuration.
 * Defaults and allowlists live in related tables; API keys are per provider.
 */
export const roleplayTenantConfig = pgTable("roleplay_tenant_config", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" })
    .unique(),
  /** @deprecated legacy single-provider default — use defaultPersona* / defaultGrader* */
  provider: text("provider").notNull().default("openai"),
  /** @deprecated legacy single model — use defaultPersona* / defaultGrader* */
  model: text("model").notNull().default("gpt-4o-mini"),
  /** @deprecated legacy single key — use roleplay_tenant_provider_keys */
  encryptedApiKey: text("encrypted_api_key"),
  defaultPersonaProvider: text("default_persona_provider"),
  defaultPersonaModel: text("default_persona_model"),
  defaultGraderProvider: text("default_grader_provider"),
  defaultGraderModel: text("default_grader_model"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** One encrypted API key per vendor per tenant. */
export const roleplayTenantProviderKeys = pgTable(
  "roleplay_tenant_provider_keys",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(), // openai | anthropic | google
    encryptedApiKey: text("encrypted_api_key"),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    tenantProviderUnique: uniqueIndex("roleplay_tenant_provider_keys_tenant_provider_idx").on(
      table.tenantId,
      table.provider,
    ),
  }),
);

/** Models allowed for persona conversation. */
export const roleplayTenantPersonaModels = pgTable(
  "roleplay_tenant_persona_models",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    tenantModelUnique: uniqueIndex("roleplay_tenant_persona_models_tenant_model_idx").on(
      table.tenantId,
      table.provider,
      table.model,
    ),
  }),
);

/** Models allowed for rubric grading. */
export const roleplayTenantGraderModels = pgTable(
  "roleplay_tenant_grader_models",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    tenantModelUnique: uniqueIndex("roleplay_tenant_grader_models_tenant_model_idx").on(
      table.tenantId,
      table.provider,
      table.model,
    ),
  }),
);

export type RoleplayTenantConfig = typeof roleplayTenantConfig.$inferSelect;
export type RoleplayTenantProviderKey = typeof roleplayTenantProviderKeys.$inferSelect;
export type RoleplayTenantPersonaModel = typeof roleplayTenantPersonaModels.$inferSelect;
export type RoleplayTenantGraderModel = typeof roleplayTenantGraderModels.$inferSelect;
