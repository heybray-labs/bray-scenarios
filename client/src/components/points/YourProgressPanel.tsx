import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { PointsHistoryDialog } from "@/components/points/PointsHistoryDialog";
import { resolveRewardTierDisplay } from "@shared/schemas/points";
import { cn } from "@/lib/utils";
import { Flame } from "lucide-react";

export const ALL_CATEGORIES_SLUG = "__all__";

type CategoryMasteryRow = {
  slug: string;
  label: string;
  total: number;
  starCounts: { gold: number; silver: number; bronze: number };
};

const TIER_BAR_COLORS = {
  bronze: resolveRewardTierDisplay({ starLevel: 1 }).color,
  silver: resolveRewardTierDisplay({ starLevel: 2 }).color,
  gold: resolveRewardTierDisplay({ starLevel: 3 }).color,
} as const;

function categoryStarred(row: { starCounts: CategoryMasteryRow["starCounts"] }) {
  return row.starCounts.gold + row.starCounts.silver + row.starCounts.bronze;
}

function CategoryMasteryBar({
  starCounts,
  total,
  highlight,
}: {
  starCounts: { gold: number; silver: number; bronze: number };
  total: number;
  highlight?: boolean;
}) {
  if (total <= 0) {
    return <div className="flex-1 h-3 rounded-full bg-muted" />;
  }

  const segments = [
    { key: "bronze", count: starCounts.bronze, color: TIER_BAR_COLORS.bronze },
    { key: "silver", count: starCounts.silver, color: TIER_BAR_COLORS.silver },
    { key: "gold", count: starCounts.gold, color: TIER_BAR_COLORS.gold },
  ] as const;

  return (
    <div
      className={cn(
        "flex-1 h-3 rounded-full bg-muted overflow-hidden flex",
        highlight && "ring-1 ring-warning ring-offset-1 ring-offset-card",
      )}
    >
      {segments.map(({ key, count, color }) =>
        count > 0 ? (
          <div
            key={key}
            className="h-full shrink-0"
            style={{ width: `${(count / total) * 100}%`, backgroundColor: color }}
            title={`${count} ${key}`}
          />
        ) : null,
      )}
    </div>
  );
}

type YourProgressPanelProps = {
  className?: string;
  activeCategorySlugs?: string[];
  onCategorySelect?: (slug: string) => void;
};

function userDisplayName(user: ReturnType<typeof useAuth>["user"]) {
  const first = user?.profile?.firstName?.trim();
  const last = user?.profile?.lastName?.trim();
  if (first || last) return [first, last].filter(Boolean).join(" ");
  return user?.email?.split("@")[0] ?? "You";
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase() || "?";
}

function CategoryMasteryRowView({
  row,
  isActive,
  highlight,
  onCategorySelect,
}: {
  row: CategoryMasteryRow;
  isActive?: boolean;
  highlight?: boolean;
  onCategorySelect?: (slug: string) => void;
}) {
  const starred = categoryStarred(row);

  return (
    <div className="flex items-center gap-3 text-sm py-0.5">
      {onCategorySelect ? (
        <button
          type="button"
          onClick={() => onCategorySelect(row.slug)}
          className={cn(
            "w-[9rem] truncate text-left hover:underline",
            isActive
              ? "font-semibold text-primary"
              : "text-foreground hover:text-primary",
            row.slug === ALL_CATEGORIES_SLUG && "font-semibold",
          )}
          title={
            row.slug === ALL_CATEGORIES_SLUG
              ? "Browse all scenarios"
              : `Filter scenarios by ${row.label}`
          }
        >
          {row.label}
        </button>
      ) : (
        <span
          className={cn(
            "w-[9rem] truncate",
            row.slug === ALL_CATEGORIES_SLUG && "font-semibold",
          )}
        >
          {row.label}
        </span>
      )}
      <CategoryMasteryBar
        starCounts={row.starCounts}
        total={row.total}
        highlight={highlight}
      />
      <span className="w-10 text-right tabular-nums text-muted-foreground">
        {starred}/{row.total}
      </span>
    </div>
  );
}

type ProgressStats = {
  totalPoints: number;
  monthPoints: number;
  starCounts: { gold: number; silver: number; bronze: number };
  passedCount: number;
  publishedCount: number;
  streakWeeks: number;
  currentWeekActive: boolean;
  categoryMastery: CategoryMasteryRow[];
};

export function YourProgressPanel({
  className,
  activeCategorySlugs = [],
  onCategorySelect,
}: YourProgressPanelProps) {
  const { user } = useAuth();
  const [historyOpen, setHistoryOpen] = useState(false);

  const { data: stats, isLoading } = useQuery<ProgressStats>({
    queryKey: ["/api/points/me/stats"],
    queryFn: () => apiRequest("GET", "/api/points/me/stats"),
  });

  const name = userDisplayName(user);

  const masteryRows = useMemo(() => {
    if (!stats) return [];

    const allCategoriesRow: CategoryMasteryRow = {
      slug: ALL_CATEGORIES_SLUG,
      label: "All Categories",
      total: stats.publishedCount,
      starCounts: stats.starCounts,
    };

    return [allCategoriesRow, ...stats.categoryMastery];
  }, [stats]);

  const lowestMasteryRatio = (() => {
    const rows = stats?.categoryMastery.filter((r) => r.total > 0) ?? [];
    if (!rows.length) return null;
    return Math.min(...rows.map((r) => categoryStarred(r) / r.total));
  })();

  return (
    <>
      <section
        className={cn(
          "rounded-2xl border bg-card p-4 shadow-sm",
          className,
        )}
      >
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
              {initials(name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold leading-tight">Your progress</p>
            <p className="text-xs text-muted-foreground">{name}</p>
          </div>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <div className="mb-3">
              <span className="text-2xl font-bold tabular-nums">
                {(stats?.totalPoints ?? 0).toLocaleString()}
              </span>
              {(stats?.monthPoints ?? 0) > 0 && (
                <span className="ml-2 text-xs font-semibold text-success">
                  +{stats?.monthPoints} this month
                </span>
              )}
            </div>

            {(stats?.streakWeeks ?? 0) > 0 ? (
              <div className="flex items-center gap-2 text-sm font-semibold text-warning mb-3">
                <Flame className="h-4 w-4 fill-warning text-warning" />
                <span>{stats?.streakWeeks}-week practice streak</span>
                {!stats?.currentWeekActive && (
                  <span className="font-normal text-xs text-muted-foreground">
                    · practise this week to keep it
                  </span>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground mb-3">
                Start a new streak this week
              </p>
            )}

            {masteryRows.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Category mastery
                </h3>
                <div className="space-y-3">
                  {masteryRows.map((row) => {
                    const ratio =
                      row.total > 0 ? categoryStarred(row) / row.total : 0;
                    const isLowest =
                      row.slug !== ALL_CATEGORIES_SLUG &&
                      row.total > 0 &&
                      lowestMasteryRatio != null &&
                      ratio === lowestMasteryRatio &&
                      ratio > 0;
                    const isActive =
                      row.slug === ALL_CATEGORIES_SLUG
                        ? activeCategorySlugs.length === 0
                        : activeCategorySlugs.includes(row.slug);
                    return (
                      <CategoryMasteryRowView
                        key={row.slug}
                        row={row}
                        isActive={isActive}
                        highlight={isLowest}
                        onCategorySelect={onCategorySelect}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            <button
              type="button"
              className="mt-3 text-xs font-medium text-primary hover:underline"
              onClick={() => setHistoryOpen(true)}
            >
              View points history →
            </button>
          </>
        )}
      </section>

      <PointsHistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} />
    </>
  );
}
