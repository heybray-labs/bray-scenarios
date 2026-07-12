import { Flame, Star, TrendingUp } from "lucide-react";
import { resolveRewardTierDisplay } from "@shared/schemas/points";
import type { StarMapData } from "./star-map-types";

function SummaryCard({
  label,
  icon,
  value,
  delta,
  hint,
}: {
  label: string;
  icon: React.ReactNode;
  value: React.ReactNode;
  delta?: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3.5 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 mb-2">
        {icon}
        {label}
      </p>
      <p className="text-xl font-bold tabular-nums">
        {value}
        {delta && (
          <span className="ml-2 text-xs font-semibold text-success">{delta}</span>
        )}
      </p>
      {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

function TierCount({ level, count }: { level: 1 | 2 | 3; count: number }) {
  const display = resolveRewardTierDisplay({ starLevel: level });
  return (
    <span className="inline-flex items-center gap-1">
      <Star className="h-3.5 w-3.5" style={{ fill: display.color, color: display.color }} />
      {count}
    </span>
  );
}

type StarMapSummaryCardsProps = {
  teamSummary: StarMapData["teamSummary"];
};

export function StarMapSummaryCards({ teamSummary }: StarMapSummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-5">
      <SummaryCard
        label="Team points"
        icon={<TrendingUp className="h-3.5 w-3.5" />}
        value={teamSummary.totalPoints.toLocaleString()}
        delta={
          teamSummary.monthPoints > 0
            ? `+${teamSummary.monthPoints} this month`
            : undefined
        }
      />
      <SummaryCard
        label="Tier record"
        icon={<Star className="h-3.5 w-3.5" />}
        value={
          <span className="flex items-center gap-3 text-base font-semibold">
            <TierCount level={3} count={teamSummary.starCounts.gold} />
            <TierCount level={2} count={teamSummary.starCounts.silver} />
            <TierCount level={1} count={teamSummary.starCounts.bronze} />
          </span>
        }
      />
      <SummaryCard
        label="Pass rate"
        icon={<TrendingUp className="h-3.5 w-3.5" />}
        value={`${Math.round(teamSummary.passRate * 100)}%`}
        hint="Average per-member pass rate"
      />
      <SummaryCard
        label="Practicing this week"
        icon={<Flame className="h-3.5 w-3.5" />}
        value={`${teamSummary.activeThisWeek} of ${teamSummary.memberCount}`}
        hint="Members with ≥1 attempt this ISO week"
      />
    </div>
  );
}
