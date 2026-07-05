import type { ReactNode } from "react";
import { TrendingUp } from "lucide-react";
import { RewardTierLabel } from "@/components/points/RewardTierLabel";
import { cn } from "@/lib/utils";

export type ScenarioProgressData = {
  bestScore: number | null;
  attemptCount: number;
  remainingAttempts: number | null;
  pointsEarned: number;
  currentTier: {
    tierName: string;
    color: string;
    icon: string;
    minScorePercent: number;
    rewardPoints: number;
  } | null;
  nextTier: {
    tierName: string;
    color: string;
    icon: string;
    minScorePercent: number;
    rewardPoints: number;
  } | null;
};

type ScenarioProgressPanelProps = {
  progress?: ScenarioProgressData | null;
  isLoading?: boolean;
  className?: string;
};

function StatRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums text-right">{value}</span>
    </div>
  );
}

export function ScenarioProgressPanel({
  progress,
  isLoading,
  className,
}: ScenarioProgressPanelProps) {
  if (isLoading) {
    return (
      <div className={cn("rounded-xl border bg-muted/20 p-4 space-y-3", className)}>
        <p className="text-sm text-muted-foreground">Loading progress…</p>
      </div>
    );
  }

  if (!progress) return null;

  const attemptsLabel =
    progress.remainingAttempts != null
      ? `${progress.attemptCount} used · ${progress.remainingAttempts} remaining`
      : `${progress.attemptCount} used · Unlimited`;

  return (
    <div className={cn("rounded-xl border bg-muted/20 p-4 space-y-3", className)}>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
        <TrendingUp className="h-3.5 w-3.5" />
        Your progress
      </h3>
      <div className="space-y-2">
        <StatRow
          label="Best score"
          value={progress.bestScore != null ? `${Math.round(progress.bestScore)}%` : "—"}
        />
        <StatRow label="Attempts" value={attemptsLabel} />
        <StatRow label="Points earned" value={progress.pointsEarned} />
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground shrink-0">Current tier</span>
          {progress.currentTier ? (
            <RewardTierLabel
              compact
              tierName={progress.currentTier.tierName}
              color={progress.currentTier.color}
              icon={progress.currentTier.icon}
              className="font-medium"
            />
          ) : (
            <span className="font-medium">No tier yet</span>
          )}
        </div>
        {progress.nextTier && (
          <p className="text-xs text-muted-foreground pt-1 border-t border-border/50">
            Score {progress.nextTier.minScorePercent}%+ for{" "}
            <span className="font-medium" style={{ color: progress.nextTier.color }}>
              {progress.nextTier.tierName}
            </span>{" "}
            ({progress.nextTier.rewardPoints} pts)
          </p>
        )}
      </div>
    </div>
  );
}
