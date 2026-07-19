/** Demo persona/grader model used by seed data and the roleplay AI allowlist. */
export const DEMO_ROLEPLAY_AI_PROVIDER = "openai" as const;
export const DEMO_ROLEPLAY_AI_MODEL = "gpt-4o-mini";

export const DEMO_ROLEPLAY_AI = {
  provider: DEMO_ROLEPLAY_AI_PROVIDER,
  model: DEMO_ROLEPLAY_AI_MODEL,
} as const;

export const DEMO_ROLEPLAY_AI_SETTINGS = {
  personaProvider: DEMO_ROLEPLAY_AI_PROVIDER,
  personaModel: DEMO_ROLEPLAY_AI_MODEL,
  graderProvider: DEMO_ROLEPLAY_AI_PROVIDER,
  graderModel: DEMO_ROLEPLAY_AI_MODEL,
} as const;
