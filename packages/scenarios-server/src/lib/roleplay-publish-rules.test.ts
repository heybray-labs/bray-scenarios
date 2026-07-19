import { describe, expect, it } from "vitest";
import {
  roleplayBrowsePublishFields,
  roleplaySettingsAllowlistedForPublish,
  roleplaySettingsHaveAllModels,
} from "./roleplay-publish-rules.ts";

const OPENAI_GPT4 = { provider: "openai", model: "gpt-4" };
const OPENAI_MINI = { provider: "openai", model: "gpt-4o-mini" };

describe("roleplay publish rules", () => {
  it("requires both persona and grader models", () => {
    expect(
      roleplaySettingsHaveAllModels({
        personaProvider: "openai",
        personaModel: "gpt-4",
      }),
    ).toBe(false);
    expect(
      roleplaySettingsHaveAllModels({
        personaProvider: "openai",
        personaModel: "gpt-4",
        graderProvider: "openai",
        graderModel: "gpt-4",
      }),
    ).toBe(true);
  });

  it("requires models on the allowlist for canPublish", () => {
    const settings = {
      personaProvider: "openai",
      personaModel: "gpt-4o-mini",
      graderProvider: "openai",
      graderModel: "gpt-4o-mini",
    };

    expect(roleplayBrowsePublishFields(settings, [])).toEqual({
      personaAiConfigured: true,
      graderAiConfigured: true,
      canPublish: false,
    });

    expect(roleplayBrowsePublishFields(settings, [OPENAI_MINI])).toEqual({
      personaAiConfigured: true,
      graderAiConfigured: true,
      canPublish: true,
    });

    expect(
      roleplaySettingsAllowlistedForPublish(settings, [OPENAI_GPT4]),
    ).toBe(false);
  });

  it("derives browse publish fields for missing settings", () => {
    expect(roleplayBrowsePublishFields(null)).toEqual({
      personaAiConfigured: false,
      graderAiConfigured: false,
      canPublish: false,
    });
  });
});
