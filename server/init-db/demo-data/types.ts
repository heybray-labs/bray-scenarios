export type ScoreBandId = "high" | "mid" | "low";

export type TranscriptTurn = {
  role: "persona" | "learner";
  content: string;
};

export type CriterionScoreTemplate = {
  criterionName: string;
  score: number;
  feedback: string;
  strengths: string;
  improvements: string;
};

export type ScoreBandContent = {
  band: ScoreBandId;
  scoreMin: number;
  scoreMax: number;
  messages: TranscriptTurn[];
  criterionScores: CriterionScoreTemplate[];
  overallFeedback: string;
};

export type DemoPersona = {
  name: string;
  roleTitle: string;
  personalityTraits: string;
  mood: string;
  difficulty: "easy" | "medium" | "hard";
  backgroundFacts: string;
  hiddenObjective: string;
  openingStyle: string;
};

export type DemoCriterion = {
  name: string;
  description: string;
};

export type DemoScenario = {
  slug: string;
  title: string;
  category: string;
  audienceLevel: string;
  duration: string;
  tags: string[];
  learnerRole: string;
  situationContext: string;
  learnerObjective: string;
  introduction: string;
  persona: DemoPersona;
  criteria: DemoCriterion[];
  scoreBands: ScoreBandContent[];
};
