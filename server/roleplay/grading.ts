import {
  HumanMessage,
  SystemMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { OutputParserException } from "@langchain/core/output_parsers";
import { z } from "zod";
import type { TranscriptTurn } from "./persona-prompt.ts";

export interface GradingCriterionInput {
  id: number;
  name: string;
  description?: string | null;
  weight: number;
  maxScore: number;
}

export interface GradingContext {
  roleplayTitle: string;
  learnerRole?: string | null;
  learnerObjective?: string | null;
  situationContext?: string | null;
  playbook?: string | null;
  personaName?: string | null;
  criteria: GradingCriterionInput[];
  transcript: TranscriptTurn[];
}

const CriterionScoreSchema = z.object({
  criterionId: z.number(),
  score: z.number(),
  feedback: z.string().default(""),
  strengths: z.string().default(""),
  improvements: z.string().default(""),
});

export const GradingResultSchema = z.object({
  overallFeedback: z.string().min(1),
  criteria: z.array(CriterionScoreSchema).min(1),
});

export type GradingResult = z.infer<typeof GradingResultSchema>;

function buildGradingSystemPrompt(ctx: GradingContext): string {
  const lines: string[] = [];
  lines.push(
    "You are an expert conversation-skills assessor. You evaluate a transcript of a role-play training conversation between a learner and an AI persona, and you score the learner against a rubric.",
  );
  lines.push("");
  lines.push(`Scenario: ${ctx.roleplayTitle}`);
  if (ctx.learnerRole) lines.push(`Learner's role: ${ctx.learnerRole}`);
  if (ctx.learnerObjective)
    lines.push(`Learner's objective: ${ctx.learnerObjective}`);
  if (ctx.situationContext) lines.push(`Situation: ${ctx.situationContext}`);
  if (ctx.personaName) lines.push(`The persona played: ${ctx.personaName}`);

  if (ctx.playbook) {
    lines.push("");
    lines.push(
      "# Playbook (authoritative process & best practices the learner SHOULD have followed)",
    );
    lines.push(ctx.playbook);
    lines.push(
      "Weigh adherence to this playbook heavily when scoring relevant criteria.",
    );
  }

  lines.push("");
  lines.push("# Rubric criteria");
  for (const c of ctx.criteria) {
    lines.push(
      `- [id ${c.id}] ${c.name} (score 0..${c.maxScore})${c.description ? `: ${c.description}` : ""}`,
    );
  }

  lines.push("");
  lines.push("# Instructions");
  lines.push(
    "- Score each criterion with an integer between 0 and its max score, based strictly on the learner's messages.",
  );
  lines.push(
    "- For each criterion give concise, specific feedback citing what the learner did, plus strengths and concrete improvements.",
  );
  lines.push(
    "- Be fair but rigorous. Reward behaviours aligned with the objective and playbook; penalise missed steps, poor tone, or unmet objectives.",
  );
  lines.push(
    "- Provide an overall feedback summary (2-4 sentences) describing performance and the single highest-impact improvement.",
  );
  lines.push(
    "- Return one entry per criterion, using the exact criterion id provided.",
  );

  return lines.join("\n");
}

function buildTranscriptText(ctx: GradingContext): string {
  const personaLabel = ctx.personaName?.trim() || "Persona";
  const learnerLabel = ctx.learnerRole?.trim() || "Learner";
  const turns = ctx.transcript.map((t) =>
    t.role === "persona"
      ? `${personaLabel}: ${t.content}`
      : `${learnerLabel}: ${t.content}`,
  );
  return `# Transcript\n${turns.join("\n")}`;
}

const JSON_FALLBACK_SUFFIX = `

OUTPUT FORMAT (critical):
Return ONLY a single JSON object with keys "overallFeedback" (string) and "criteria" (a JSON array).
Each criteria entry must include: criterionId (number), score (number), feedback (string), strengths (string), improvements (string).
Do not wrap in markdown code fences. No other text.`;

function messageText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((block) => {
        if (typeof block === "string") return block;
        if (block && typeof block === "object" && "text" in block) {
          return String((block as { text?: string }).text ?? "");
        }
        return "";
      })
      .join("");
  }
  return String(content ?? "");
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return JSON.parse(trimmed);
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) return JSON.parse(fence[1].trim());
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
  throw new Error("No JSON object found in model response");
}

async function invokeStructured(
  model: BaseChatModel,
  messages: BaseMessage[],
): Promise<GradingResult> {
  const grader = model.withStructuredOutput(GradingResultSchema, {
    name: "submit_roleplay_grade",
  });
  const raw = await grader.invoke(messages);
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as any).criteria)) {
    throw new OutputParserException("Grader returned empty payload", "{}");
  }
  return GradingResultSchema.parse(raw);
}

async function invokeJsonFallback(
  model: BaseChatModel,
  messages: BaseMessage[],
): Promise<GradingResult> {
  const augmented = messages.map((m, i) => {
    if (i === 0 && m instanceof SystemMessage) {
      return new SystemMessage(`${m.content}${JSON_FALLBACK_SUFFIX}`);
    }
    return m;
  });
  const response = await model.invoke(augmented);
  const parsed = extractJsonObject(messageText(response.content));
  return GradingResultSchema.parse(parsed);
}

/**
 * Grade a roleplay transcript against the rubric using structured output,
 * with a JSON fallback for providers that truncate tool calls.
 */
export async function gradeTranscript(
  model: BaseChatModel,
  ctx: GradingContext,
): Promise<GradingResult> {
  const messages: BaseMessage[] = [
    new SystemMessage(buildGradingSystemPrompt(ctx)),
    new HumanMessage(buildTranscriptText(ctx)),
  ];

  const maxAttempts = 2;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await invokeStructured(model, messages);
    } catch (error) {
      lastError = error;
    }
  }

  try {
    return await invokeJsonFallback(model, messages);
  } catch (fallbackError) {
    throw lastError ?? fallbackError;
  }
}

/**
 * Compute the overall weighted percentage (0-100) from per-criterion scores.
 * Each criterion contributes (score/maxScore) * weight; result is the weighted mean as a percent.
 */
export function computeWeightedPercent(
  criteria: GradingCriterionInput[],
  scores: { criterionId: number; score: number }[],
): number {
  let weightedSum = 0;
  let totalWeight = 0;
  const scoreById = new Map(scores.map((s) => [s.criterionId, s.score]));
  for (const c of criteria) {
    const raw = scoreById.get(c.id);
    if (raw == null) continue;
    const max = c.maxScore > 0 ? c.maxScore : 100;
    const fraction = Math.max(0, Math.min(1, raw / max));
    weightedSum += fraction * c.weight;
    totalWeight += c.weight;
  }
  if (totalWeight <= 0) return 0;
  return Math.round((weightedSum / totalWeight) * 10000) / 100;
}
