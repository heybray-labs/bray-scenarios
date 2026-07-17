import {
  createModelFactory,
  LlmNotConfiguredError,
} from "@heybray/llm";

import { roleplayConfigService } from "../services/roleplay-config.service.ts";

const factory = createModelFactory(
  {
    getApiKey: (provider) => roleplayConfigService.getDecryptedApiKeyForProvider(provider),
  },
  {
    describeTemperatureFallback: (providerLabel, model) =>
      `${providerLabel} model${model ? ` "${model}"` : ""} only supports the default temperature. Roleplay will omit custom temperature for this model automatically — retry the attempt. If this persists, choose a chat model such as gpt-4o-mini for more control.`,
  },
);

export const createRoleplayChatModel = factory.createChatModel;

export const describeRoleplayModelError = factory.describeModelError;

// App-facing alias so existing `instanceof`/import sites keep working.
export { LlmNotConfiguredError as RoleplayNotConfiguredError };
