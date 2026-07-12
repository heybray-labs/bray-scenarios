import {
  createModelFactory,
  describeModelError,
  openAiSupportsCustomTemperature,
  LlmNotConfiguredError,
} from "@heybray/llm";
import { roleplayConfigService } from "../services/roleplay-config.service.ts";

const factory = createModelFactory({
  getApiKey: (provider) => roleplayConfigService.getDecryptedApiKeyForProvider(provider),
});

export const createRoleplayChatModel = factory.createChatModel;

export const describeRoleplayModelError = describeModelError;

export { openAiSupportsCustomTemperature };

// App-facing alias so existing `instanceof`/import sites keep working.
export { LlmNotConfiguredError as RoleplayNotConfiguredError };
