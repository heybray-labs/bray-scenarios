export type AgentProvider = "openai" | "anthropic" | "google";

export type ModelRef = { provider: AgentProvider; model: string };

export type RoleplayFullConfig = {
  keys: { provider: AgentProvider; hasKey: boolean }[];
  allowedModels: ModelRef[];
  isReady: boolean;
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

export function modelsEqual(a: ModelRef[], b: ModelRef[]): boolean {
  const toSorted = (list: ModelRef[]) => list.map(modelKey).sort().join(",");
  return toSorted(a) === toSorted(b);
}

export function hasKeyFor(
  keys: RoleplayFullConfig["keys"],
  provider: AgentProvider,
): boolean {
  return keys.find((k) => k.provider === provider)?.hasKey ?? false;
}
