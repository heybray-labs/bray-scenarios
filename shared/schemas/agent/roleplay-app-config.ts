import { pgTable, text, serial, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export type RoleplayProviderName = "openai" | "anthropic" | "google";

/**
 * Singleton anchor for roleplay LLM configuration.
 * Defaults and allowlists live in related tables; API keys are per provider.
 */
export const roleplayAppConfig = pgTable("roleplay_app_config", {
  id: serial("id").primaryKey(),
  /** @deprecated legacy single-provider default — use defaultPersona* / defaultGrader* */
  provider: text("provider").notNull().default("openai"),
  /** @deprecated legacy single model — use defaultPersona* / defaultGrader* */
  model: text("model").notNull().default("gpt-4o-mini"),
  /** @deprecated legacy single key — use roleplay_provider_keys */
  encryptedApiKey: text("encrypted_api_key"),
  defaultPersonaProvider: text("default_persona_provider"),
  defaultPersonaModel: text("default_persona_model"),
  defaultGraderProvider: text("default_grader_provider"),
  defaultGraderModel: text("default_grader_model"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** One encrypted API key per vendor. */
export const roleplayProviderKeys = pgTable(
  "roleplay_provider_keys",
  {
    id: serial("id").primaryKey(),
    provider: text("provider").notNull().unique(), // openai | anthropic | google
    encryptedApiKey: text("encrypted_api_key"),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
);

/** Models allowed for persona conversation. */
export const roleplayAllowedPersonaModels = pgTable(
  "roleplay_allowed_persona_models",
  {
    id: serial("id").primaryKey(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    providerModelUnique: uniqueIndex("roleplay_allowed_persona_models_provider_model_idx").on(
      table.provider,
      table.model,
    ),
  }),
);

/** Models allowed for rubric grading. */
export const roleplayAllowedGraderModels = pgTable(
  "roleplay_allowed_grader_models",
  {
    id: serial("id").primaryKey(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    providerModelUnique: uniqueIndex("roleplay_allowed_grader_models_provider_model_idx").on(
      table.provider,
      table.model,
    ),
  }),
);

export type RoleplayAppConfig = typeof roleplayAppConfig.$inferSelect;
export type RoleplayProviderKey = typeof roleplayProviderKeys.$inferSelect;
export type RoleplayAllowedPersonaModel = typeof roleplayAllowedPersonaModels.$inferSelect;
export type RoleplayAllowedGraderModel = typeof roleplayAllowedGraderModels.$inferSelect;
