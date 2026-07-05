import { Trophy } from "lucide-react";
import { RewardTierLabel } from "@/components/points/RewardTierLabel";
import { resolveRewardTierDisplay } from "@shared/schemas/points";
import { cn } from "@/lib/utils";

export type RewardTierRow = {
  id?: number;
  tierName: string;
  minScorePercent: number;
  rewardPoints: number;
  color?: string | null;
  icon?: string | null;
};

type ScenarioRewardsTableProps = {
  tiers: RewardTierRow[];
  bestScore: number | null;
  className?: string;
};

export function ScenarioRewardsTable({
  tiers,
  bestScore,
  className,
}: ScenarioRewardsTableProps) {
  if (!tiers.length) return null;

  const sorted = [...tiers].sort((a, b) => b.minScorePercent - a.minScorePercent);

  return (
    <div className={cn("rounded-xl border overflow-hidden", className)}>
      <div className="px-4 py-2.5 border-b bg-muted/20">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
          <Trophy className="h-3.5 w-3.5 text-amber-500" />
          Rewards
        </h3>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-xs text-muted-foreground bg-muted/10">
            <th className="py-2 pl-4 pr-2 text-left font-medium">Tier</th>
            <th className="py-2 pr-2 text-left font-medium">Min score</th>
            <th className="py-2 pr-4 text-right font-medium">Points</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((tier) => {
            const achieved = bestScore != null && bestScore >= tier.minScorePercent;
            const display = resolveRewardTierDisplay(tier);
            return (
              <tr
                key={`${tier.tierName}-${tier.minScorePercent}`}
                className="border-b border-border/50 last:border-0"
                style={achieved ? { backgroundColor: `${display.color}14` } : undefined}
              >
                <td className="py-2 pl-4 pr-2 align-middle">
                  <RewardTierLabel
                    compact
                    tierName={tier.tierName}
                    color={tier.color}
                    icon={tier.icon}
                    className="font-medium"
                  />
                </td>
                <td className="py-2 pr-2 text-muted-foreground align-middle whitespace-nowrap">
                  {tier.minScorePercent}%+
                  {achieved && (
                    <span
                      className="ml-1.5 text-[11px] font-medium"
                      style={{ color: display.color }}
                    >
                      Achieved
                    </span>
                  )}
                </td>
                <td
                  className="py-2 pr-4 text-right font-semibold tabular-nums align-middle whitespace-nowrap"
                  style={{ color: display.color }}
                >
                  {tier.rewardPoints}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
