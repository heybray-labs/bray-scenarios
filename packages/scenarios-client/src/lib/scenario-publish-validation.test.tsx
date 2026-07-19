import { describe, expect, it } from "vitest";
import {
  canPublishScenario,
  getEditorPublishValidationErrors,
  getScenarioPublishValidationErrors,
  PUBLISH_ALLOWLIST_ERROR,
  publishReadinessFromSettings,
} from "./scenario-publish-validation";

describe("scenario publish validation", () => {
  it("treats missing AI flags as not publish-ready", () => {
    expect(getScenarioPublishValidationErrors({})).toHaveLength(2);
    expect(canPublishScenario({ status: "draft" })).toBe(false);
  });

  it("allows publish when server marks canPublish", () => {
    expect(canPublishScenario({ status: "draft", canPublish: true })).toBe(true);
    expect(getScenarioPublishValidationErrors({ canPublish: true })).toEqual([]);
  });

  it("blocks publish when server marks canPublish false", () => {
    expect(canPublishScenario({ status: "draft", canPublish: false })).toBe(false);
  });

  it("explains allowlist mismatch when models are set but canPublish is false", () => {
    expect(
      getScenarioPublishValidationErrors({
        canPublish: false,
        personaAiConfigured: true,
        graderAiConfigured: true,
      }),
    ).toEqual([PUBLISH_ALLOWLIST_ERROR]);
  });

  it("derives readiness from roleplay settings and allowlist", () => {
    const allowlist = [{ provider: "openai", model: "gpt-4" }];
    expect(
      publishReadinessFromSettings(
        {
          personaProvider: "openai",
          personaModel: "gpt-4",
          graderProvider: "openai",
          graderModel: "gpt-4",
        },
        allowlist,
      ).canPublish,
    ).toBe(true);
    expect(
      publishReadinessFromSettings(
        {
          personaProvider: "openai",
          personaModel: "gpt-4o-mini",
          graderProvider: "openai",
          graderModel: "gpt-4o-mini",
        },
        allowlist,
      ).canPublish,
    ).toBe(false);
    expect(publishReadinessFromSettings({ maxAttempts: 3 }).canPublish).toBe(false);
  });

  it("validates editor form fields before save & publish", () => {
    expect(
      getEditorPublishValidationErrors({
        title: "",
        personaModelKey: "",
        graderModelKey: "openai:gpt-4",
      }),
    ).toEqual([
      "Add a title on the Scenario tab",
      "Select a persona model on the Persona tab",
    ]);
  });
});
