import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { ScenariosServerDeps } from "../scenarios-server-deps.ts";
import {
  gradeTranscript as defaultGradeTranscript,
  computeWeightedPercent as defaultComputeWeightedPercent,
  type GradingContext,
  type GradingCriterionInput,
  type GradingResult,
  type CriterionScoreInput,
} from "./grading.ts";
import {
  generateLiveHint as defaultGenerateLiveHint,
  type LiveHintOptions,
} from "./coaching.ts";

export type { LiveHintOptions, CriterionScoreInput };

type GraderStrategy = {
  gradeTranscript(model: BaseChatModel, ctx: GradingContext): Promise<GradingResult>;
};

type CoachStrategy = {
  generateLiveHint(model: BaseChatModel, opts: LiveHintOptions): Promise<string>;
};

type ScorerStrategy = {
  computeWeightedPercent(
    criteria: GradingCriterionInput[],
    scores: CriterionScoreInput[],
  ): number;
};

let active: {
  grader: GraderStrategy;
  coach: CoachStrategy;
  scorer: ScorerStrategy;
};

export function configureRoleplayStrategies(deps: ScenariosServerDeps = {}): void {
  active = {
    grader: {
      gradeTranscript: deps.grader?.gradeTranscript ?? defaultGradeTranscript,
    },
    coach: {
      generateLiveHint: deps.coach?.generateLiveHint ?? defaultGenerateLiveHint,
    },
    scorer: {
      computeWeightedPercent:
        deps.scorer?.computeWeightedPercent ?? defaultComputeWeightedPercent,
    },
  };
}

configureRoleplayStrategies({});

export function gradeTranscript(
  model: BaseChatModel,
  ctx: GradingContext,
): Promise<GradingResult> {
  return active.grader.gradeTranscript(model, ctx);
}

export function generateLiveHint(
  model: BaseChatModel,
  opts: LiveHintOptions,
): Promise<string> {
  return active.coach.generateLiveHint(model, opts);
}

export function computeWeightedPercent(
  criteria: GradingCriterionInput[],
  scores: CriterionScoreInput[],
): number {
  return active.scorer.computeWeightedPercent(criteria, scores);
}
