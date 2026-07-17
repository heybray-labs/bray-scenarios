import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { TranscriptTurn } from "./persona-prompt.ts";

function messageText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((b) =>
        typeof b === "string"
          ? b
          : b && typeof b === "object" && "text" in b
            ? String((b as { text?: string }).text ?? "")
            : "",
      )
      .join("");
  }
  return String(content ?? "");
}

/**
 * Generate a short, in-the-moment coaching hint for the learner based on the
 * conversation so far and the scenario playbook. Returns a single concise tip.
 */
export async function generateLiveHint(
  model: BaseChatModel,
  opts: {
    learnerObjective?: string | null;
    playbook?: string | null;
    transcript: TranscriptTurn[];
    personaName?: string | null;
    learnerRole?: string | null;
  },
): Promise<string> {
  const system = [
    "You are a real-time conversation coach for a learner practising a role-play.",
    "Give the learner ONE short, actionable coaching tip (max 25 words) for their NEXT message.",
    "Be encouraging and specific. Do not role-play, do not address the persona, do not grade.",
    opts.learnerObjective ? `Learner objective: ${opts.learnerObjective}` : "",
    opts.playbook ? `Playbook the learner should follow:\n${opts.playbook}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const personaLabel = opts.personaName?.trim() || "Persona";
  const learnerLabel = opts.learnerRole?.trim() || "Learner";
  const transcript = opts.transcript
    .map((t) =>
      t.role === "persona"
        ? `${personaLabel}: ${t.content}`
        : `${learnerLabel}: ${t.content}`,
    )
    .join("\n");

  const response = await model.invoke([
    new SystemMessage(system),
    new HumanMessage(
      `Conversation so far:\n${transcript}\n\nGive one short coaching tip for the learner's next message.`,
    ),
  ]);

  return messageText(response.content).trim();
}
