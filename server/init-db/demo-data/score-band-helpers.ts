import type { CriterionScoreTemplate, ScoreBandContent, ScoreBandId, TranscriptTurn } from "./types.ts";

type TurnPair = { persona: string; learner: string };

function buildMessages(turns: TurnPair[]): TranscriptTurn[] {
  const messages: TranscriptTurn[] = [];
  for (const turn of turns) {
    messages.push({ role: "persona", content: turn.persona });
    messages.push({ role: "learner", content: turn.learner });
  }
  return messages;
}

function buildCriterionScores(
  names: string[],
  scores: [number, number, number],
  band: ScoreBandId,
): CriterionScoreTemplate[] {
  const templates: Record<
    ScoreBandId,
    { feedback: string; strengths: string; improvements: string }
  > = {
    high: {
      feedback: "Strong performance with clear, consistent execution throughout.",
      strengths: "Demonstrated confidence and adapted well to pushback.",
      improvements: "Minor polish on pacing could make the interaction even sharper.",
    },
    mid: {
      feedback: "Solid foundation with room to deepen impact in key moments.",
      strengths: "Maintained professionalism and addressed core concerns.",
      improvements: "Could probe more and offer more specific next steps.",
    },
    low: {
      feedback: "Several important moments were missed or handled too briefly.",
      strengths: "Showed willingness to engage and remained respectful.",
      improvements: "Needs stronger structure, empathy, and clearer resolution.",
    },
  };

  const t = templates[band];
  return names.map((name, i) => ({
    criterionName: name,
    score: scores[i],
    feedback: `${name}: ${t.feedback}`,
    strengths: t.strengths,
    improvements: t.improvements,
  }));
}

export function makeScoreBand(
  band: ScoreBandId,
  scoreMin: number,
  scoreMax: number,
  criterionNames: string[],
  scores: [number, number, number],
  turns: TurnPair[],
  overallFeedback: string,
): ScoreBandContent {
  return {
    band,
    scoreMin,
    scoreMax,
    messages: buildMessages(turns),
    criterionScores: buildCriterionScores(criterionNames, scores, band),
    overallFeedback,
  };
}
