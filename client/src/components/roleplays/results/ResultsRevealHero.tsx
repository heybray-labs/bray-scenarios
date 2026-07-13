import { CheckCircle2, TrendingUp, XCircle } from "lucide-react";
import { TierStars } from "@heybray/gamification-react/points/TierStars";
import { ScenarioNextTierStrip } from "@/components/roleplays/scenario-detail/ScenarioNextTierStrip";
import type { RewardTierRow } from "@/components/roleplays/scenario-detail/scenario-progress-types";
import { cn } from "@heybray/ui/utils";
import { starLevelFromTierName } from "@heybray/gamification/schema";
import { useAnimatedValue } from "@heybray/gamification-react/reveal/reveal-hooks";

type ResultsRevealHeroProps = {
  score: number | null;
  passed: boolean | null;
  gradingFailed: boolean;
  overallFeedback?: string | null;
  tierName: string | null;
  pointsAwarded: number;
  totalPoints: number;
  isNewBest: boolean;
  previousBestScore: number | null;
  reducedMotion: boolean;
  rewardTiers: RewardTierRow[];
  nextTier: {
    tierName: string;
    starLevel?: number;
    color: string;
    minScorePercent: number;
    rewardPoints: number;
  } | null;
  bestScoreAfter: number | undefined;
};

export function ResultsRevealHero({
  score,
  passed,
  gradingFailed,
  overallFeedback,
  tierName,
  pointsAwarded,
  totalPoints,
  isNewBest,
  previousBestScore,
  reducedMotion,
  rewardTiers,
  nextTier,
  bestScoreAfter,
}: ResultsRevealHeroProps) {
  const animate = !reducedMotion && score != null && !gradingFailed;
  const displayScore = useAnimatedValue(score ?? 0, 1100, animate);
  const displayPoints = useAnimatedValue(pointsAwarded, 1100, animate && pointsAwarded > 0);
  const ringDegrees = animate ? (displayScore / 100) * 360 : (score ?? 0) * 3.6;

  const showTierProgress = pointsAwarded > 0 && !!tierName;
  const starLevel = tierName
    ? (starLevelFromTierName(tierName) as 0 | 1 | 2 | 3)
    : 0;
  const showNewBest =
    isNewBest &&
    (pointsAwarded > 0 ||
      (previousBestScore != null && score != null && score > Math.round(previousBestScore)));
  const delta =
    showNewBest && previousBestScore != null && score != null
      ? score - Math.round(previousBestScore)
      : null;

  if (gradingFailed) {
    return (
      <div className="rounded-2xl border bg-card px-6 py-8 shadow-sm">
        <div className="max-h-48 overflow-y-auto text-sm text-muted-foreground leading-relaxed">
          {overallFeedback || "Grading could not be completed for this attempt."}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-gradient-to-br from-pink-50/80 to-card dark:from-pink-950/20 dark:to-card px-6 py-7 shadow-sm">
      <div className="flex flex-col sm:flex-row items-center gap-7 sm:gap-8">
        <div className="relative h-[132px] w-[132px] shrink-0">
          <div className="absolute inset-0 rounded-full bg-muted" />
          <div
            className="absolute inset-0 rounded-full transition-[background] duration-[1100ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{
              background: `conic-gradient(var(--success) 0deg, var(--success) ${ringDegrees}deg, var(--muted) ${ringDegrees}deg)`,
            }}
          />
          <div className="absolute inset-[10px] flex flex-col items-center justify-center rounded-full border bg-card shadow-[inset_0_0_0_1px_var(--border)]">
            <span className="text-[2rem] font-bold tabular-nums leading-none tracking-tight">
              {score != null ? displayScore : "—"}
            </span>
            <span className="text-sm text-muted-foreground -mt-0.5">%</span>
            {passed != null && (
              <span
                className={cn(
                  "mt-1.5 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                  passed
                    ? "bg-success/10 text-success"
                    : "bg-destructive/10 text-destructive",
                )}
              >
                {passed ? (
                  <>
                    <CheckCircle2 className="h-3 w-3" /> Passed
                  </>
                ) : (
                  <>
                    <XCircle className="h-3 w-3" /> Not passed
                  </>
                )}
              </span>
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1 text-center sm:text-left">
          {showTierProgress && (
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 mb-2.5">
              <TierStars
                level={starLevel}
                size="lg"
                animateStamp={animate}
              />
              <span className="text-[15px] font-semibold">Reached {tierName}</span>
            </div>
          )}

          {showNewBest && (
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 mb-2.5">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-bold tracking-wide text-primary-foreground",
                  animate && "animate-reveal-pop-in",
                  !animate && "opacity-100",
                )}
              >
                <TrendingUp className="h-3 w-3" />
                NEW BEST
              </span>
              {delta != null && previousBestScore != null && (
                <span className="text-sm text-muted-foreground">
                  vs previous best {Math.round(previousBestScore)}% ·{" "}
                  <strong className="text-success">▲ +{delta}</strong>
                </span>
              )}
            </div>
          )}

          {pointsAwarded > 0 && tierName && (
            <p
              className={cn(
                "text-sm text-foreground",
                animate && "animate-reveal-fade-up",
                !animate && "opacity-100",
              )}
            >
              <span className="text-lg font-bold tabular-nums text-warning">
                +{displayPoints}
              </span>{" "}
              points earned — reached {tierName}
              {totalPoints > 0 && (
                <span className="text-muted-foreground text-xs ml-1.5">
                  · {totalPoints.toLocaleString()} pts total
                </span>
              )}
            </p>
          )}

          {overallFeedback && (
            <div className="mt-3 max-h-36 overflow-y-auto rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground leading-relaxed max-w-prose mx-auto sm:mx-0">
              {overallFeedback}
            </div>
          )}

          {rewardTiers.length > 0 && (
            <ScenarioNextTierStrip
              tiers={rewardTiers}
              bestScore={bestScoreAfter ?? null}
              nextTier={nextTier}
              tierReachedThisAttempt={pointsAwarded > 0 && tierName ? tierName : null}
              emphasizeCurrentTier={pointsAwarded > 0 && !!tierName}
              previousBestScore={previousBestScore}
              animate={animate}
            />
          )}
        </div>
      </div>
    </div>
  );
}
