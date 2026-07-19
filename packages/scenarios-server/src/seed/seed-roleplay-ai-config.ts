import { and, eq } from "drizzle-orm";
import { db } from "@heybray/server-kit";
import {
  roleplayAppConfig,
  roleplayAllowedGraderModels,
  roleplayAllowedPersonaModels,
} from "../schema/agent/roleplay-app-config.ts";
import { DEMO_ROLEPLAY_AI } from "./demo-data/ai-config.ts";

async function ensureAllowlistEntry(
  table: typeof roleplayAllowedPersonaModels | typeof roleplayAllowedGraderModels,
  provider: string,
  model: string,
) {
  const [existing] = await db
    .select({ id: table.id })
    .from(table)
    .where(and(eq(table.provider, provider), eq(table.model, model)))
    .limit(1);
  if (existing) return;
  await db.insert(table).values({ provider, model });
}

/**
 * Ensures demo scenarios' AI models appear in Settings allowlists and as builder defaults.
 * Idempotent — safe to call on every demo seed without wiping admin-configured models.
 */
export async function seedDemoRoleplayAiConfig() {
  const { provider, model } = DEMO_ROLEPLAY_AI;

  await ensureAllowlistEntry(roleplayAllowedPersonaModels, provider, model);
  await ensureAllowlistEntry(roleplayAllowedGraderModels, provider, model);

  const configRows = await db.select().from(roleplayAppConfig).limit(1);
  if (!configRows.length) {
    await db.insert(roleplayAppConfig).values({
      defaultPersonaProvider: provider,
      defaultPersonaModel: model,
      defaultGraderProvider: provider,
      defaultGraderModel: model,
    });
    return;
  }

  await db
    .update(roleplayAppConfig)
    .set({
      defaultPersonaProvider: provider,
      defaultPersonaModel: model,
      defaultGraderProvider: provider,
      defaultGraderModel: model,
      updatedAt: new Date(),
    })
    .where(eq(roleplayAppConfig.id, configRows[0]!.id));
}
