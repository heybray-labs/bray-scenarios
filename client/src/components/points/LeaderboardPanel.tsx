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
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { ClassificationOptionLabel } from "@/components/classifications/ClassificationOptionLabel";
import {
  Trophy,
  Globe,
  CalendarRange,
  CalendarDays,
  Crown,
} from "lucide-react";

const GLOBAL_LEADERBOARD_VALUE = "global";

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

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || "?";
}

const CURRENT_USER_ROW =
  "bg-primary/15 ring-1 ring-inset ring-primary/30 font-semibold";

const PODIUM_CONFIG = {
  1: {
    crownClass: "text-amber-400 fill-amber-400",
    ringClass: "ring-amber-400/70",
    size: "h-[4.5rem] w-[4.5rem]",
    textClass: "text-amber-600",
    order: "order-2",
    pedestal: "h-14",
  },
  2: {
    crownClass: "text-slate-400 fill-slate-300",
    ringClass: "ring-slate-400/60",
    size: "h-16 w-16",
    textClass: "text-slate-600",
    order: "order-1",
    pedestal: "h-10",
  },
  3: {
    crownClass: "text-orange-600 fill-orange-500",
    ringClass: "ring-orange-500/60",
    size: "h-16 w-16",
    textClass: "text-orange-700",
    order: "order-3",
    pedestal: "h-8",
  },
} as const;

function PodiumEntry({ entry }: { entry: LeaderboardEntry }) {
  const config = PODIUM_CONFIG[entry.rank as 1 | 2 | 3];
  if (!config) return null;

  return (
    <div className={cn("flex flex-col items-center min-w-0 flex-1", config.order)}>
      <div className="relative mb-2 pt-4">
        <Crown
          className={cn("absolute top-0 right-0 h-5 w-5 drop-shadow-sm z-10", config.crownClass)}
          aria-hidden
        />
        <Avatar
          className={cn(
            config.size,
            "ring-[3px] shadow-lg",
            config.ringClass,
            entry.isCurrentUser && "ring-primary ring-offset-2 ring-offset-amber-50/80",
          )}
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
          className={cn(
            "absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white shadow",
            entry.rank === 1 ? "bg-amber-500" : entry.rank === 2 ? "bg-slate-500" : "bg-orange-600",
          )}
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
      <p className={cn("text-sm font-bold tabular-nums", config.textClass)}>
        {entry.points.toLocaleString()}
      </p>
      <div
        className={cn(
          "mt-2 w-full rounded-t-lg bg-gradient-to-t from-amber-200/50 to-amber-100/20",
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
    <table className="w-full text-sm">
      <thead>
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
              "rounded-md",
              entry.isCurrentUser ? CURRENT_USER_ROW : "hover:bg-muted/40",
            )}
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
  );
}

function CurrentUserRankBar({ entry }: { entry: LeaderboardEntry }) {
  return (
    <div
      className={cn(
        "shrink-0 flex items-center justify-between gap-2 px-3 py-2.5",
        "bg-primary/10 border-t border-primary/20 text-sm",
      )}
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
      params.set("limit", "15");
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
    <section
      className={cn(
        "flex flex-col h-full min-h-0 overflow-hidden rounded-2xl",
        "bg-gradient-to-b from-amber-50/90 via-background to-background",
        "shadow-[0_8px_30px_rgba(251,191,36,0.12)]",
        className,
      )}
    >
      <header className="shrink-0 px-4 pt-5 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-400/20">
            <Trophy className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground leading-none">
              Leaderboard
            </h2>
            <p className="text-xs text-muted-foreground mt-1">Top performers by points</p>
          </div>
        </div>
      </header>

      <div className="shrink-0 px-4 pb-3 space-y-2.5">
        <div className="flex rounded-full bg-muted/60 p-0.5">
          <Button
            type="button"
            variant={period === "month" ? "secondary" : "ghost"}
            size="sm"
            className="flex-1 h-8 gap-1.5 rounded-full"
            onClick={() => setPeriod("month")}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            This Month
          </Button>
          <Button
            type="button"
            variant={period === "all_time" ? "secondary" : "ghost"}
            size="sm"
            className="flex-1 h-8 gap-1.5 rounded-full"
            onClick={() => setPeriod("all_time")}
          >
            <CalendarRange className="h-3.5 w-3.5" />
            All Time
          </Button>
        </div>

        <Select value={selection} onValueChange={setSelection}>
          <SelectTrigger className="h-9 bg-background/70 border-amber-100/80">
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

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-2">
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
    </section>
  );
}
