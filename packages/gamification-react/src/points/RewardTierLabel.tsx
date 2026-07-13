import { cn } from "@heybray/ui/utils";
import {
  resolveRewardTierDisplay,
  resolveStarLevelFromTier,
} from "@heybray/gamification/schema";
import { TierStars } from "./TierStars";

type RewardTierLabelProps = {
  tierName: string;
  starLevel?: number | null;
  color?: string | null;
  icon?: string | null;
  compact?: boolean;
  className?: string;
};

export function RewardTierLabel({
  tierName,
  starLevel,
  color,
  icon,
  compact = false,
  className,
}: RewardTierLabelProps) {
  const resolvedLevel = resolveStarLevelFromTier({ starLevel, tierName });
  const display = resolveRewardTierDisplay({ starLevel: resolvedLevel, tierName, color, icon });
  const level = (display.starLevel || resolvedLevel) as 0 | 1 | 2 | 3;

  return (
    <span
      className={cn(
        "inline-flex items-center",
        compact ? "gap-1.5 text-xs" : "gap-2",
        className,
      )}
    >
      <TierStars level={level} size={compact ? "sm" : "md"} />
      <span className="truncate">{display.name}</span>
    </span>
  );
}
