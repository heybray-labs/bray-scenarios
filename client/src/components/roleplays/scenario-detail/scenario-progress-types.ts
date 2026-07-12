export type ScenarioProgressTier = {
  tierName: string;
  starLevel: number;
  color: string;
  minScorePercent: number;
  rewardPoints: number;
};

export type CriterionBest = {
  criterionId: number;
  name: string;
  bestScore: number;
};

export type ScenarioProgressData = {
  bestScore: number | null;
  attemptCount: number;
  remainingAttempts: number | null;
  pointsEarned: number;
  currentTier: ScenarioProgressTier | null;
  nextTier: ScenarioProgressTier | null;
  criterionBests: CriterionBest[];
  lastTopImprovement: string | null;
};

export type ScenarioLeaderboardEntry = {
  userId: number;
  name: string;
  bestScore: number;
  rank: number;
};

export type ScenarioLeaderboardData = {
  entries: ScenarioLeaderboardEntry[];
  currentUser: ScenarioLeaderboardEntry | null;
};

export type RewardTierRow = {
  id?: number;
  starLevel?: number;
  tierName: string;
  minScorePercent: number;
  rewardPoints: number;
  color?: string | null;
  icon?: string | null;
};

export type ScenarioRun = {
  id: number;
  attemptNumber: number;
  status: string;
  score?: string | null;
  isPassed?: boolean | null;
};
