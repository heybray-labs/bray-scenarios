import { Link } from "wouter";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScenarioCover } from "@/components/roleplays/ScenarioCover";
import type { ScenarioCoverStatus } from "@/components/roleplays/ScenarioCover";
import { ScenarioProgressPanel, type ScenarioProgressData } from "./ScenarioProgressPanel";
import { ScenarioSessionRules } from "./ScenarioSessionRules";
import { ScenarioRewardsTable, type RewardTierRow } from "./ScenarioRewardsTable";
import { ScenarioAttemptsList, type ScenarioAttempt } from "./ScenarioAttemptsList";
import { cn } from "@/lib/utils";

type ScenarioDetailRailProps = {
  roleplayId: number;
  coverImageMediaId?: number | null;
  coverStatus?: ScenarioCoverStatus | null;
  onCoverStatusClick?: () => void;
  progress?: ScenarioProgressData | null;
  progressLoading?: boolean;
  rewardTiers: RewardTierRow[];
  bestScore: number | null;
  attempts: ScenarioAttempt[];
  onAttemptClick: (attempt: ScenarioAttempt) => void;
  passThreshold: number;
  maxTurns: number | null;
  autoEndOnMaxTurns?: boolean;
  timeLimitMinutes: number | null;
  liveCoaching: boolean;
  maxAttempts: number | null;
  notConfigured: boolean;
  configNotReady: boolean;
  canStart: boolean;
  startPending: boolean;
  onStart: () => void;
  canManage: boolean;
  className?: string;
};

export function ScenarioDetailRail({
  roleplayId,
  coverImageMediaId,
  coverStatus,
  onCoverStatusClick,
  progress,
  progressLoading,
  rewardTiers,
  bestScore,
  attempts,
  onAttemptClick,
  passThreshold,
  maxTurns,
  autoEndOnMaxTurns,
  timeLimitMinutes,
  liveCoaching,
  maxAttempts,
  notConfigured,
  configNotReady,
  canStart,
  startPending,
  onStart,
  canManage,
  className,
}: ScenarioDetailRailProps) {
  return (
    <aside
      className={cn(
        "w-full lg:w-[30%] shrink-0 space-y-4",
        "lg:sticky lg:top-20 lg:self-start",
        className,
      )}
    >
      <div className="overflow-hidden rounded-xl border">
        <ScenarioCover
          mediaId={coverImageMediaId}
          status={coverStatus}
          onStatusClick={onCoverStatusClick}
        />
      </div>

      <ScenarioProgressPanel progress={progress} isLoading={progressLoading} />

      <ScenarioSessionRules
        passThreshold={passThreshold}
        maxTurns={maxTurns}
        autoEndOnMaxTurns={autoEndOnMaxTurns}
        timeLimitMinutes={timeLimitMinutes}
        liveCoaching={liveCoaching}
        maxAttempts={maxAttempts}
        notConfigured={notConfigured}
        configNotReady={configNotReady}
        canStart={canStart}
        startPending={startPending}
        onStart={onStart}
      />

      <ScenarioRewardsTable tiers={rewardTiers} bestScore={bestScore} />

      <ScenarioAttemptsList attempts={attempts} onAttemptClick={onAttemptClick} />

      {canManage && (
        <div className="rounded-xl border bg-muted/20 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2 mb-2">
            <Shield className="h-3.5 w-3.5" />
            Admin
          </h3>
          <Button variant="outline" size="sm" className="w-full" asChild>
            <Link href={`/roleplays/${roleplayId}/attempts`}>View all attempts</Link>
          </Button>
        </div>
      )}
    </aside>
  );
}
