export type AgentProvider = "openai" | "anthropic" | "google";

/** Minimal stub — roleplay uses app-scoped keys from roleplay-config.service. */
export const agentConfigService = {
  async getApiKey(_provider: AgentProvider): Promise<string | null> {
    return null;
  },
};
