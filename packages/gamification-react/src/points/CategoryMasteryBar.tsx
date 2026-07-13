import { resolveRewardTierDisplay } from "@heybray/gamification/schema";
import { cn } from "@heybray/ui/utils";

export const ALL_CATEGORIES_SLUG = "__all__";

export type TierCounts = { gold: number; silver: number; bronze: number };

export const TIER_BAR_COLORS = {
  bronze: resolveRewardTierDisplay({ starLevel: 1 }).color,
  silver: resolveRewardTierDisplay({ starLevel: 2 }).color,
  gold: resolveRewardTierDisplay({ starLevel: 3 }).color,
} as const;

export function categoryStarred(starCounts: TierCounts): number {
  return starCounts.gold + starCounts.silver + starCounts.bronze;
}

export function tierBarTooltip(
  starCounts: TierCounts,
  total: number,
): string {
  const remaining = Math.max(0, total - categoryStarred(starCounts));
  return `${starCounts.gold} Gold · ${starCounts.silver} Silver · ${starCounts.bronze} Bronze · ${remaining} not started (${total} total)`;
}

type CategoryMasteryBarProps = {
  starCounts: TierCounts;
  total: number;
  highlight?: boolean;
  className?: string;
  size?: "sm" | "md";
};

export function CategoryMasteryBar({
  starCounts,
  total,
  highlight,
  className,
  size = "md",
}: CategoryMasteryBarProps) {
  if (total <= 0) {
    return (
      <div
        className={cn(
          "flex-1 min-w-0 rounded-full bg-muted",
          size === "sm" ? "h-2" : "h-3",
          className,
        )}
      />
    );
  }

  const segments = [
    { key: "bronze", count: starCounts.bronze, color: TIER_BAR_COLORS.bronze },
    { key: "silver", count: starCounts.silver, color: TIER_BAR_COLORS.silver },
    { key: "gold", count: starCounts.gold, color: TIER_BAR_COLORS.gold },
  ] as const;

  return (
    <div
      className={cn(
        "flex-1 min-w-0 rounded-full bg-muted overflow-hidden flex",
        size === "sm" ? "h-2" : "h-3",
        highlight && "ring-1 ring-warning ring-offset-1 ring-offset-card",
        className,
      )}
      title={tierBarTooltip(starCounts, total)}
    >
      {segments.map(({ key, count, color }) =>
        count > 0 ? (
          <div
            key={key}
            className="h-full shrink-0"
            style={{ width: `${(count / total) * 100}%`, backgroundColor: color }}
          />
        ) : null,
      )}
    </div>
  );
}
