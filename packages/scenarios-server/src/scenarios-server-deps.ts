import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type {
  GradingContext,
  GradingCriterionInput,
  GradingResult,
  CriterionScoreInput,
} from "./roleplay/grading.ts";
import type { LiveHintOptions } from "./roleplay/coaching.ts";

export interface ScenariosServerDeps {
  grader?: {
    gradeTranscript(model: BaseChatModel, ctx: GradingContext): Promise<GradingResult>;
  };
  coach?: {
    generateLiveHint(model: BaseChatModel, opts: LiveHintOptions): Promise<string>;
  };
  scorer?: {
    computeWeightedPercent(
      criteria: GradingCriterionInput[],
      scores: CriterionScoreInput[],
    ): number;
  };
}
