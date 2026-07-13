import {
  deriveStarLevel,
  maxRewardPoints,
  resolveRewardTierDisplay,
} from "@heybray/gamification/schema";

type TierLike = {
  minScorePercent: number;
  rewardPoints?: number;
  starLevel?: number | null;
  orderIndex?: number;
};

export function computeStarLevel(
  score: number | null | undefined,
  tiers: TierLike[] | undefined,
): 0 | 1 | 2 | 3 {
  if (!tiers?.length || score == null) return 0;
  return deriveStarLevel(score, tiers) as 0 | 1 | 2 | 3;
}

export function computePointsAvailable(tiers: TierLike[] | undefined): number {
  return maxRewardPoints(tiers ?? []);
}

export function computeNextTier(score: number | null | undefined, tiers: TierLike[] | undefined) {
  if (!tiers?.length) return null;
  const sorted = [...tiers].sort(
    (a, b) => (a.starLevel ?? 0) - (b.starLevel ?? 0) || a.minScorePercent - b.minScorePercent,
  );
  if (score == null) return sorted[0] ?? null;
  return sorted.find((t) => t.minScorePercent > score) ?? null;
}

export function pointsBarTint(starLevel: 0 | 1 | 2 | 3): string {
  if (starLevel === 0) return "bg-muted";
  return resolveRewardTierDisplay({ starLevel }).color;
}

export function pointsLineClass(starLevel: 0 | 1 | 2 | 3): string {
  if (starLevel === 0) return "text-muted-foreground";
  const color = resolveRewardTierDisplay({ starLevel }).color;
  return "font-semibold";
}

export function pointsLineStyle(starLevel: 0 | 1 | 2 | 3): React.CSSProperties | undefined {
  if (starLevel === 0) return undefined;
  return { color: resolveRewardTierDisplay({ starLevel }).color };
}
