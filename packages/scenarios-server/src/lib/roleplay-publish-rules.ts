/*
 * Single source of truth for scenario publish eligibility on the server.
 * Client UX mirrors these rules in scenarios-client/src/lib/scenario-publish-validation.tsx.
 */

export const ROLEPLAY_PUBLISH_AI_REQUIRED_ERROR =
  "Persona and grader AI must be configured before publishing";

export const ROLEPLAY_PUBLISH_ALLOWLIST_ERROR =
  "Selected persona and assessor models must be on the admin allowlist (Settings → Roleplay AI)";

export type RoleplaySettingsModelFields = {
  personaProvider?: string | null;
  personaModel?: string | null;
  graderProvider?: string | null;
  graderModel?: string | null;
};

export type RoleplayModelAllowlistEntry = {
  provider: string;
  model: string;
};

function modelKey(provider: string, model: string): string {
  return `${provider}:${model}`;
}

function isModelOnAllowlist(
  provider: string | null | undefined,
  model: string | null | undefined,
  allowlist: RoleplayModelAllowlistEntry[],
): boolean {
  if (!provider || !model || !allowlist.length) return false;
  const key = modelKey(provider, model);
  return allowlist.some((entry) => modelKey(entry.provider, entry.model) === key);
}

export function roleplayAiModelFlags(
  settings: RoleplaySettingsModelFields | null | undefined,
) {
  return {
    personaAiConfigured: Boolean(settings?.personaProvider && settings?.personaModel),
    graderAiConfigured: Boolean(settings?.graderProvider && settings?.graderModel),
  };
}

/** True when settings name both models (ignores allowlist). */
export function roleplaySettingsHaveAllModels(
  settings: Record<string, unknown> | RoleplaySettingsModelFields | null | undefined,
): boolean {
  const flags = roleplayAiModelFlags(
    settings as RoleplaySettingsModelFields | null | undefined,
  );
  return flags.personaAiConfigured && flags.graderAiConfigured;
}

/** True when both models are set and each appears on the unified allowlist. */
export function roleplaySettingsAllowlistedForPublish(
  settings: RoleplaySettingsModelFields | null | undefined,
  allowlist: RoleplayModelAllowlistEntry[] = [],
): boolean {
  if (!roleplaySettingsHaveAllModels(settings)) return false;
  return (
    isModelOnAllowlist(
      settings!.personaProvider,
      settings!.personaModel,
      allowlist,
    ) &&
    isModelOnAllowlist(settings!.graderProvider, settings!.graderModel, allowlist)
  );
}

export function roleplayBrowsePublishFields(
  settings: RoleplaySettingsModelFields | null | undefined,
  allowlist: RoleplayModelAllowlistEntry[] = [],
) {
  const aiFlags = roleplayAiModelFlags(settings);
  return {
    ...aiFlags,
    canPublish: roleplaySettingsAllowlistedForPublish(settings, allowlist),
  };
}
