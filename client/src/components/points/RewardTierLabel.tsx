import { resolveLucideIcon } from "@/lib/classification-display";
import { cn } from "@/lib/utils";
import { resolveRewardTierDisplay } from "@shared/schemas/points";

type RewardTierLabelProps = {
  tierName: string;
  color?: string | null;
  icon?: string | null;
  compact?: boolean;
  className?: string;
};

export function RewardTierLabel({
  tierName,
  color,
  icon,
  compact = false,
  className,
}: RewardTierLabelProps) {
  const display = resolveRewardTierDisplay({ tierName, color, icon });
  const Icon = resolveLucideIcon(display.icon);

  return (
    <span className={cn("inline-flex items-center", compact ? "gap-1.5 text-xs" : "gap-2", className)}>
      <Icon
        className={cn("shrink-0", compact ? "h-3.5 w-3.5" : "h-4 w-4")}
        style={{ color: display.color }}
        aria-hidden
      />
      <span className="truncate">{tierName}</span>
    </span>
  );
}
