import { Award } from "lucide-react";
import { RewardTierLabel } from "@heybray/gamification-react/points/RewardTierLabel";
import { TierStars } from "@heybray/gamification-react/points/TierStars";
import { ScenarioDetailCard } from "./ScenarioDetailCard";
import { classificationChipStyle } from "@heybray/react/lib/classification-display";
import { resolveRewardTierDisplay } from "@heybray/gamification/schema";
import type { RewardTierRow } from "./scenario-progress-types";

type ScenarioRewardsLadderProps = {
  tiers: RewardTierRow[];
  bestScore: number | null;
  nextTier: {
    tierName: string;
    starLevel?: number;
    color: string;
    minScorePercent: number;
    rewardPoints: number;
  } | null;
  className?: string;
};

function TierStatePill({
  achieved,
  isNext,
}: {
  achieved: boolean;
  isNext: boolean;
}) {
  if (achieved) {
    return (
      <span className="text-xs font-semibold rounded-full px-2 py-0.5 bg-success/10 text-success">
        Achieved
      </span>
    );
  }
  if (isNext) {
    return (
      <span className="text-xs font-semibold rounded-full px-2 py-0.5 bg-primary text-primary-foreground">
        Next tier
      </span>
    );
  }
  return null;
}

function TierNudgePanel({
  color,
  children,
}: {
  color: string;
  children: React.ReactNode;
}) {
  return (
    <p
      className="text-sm rounded-xl border px-3 py-2.5 leading-relaxed"
      style={classificationChipStyle(color)}
    >
      {children}
    </p>
  );
}

export function ScenarioRewardsLadder({
  tiers,
  bestScore,
  nextTier,
  className,
}: ScenarioRewardsLadderProps) {
  if (!tiers.length) return null;

  const sortedAsc = [...tiers].sort(
    (a, b) => (a.starLevel ?? 0) - (b.starLevel ?? 0) || a.minScorePercent - b.minScorePercent,
  );
  const hasAttempt = bestScore != null;
  const fillPct = hasAttempt ? Math.min(100, Math.max(0, bestScore)) : 0;
  const displayScore = hasAttempt ? Math.round(bestScore) : 0;
  const topTier = sortedAsc[sortedAsc.length - 1];
  const atTopTier =
    hasAttempt && topTier && bestScore! >= topTier.minScorePercent;

  const firstTier = sortedAsc[0];

  let nudge: React.ReactNode = null;
  if (atTopTier) {
    nudge = (
      <p className="text-sm text-muted-foreground rounded-lg bg-muted/40 px-3 py-2">
        Top tier achieved — great work!
      </p>
    );
  } else if (!hasAttempt && firstTier) {
    const display = resolveRewardTierDisplay(firstTier);
    nudge = (
      <TierNudgePanel color={display.color}>
        Score <strong>{firstTier.minScorePercent}%+</strong> for{" "}
        <strong>{firstTier.tierName}</strong> (+{firstTier.rewardPoints} pts).
      </TierNudgePanel>
    );
  } else if (nextTier && bestScore != null) {
    const delta = Math.max(0, nextTier.minScorePercent - bestScore);
    nudge = (
      <TierNudgePanel color={nextTier.color}>
        <strong>
          {Math.ceil(delta)} point{Math.ceil(delta) === 1 ? "" : "s"} to {nextTier.tierName}.
        </strong>{" "}
        Beat {nextTier.minScorePercent} on your next attempt to earn +{nextTier.rewardPoints} pts.
      </TierNudgePanel>
    );
  }

  return (
    <ScenarioDetailCard icon={<Award />} title="Rewards" bodyClassName="pt-5" className={className}>
      <div className="relative mx-2.5 pt-7 mb-8">
        <div className="h-2 rounded-full bg-muted relative">
          <div
            className="absolute left-0 top-0 h-2 rounded-full bg-primary"
            style={{ width: `${fillPct}%` }}
          />

          {sortedAsc.map((tier) => {
            const display = resolveRewardTierDisplay(tier);
            const starLevel = tier.starLevel ?? display.starLevel;
            const achieved = bestScore != null && bestScore >= tier.minScorePercent;
            const leftPct = tier.minScorePercent;

            return (
              <div
                key={`${tier.tierName}-${tier.minScorePercent}`}
                className="absolute bottom-full -translate-x-1/2 mb-1"
                style={{ left: `${leftPct}%` }}
              >
                <div
                  className="mx-auto rounded-full border-2 border-card flex items-center justify-center px-1 py-0.5"
                  style={
                    achieved
                      ? { backgroundColor: display.color, borderColor: display.color }
                      : classificationChipStyle(display.color)
                  }
                >
                  <TierStars
                    level={(achieved ? starLevel : 0) as 0 | 1 | 2 | 3}
                    size="sm"
                  />
                </div>
              </div>
            );
          })}

          <div
            className="absolute top-full mt-1 -translate-x-1/2 text-xs font-bold text-primary whitespace-nowrap"
            style={{ left: `${fillPct}%` }}
          >
            <div
              className="mx-auto mb-0.5 w-0 h-0 border-l-[5px] border-r-[5px] border-b-[6px] border-l-transparent border-r-transparent border-b-primary"
              aria-hidden
            />
            you · {displayScore}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {sortedAsc.map((tier) => {
          const display = resolveRewardTierDisplay(tier);
          const achieved = bestScore != null && bestScore >= tier.minScorePercent;
          const isNext =
            !achieved &&
            nextTier != null &&
            tier.minScorePercent === nextTier.minScorePercent;

          return (
            <div
              key={`row-${tier.tierName}`}
              className="flex items-center gap-2 text-sm py-1"
            >
              <RewardTierLabel
                compact
                tierName={tier.tierName}
                starLevel={tier.starLevel}
                color={tier.color}
                className="font-medium min-w-0 shrink"
              />
              <span className="text-xs text-muted-foreground shrink-0">{tier.minScorePercent}+</span>
              <TierStatePill achieved={achieved} isNext={isNext} />
              <span
                className="ml-auto text-xs font-semibold tabular-nums shrink-0"
                style={{ color: display.color }}
              >
                +{tier.rewardPoints} pts
              </span>
            </div>
          );
        })}
      </div>

      {nudge && <div className="mt-4">{nudge}</div>}
    </ScenarioDetailCard>
  );
}
