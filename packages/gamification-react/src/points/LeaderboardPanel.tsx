import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@heybray/ui/components/select";
import { Button } from "@heybray/ui/components/button";
import { Avatar, AvatarFallback } from "@heybray/ui/components/avatar";
import { Badge } from "@heybray/ui/components/badge";
import { apiRequest } from "@heybray/react/lib/queryClient";
import { cn } from "@heybray/ui/utils";
import { ClassificationOptionLabel } from "@heybray/react/classifications/ClassificationOptionLabel";
import { currentUserHighlightStyle, getRankColor } from "@heybray/react/lib/classification-display";
import { initialsFromName } from "@heybray/react/lib/user-display";
import { HomeSidebarPanel } from "./HomeSidebarPanel.tsx";
import {
  Trophy,
  Globe,
  CalendarRange,
  CalendarDays,
  Crown,
} from "lucide-react";

const GLOBAL_LEADERBOARD_VALUE = "global";
const LEADERBOARD_LIMIT = 20;
const TABLE_BODY_MAX_ROWS = LEADERBOARD_LIMIT - 3;

type LeaderboardEntry = {
  userId: number;
  name: string;
  points: number;
  rank: number;
  isCurrentUser: boolean;
};

type CategoryOption = {
  slug: string;
  label: string;
  icon: string;
  color: string;
};

type LeaderboardPanelProps = {
  categoryOptions?: CategoryOption[];
  className?: string;
};

const CURRENT_USER_ROW = "font-semibold";

function currentUserRowStyle(isCurrentUser: boolean) {
  return isCurrentUser ? currentUserHighlightStyle() : undefined;
}

const PODIUM_CONFIG = {
  1: {
    size: "h-[4.5rem] w-[4.5rem]",
    order: "order-2",
    pedestal: "h-14",
  },
  2: {
    size: "h-16 w-16",
    order: "order-1",
    pedestal: "h-10",
  },
  3: {
    size: "h-16 w-16",
    order: "order-3",
    pedestal: "h-8",
  },
} as const;

function PodiumEntry({ entry }: { entry: LeaderboardEntry }) {
  const config = PODIUM_CONFIG[entry.rank as 1 | 2 | 3];
  if (!config) return null;

  const rankColor = getRankColor(entry.rank as 1 | 2 | 3);

  return (
    <div className={cn("flex flex-col items-center min-w-0 flex-1", config.order)}>
      <div className="relative mb-2 pt-4">
        <Crown
          className="absolute top-0 right-0 h-5 w-5 drop-shadow-sm z-10"
          style={{ color: rankColor, fill: rankColor }}
          aria-hidden
        />
        <Avatar
          className={cn(
            config.size,
            "shadow-lg border-[3px]",
            entry.isCurrentUser && "ring-2 ring-primary ring-offset-2 ring-offset-card",
          )}
          style={{ borderColor: rankColor }}
        >
          <AvatarFallback
            className={cn(
              "text-sm font-semibold",
              entry.isCurrentUser ? "bg-primary text-primary-foreground" : "bg-muted",
            )}
          >
            {initialsFromName(entry.name)}
          </AvatarFallback>
        </Avatar>
        <span
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full px-1.5 py-0.5 text-[10px] font-bold shadow-sm text-white"
          style={{ backgroundColor: rankColor }}
        >
          #{entry.rank}
        </span>
      </div>
      <p className="text-xs font-medium truncate max-w-full text-center px-1 flex items-center justify-center gap-1">
        {entry.name}
        {entry.isCurrentUser && (
          <Badge variant="secondary" className="h-4 px-1 text-[9px] uppercase tracking-wide">
            You
          </Badge>
        )}
      </p>
      <p className="text-sm font-bold tabular-nums" style={{ color: rankColor }}>
        {entry.points.toLocaleString()}
      </p>
      <div
        className={cn(
          "mt-2 w-full rounded-t-lg bg-muted",
          config.pedestal,
        )}
        aria-hidden
      />
    </div>
  );
}

function LeaderboardPodium({ entries }: { entries: LeaderboardEntry[] }) {
  const topThree = entries.filter((e) => e.rank <= 3);
  if (topThree.length === 0) return null;

  const ordered = [2, 1, 3]
    .map((rank) => topThree.find((e) => e.rank === rank))
    .filter((e): e is LeaderboardEntry => !!e);

  return (
    <div className="flex items-end justify-center gap-2 pt-4 pb-1 mb-2">
      {ordered.map((entry) => (
        <PodiumEntry key={entry.userId} entry={entry} />
      ))}
    </div>
  );
}

