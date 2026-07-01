export type AgentProvider = "openai" | "anthropic" | "google";

export type ModelRef = { provider: AgentProvider; model: string };

export type RoleplayFullConfig = {
  keys: { provider: AgentProvider; hasKey: boolean }[];
  personaAllowlist: ModelRef[];
  graderAllowlist: ModelRef[];
  isReady: boolean;
};

export type SetupChecklistItem = {
  id: "keys" | "persona_allowlist" | "grader_allowlist";
  label: string;
  complete: boolean;
  detail?: string;
};

export type AgentModelOption = {
  id: string;
  displayName: string;
};

export const PROVIDERS: AgentProvider[] = ["openai", "anthropic", "google"];

export const PROVIDER_LABELS: Record<AgentProvider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google Gemini",
};

export function modelKey(ref: ModelRef): string {
  return `${ref.provider}:${ref.model}`;
}

export function formatModelLabel(ref: ModelRef): string {
  return `${PROVIDER_LABELS[ref.provider]} · ${ref.model}`;
}

function hasKeyFor(keys: RoleplayFullConfig["keys"], provider: AgentProvider): boolean {
  return keys.find((k) => k.provider === provider)?.hasKey ?? false;
}

function providersInUse(config: RoleplayFullConfig): Set<AgentProvider> {
  const providers = new Set<AgentProvider>();
  for (const m of [...config.personaAllowlist, ...config.graderAllowlist]) {
    providers.add(m.provider);
  }
  return providers;
}

/** Mirror server isTenantReady checks for checklist UI. */
export function getSetupChecklist(config: RoleplayFullConfig): SetupChecklistItem[] {
  const { keys, personaAllowlist, graderAllowlist } = config;
  const personaHasModels = personaAllowlist.length > 0;
  const graderHasModels = graderAllowlist.length > 0;
  const usedProviders = providersInUse(config);

  const keysComplete =
    usedProviders.size === 0
      ? keys.some((k) => k.hasKey)
      : [...usedProviders].every((p) => hasKeyFor(keys, p));

  return [
    {
      id: "keys",
      label: "API keys for allowlisted providers",
      complete: keysComplete,
      detail: !keysComplete
        ? usedProviders.size > 0
          ? "Save API keys for every provider in your allowlists"
          : "Add at least one provider API key"
        : undefined,
    },
    {
      id: "persona_allowlist",
      label: "Persona allowlist",
      complete: personaHasModels,
      detail: personaHasModels ? undefined : "Add at least one persona model",
    },
    {
      id: "grader_allowlist",
      label: "Grader allowlist",
      complete: graderHasModels,
      detail: graderHasModels ? undefined : "Add at least one grader model",
    },
  ];
}

export function allowlistsEqual(a: ModelRef[], b: ModelRef[]): boolean {
  const toSorted = (list: ModelRef[]) => list.map(modelKey).sort().join(",");
  return toSorted(a) === toSorted(b);
}
