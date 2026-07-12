import { cn } from "@heybray/ui/utils";
import { resolveRewardTierDisplay } from "@shared/schemas/points";
import type { RewardTierRow } from "./scenario-progress-types";

type NextTierInfo = {
  tierName: string;
  starLevel?: number;
  color: string;
  minScorePercent: number;
  rewardPoints: number;
};

type ScenarioNextTierStripProps = {
  tiers: RewardTierRow[];
  bestScore: number | null;
  nextTier: NextTierInfo | null;
  tierReachedThisAttempt: string | null;
  emphasizeCurrentTier: boolean;
  previousBestScore: number | null;
  animate: boolean;
  className?: string;
};

function buildTierBarSegments(
  sortedTiers: RewardTierRow[],
  bestScore: number,
): { color: string; widthPct: number }[] {
  const segments: { color: string; widthPct: number }[] = [];
  let cursor = 0;

  for (let i = 0; i < sortedTiers.length; i++) {
    const tier = sortedTiers[i];
    const display = resolveRewardTierDisplay(tier);
    const threshold = tier.minScorePercent;

    if (bestScore >= threshold) {
      if (threshold > cursor) {
        segments.push({ color: display.color, widthPct: threshold - cursor });
      }
      cursor = threshold;
      continue;
    }

    if (bestScore > cursor) {
      const prevTier = i > 0 ? sortedTiers[i - 1] : tier;
      const color = resolveRewardTierDisplay(prevTier).color;
      segments.push({ color, widthPct: bestScore - cursor });
    }
    break;
  }

  if (bestScore > cursor) {
    const lastAchieved = [...sortedTiers].reverse().find((t) => bestScore >= t.minScorePercent);
    if (lastAchieved) {
      segments.push({
        color: resolveRewardTierDisplay(lastAchieved).color,
        widthPct: bestScore - cursor,
      });
    }
  }

  return segments;
}

export function ScenarioNextTierStrip({
  tiers,
  bestScore,
  nextTier,
  tierReachedThisAttempt: _tierReachedThisAttempt,
  emphasizeCurrentTier: _emphasizeCurrentTier,
  previousBestScore,
  animate,
  className,
}: ScenarioNextTierStripProps) {
  if (!tiers.length) return null;

  const sortedTiers = [...tiers].sort(
    (a, b) => (a.starLevel ?? 0) - (b.starLevel ?? 0) || a.minScorePercent - b.minScorePercent,
  );
  const topTier = sortedTiers[sortedTiers.length - 1];
  const hasScore = bestScore != null;
  const fillPct = hasScore ? Math.min(100, Math.max(0, bestScore)) : 0;
  const atTopTier =
    hasScore && topTier != null && bestScore >= topTier.minScorePercent;

  const showGrowAnimation =
    animate &&
    hasScore &&
    previousBestScore != null &&
    bestScore > Math.round(previousBestScore);

  const segments = hasScore ? buildTierBarSegments(sortedTiers, bestScore) : [];

  const stripNote = (() => {
    if (atTopTier && topTier) {
      const display = resolveRewardTierDisplay(topTier);
      return (
        <>
          <strong className="text-foreground">{display.name} achieved</strong>
          {" — top tier for this scenario"}
        </>
      );
    }
    if (nextTier && bestScore != null) {
      const delta = Math.max(0, Math.ceil(nextTier.minScorePercent - bestScore));
      const display = resolveRewardTierDisplay(nextTier);
      return (
        <>
          <strong style={{ color: display.color }}>{delta} points</strong>
          {" from "}
          <span style={{ color: display.color }}>{nextTier.tierName}</span>
        </>
      );
    }
    return null;
  })();

  if (!stripNote) return null;

  return (
    <div className={cn("mt-5 pt-4 border-t border-border", className)}>
      <div className="h-3 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full flex", showGrowAnimation && "animate-reveal-strip-grow")}
          style={
            showGrowAnimation
              ? {
                  ["--strip-fill-from" as string]: `${Math.min(100, Math.max(0, Math.round(previousBestScore!)))}%`,
                  ["--strip-fill-to" as string]: `${fillPct}%`,
                }
              : { width: `${fillPct}%` }
          }
        >
          {fillPct > 0 &&
            segments.map((segment, index) => (
              <div
                key={index}
                className="h-full shrink-0"
                style={{
                  width: `${(segment.widthPct / fillPct) * 100}%`,
                  backgroundColor: segment.color,
                }}
              />
            ))}
        </div>
      </div>

      <p className="mt-2.5 text-sm text-muted-foreground">{stripNote}</p>
    </div>
  );
}