function LeaderboardTable({ entries }: { entries: LeaderboardEntry[] }) {
  if (entries.length === 0) return null;

  return (
    <div
      className="overflow-y-auto"
      style={{ maxHeight: `calc(${TABLE_BODY_MAX_ROWS} * 2.25rem + 2rem)` }}
    >
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-[1] bg-card">
          <tr className="text-xs text-muted-foreground">
            <th className="py-1.5 pr-2 text-left font-medium w-8">#</th>
            <th className="py-1.5 pr-2 text-left font-medium">Player</th>
            <th className="py-1.5 text-right font-medium">Pts</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr
              key={entry.userId}
              className={cn(
                entry.isCurrentUser ? CURRENT_USER_ROW : "hover:bg-muted/40",
              )}
              style={currentUserRowStyle(entry.isCurrentUser)}
            >
              <td className="py-2 pr-2 text-muted-foreground tabular-nums rounded-l-md">
                {entry.rank}
              </td>
              <td className="py-2 pr-2 truncate max-w-[8rem]">
                <span className="inline-flex items-center gap-1.5">
                  {entry.name}
                  {entry.isCurrentUser && (
                    <Badge variant="default" className="h-4 px-1 text-[9px] uppercase">
                      You
                    </Badge>
                  )}
                </span>
              </td>
              <td className="py-2 text-right font-semibold tabular-nums rounded-r-md">
                {entry.points.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CurrentUserRankBar({ entry }: { entry: LeaderboardEntry }) {
  return (
    <div
      className={cn(
        "shrink-0 flex items-center justify-between gap-2 px-3 py-2.5 text-sm border-t",
      )}
      style={currentUserHighlightStyle()}
    >
      <span className="font-medium truncate">
        Your rank
        <Badge variant="default" className="ml-2 h-5 px-1.5 text-[10px] uppercase">
          You
        </Badge>
      </span>
      <span className="font-bold tabular-nums whitespace-nowrap">
        #{entry.rank} · {entry.points.toLocaleString()} pts
      </span>
    </div>
  );
}

export function LeaderboardPanel({ categoryOptions = [], className }: LeaderboardPanelProps) {
  const [selection, setSelection] = useState(GLOBAL_LEADERBOARD_VALUE);
  const [period, setPeriod] = useState<"all_time" | "month">("all_time");

  const scopeTab = selection === GLOBAL_LEADERBOARD_VALUE ? "global" : "category";
  const effectiveCategory =
    selection === GLOBAL_LEADERBOARD_VALUE
      ? categoryOptions[0]?.slug ?? ""
      : selection;

  const selectedCategory = categoryOptions.find((c) => c.slug === effectiveCategory);

  const queryKey = useMemo(
    () => ["/api/points/leaderboard", scopeTab, scopeTab === "category" ? effectiveCategory : null, period],
    [scopeTab, effectiveCategory, period],
  );

  const { data, isLoading } = useQuery<{
    entries: LeaderboardEntry[];
    currentUser: LeaderboardEntry | null;
  }>({
    queryKey,
    queryFn: () => {
      const params = new URLSearchParams();
      params.set("scope", scopeTab);
      params.set("period", period);
      params.set("limit", String(LEADERBOARD_LIMIT));
      if (scopeTab === "category" && effectiveCategory) {
        params.set("category", effectiveCategory);
      }
      return apiRequest("GET", `/api/points/leaderboard?${params.toString()}`);
    },
    enabled: scopeTab === "global" || !!effectiveCategory,
  });

  const entries = data?.entries ?? [];
  const currentUser = data?.currentUser ?? null;
  const restEntries = entries.filter((e) => e.rank > 3);
  const currentUserInList = currentUser
    ? entries.some((e) => e.userId === currentUser.userId)
    : false;
  const showCurrentUserBar = currentUser && !currentUserInList;

  return (
    <HomeSidebarPanel
      icon={Trophy}
      title="Leaderboard"
      subtitle="Top performers by points"
      className={className}
    >
      <div className="shrink-0 space-y-2.5 mb-3">
        <div className="flex rounded-full bg-muted p-0.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "flex-1 h-8 gap-1.5 rounded-full",
              period === "month" && "bg-primary/10 text-primary font-semibold shadow-sm",
            )}
            onClick={() => setPeriod("month")}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            This Month
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "flex-1 h-8 gap-1.5 rounded-full",
              period === "all_time" && "bg-primary/10 text-primary font-semibold shadow-sm",
            )}
            onClick={() => setPeriod("all_time")}
          >
            <CalendarRange className="h-3.5 w-3.5" />
            All Time
          </Button>
        </div>

        <Select value={selection} onValueChange={setSelection}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Select leaderboard">
              {selection === GLOBAL_LEADERBOARD_VALUE ? (
                <span className="inline-flex items-center gap-2 font-semibold">
                  <Globe className="h-3.5 w-3.5 text-primary" />
                  Global Leaderboard
                </span>
              ) : selectedCategory ? (
                <ClassificationOptionLabel
                  compact
                  label={selectedCategory.label}
                  color={selectedCategory.color}
                  icon={selectedCategory.icon}
                />
              ) : (
                "Select leaderboard"
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={GLOBAL_LEADERBOARD_VALUE} className="font-semibold">
              <span className="inline-flex items-center gap-2">
                <Globe className="h-3.5 w-3.5 text-primary" />
                Global Leaderboard
              </span>
            </SelectItem>
            {categoryOptions.length > 0 && (
              <>
                <SelectSeparator />
                <SelectGroup>
                  <SelectLabel>By category</SelectLabel>
                  {categoryOptions.map((option) => (
                    <SelectItem key={option.slug} value={option.slug}>
                      <ClassificationOptionLabel
                        compact
                        label={option.label}
                        color={option.color}
                        icon={option.icon}
                      />
                    </SelectItem>
                  ))}
                </SelectGroup>
              </>
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="shrink-0 pb-2">
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No points recorded yet.
          </p>
        ) : (
          <>
            <LeaderboardPodium entries={entries} />
            <LeaderboardTable entries={restEntries} />
          </>
        )}
      </div>

      {showCurrentUserBar && currentUser && <CurrentUserRankBar entry={currentUser} />}
    </HomeSidebarPanel>
  );
}
