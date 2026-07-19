import type { ReactNode } from "react";

/** Keep in sync with scenarios-server/src/lib/roleplay-publish-rules.ts */
export const PUBLISH_VALIDATION_TITLE = "Complete required fields to publish";

export const PUBLISH_ALLOWLIST_ERROR =
  "Selected AI models must be on the admin allowlist (Settings → Roleplay AI)";

export type ScenarioPublishReadiness = {
  personaAiConfigured?: boolean;
  graderAiConfigured?: boolean;
  canPublish?: boolean;
};

export type ScenarioEditorPublishInput = {
  title: string;
  personaModelKey: string;
  graderModelKey: string;
};

type ModelRef = { provider: string; model: string };

function modelKey(provider: string, model: string): string {
  return `${provider}:${model}`;
}

function isModelKeyOnAllowlist(key: string, allowlist: ModelRef[]): boolean {
  const idx = key.indexOf(":");
  if (idx <= 0) return false;
  const provider = key.slice(0, idx);
  const model = key.slice(idx + 1);
  return allowlist.some(
    (entry) => modelKey(entry.provider, entry.model) === modelKey(provider, model),
  );
}

export function publishReadinessFromSettings(
  settings: Record<string, unknown> | null | undefined,
  allowlist: ModelRef[] = [],
): ScenarioPublishReadiness {
  const personaAiConfigured = Boolean(
    settings?.personaProvider && settings?.personaModel,
  );
  const graderAiConfigured = Boolean(
    settings?.graderProvider && settings?.graderModel,
  );
  const canPublish =
    personaAiConfigured &&
    graderAiConfigured &&
    isModelKeyOnAllowlist(
      `${settings?.personaProvider}:${settings?.personaModel}`,
      allowlist,
    ) &&
    isModelKeyOnAllowlist(
      `${settings?.graderProvider}:${settings?.graderModel}`,
      allowlist,
    );
  return {
    personaAiConfigured,
    graderAiConfigured,
    canPublish,
  };
}

export function getScenarioPublishValidationErrors(
  roleplay: ScenarioPublishReadiness,
): string[] {
  if (roleplay.canPublish === true) return [];
  if (roleplay.canPublish === false) {
    const errors: string[] = [];
    if (!roleplay.personaAiConfigured) {
      errors.push("Select a persona model on the Persona tab");
    }
    if (!roleplay.graderAiConfigured) {
      errors.push("Select an assessor model on the Rubric tab");
    }
    if (
      errors.length === 0 &&
      roleplay.personaAiConfigured &&
      roleplay.graderAiConfigured
    ) {
      errors.push(PUBLISH_ALLOWLIST_ERROR);
    }
    return errors.length
      ? errors
      : ["Configure persona and assessor models in the scenario editor"];
  }

  const errors: string[] = [];
  if (!roleplay.personaAiConfigured) {
    errors.push("Select a persona model on the Persona tab");
  }
  if (!roleplay.graderAiConfigured) {
    errors.push("Select an assessor model on the Rubric tab");
  }
  return errors;
}

export function getEditorPublishValidationErrors(
  input: ScenarioEditorPublishInput,
  allowlist: ModelRef[] = [],
): string[] {
  const errors: string[] = [];
  if (!input.title.trim()) {
    errors.push("Add a title on the Scenario tab");
  }
  if (!input.personaModelKey) {
    errors.push("Select a persona model on the Persona tab");
  } else if (allowlist.length > 0 && !isModelKeyOnAllowlist(input.personaModelKey, allowlist)) {
    errors.push(PUBLISH_ALLOWLIST_ERROR);
  }
  if (!input.graderModelKey) {
    errors.push("Select an assessor model on the Rubric tab");
  } else if (allowlist.length > 0 && !isModelKeyOnAllowlist(input.graderModelKey, allowlist)) {
    if (!errors.includes(PUBLISH_ALLOWLIST_ERROR)) {
      errors.push(PUBLISH_ALLOWLIST_ERROR);
    }
  }
  return errors;
}

export function canPublishScenario(
  roleplay: ScenarioPublishReadiness & { status?: string },
): boolean {
  if (roleplay.status === "published") return true;
  if (roleplay.canPublish === true) return true;
  if (roleplay.canPublish === false) return false;
  return getScenarioPublishValidationErrors(roleplay).length === 0;
}

export function publishValidationToastDescription(errors: string[]): ReactNode {
  if (errors.length === 1) return errors[0];
  return (
    <ul className="mt-1 list-disc space-y-1 pl-4">
      {errors.map((error) => (
        <li key={error}>{error}</li>
      ))}
    </ul>
  );
}

export function showPublishValidationErrorsToast(
  toast: (props: {
    title: string;
    description?: ReactNode;
    variant?: "destructive" | "default";
  }) => void,
  errors: string[],
): boolean {
  if (errors.length === 0) return true;
  toast({
    title: PUBLISH_VALIDATION_TITLE,
    description: publishValidationToastDescription(errors),
    variant: "destructive",
  });
  return false;
}

export function showPublishValidationToast(
  toast: (props: {
    title: string;
    description?: ReactNode;
    variant?: "destructive" | "default";
  }) => void,
  roleplay: ScenarioPublishReadiness,
): boolean {
  return showPublishValidationErrorsToast(
    toast,
    getScenarioPublishValidationErrors(roleplay),
  );
}
