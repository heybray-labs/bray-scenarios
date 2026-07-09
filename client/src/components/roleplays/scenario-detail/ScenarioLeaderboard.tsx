import { Link } from "wouter";
import { Trophy } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScenarioDetailCard } from "./ScenarioDetailCard";
import { cn } from "@/lib/utils";
import { overlayClassificationChipStyle } from "@/lib/classification-display";
import type { ScenarioLeaderboardData } from "./scenario-progress-types";

const YOU_ROW_COLOR = "hsl(330, 65%, 55%)";

type ScenarioLeaderboardProps = {
  roleplayId: number;
  data?: ScenarioLeaderboardData | null;
  isLoading?: boolean;
  canManage?: boolean;
  className?: string;
};

const RANK_COLORS: Record<number, string> = {
  1: "text-amber-500",
  2: "text-slate-400",
  3: "text-orange-600",
};

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || "?";
}

function LeaderboardRow({
  entry,
  highlight,
}: {
  entry: { rank: number; name: string; bestScore: number };
  highlight?: boolean;
}) {
  const displayName = highlight ? "You" : entry.name;

  return (
    <div
      className={cn("flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm", highlight && "border")}
      style={highlight ? overlayClassificationChipStyle(YOU_ROW_COLOR) : undefined}
    >
      <span
        className={cn(
          "w-6 text-center font-bold tabular-nums text-xs shrink-0",
          highlight
            ? "text-primary"
            : RANK_COLORS[entry.rank] ?? "text-muted-foreground",
        )}
      >
        {entry.rank}
      </span>
      <Avatar className="h-7 w-7 shrink-0">
        <AvatarFallback
          className={cn(
            "text-xs font-semibold",
            highlight
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground",
          )}
        >
          {initialsFromName(displayName)}
        </AvatarFallback>
      </Avatar>
      <span className={cn("flex-1 truncate", highlight && "font-medium text-foreground")}>
        {displayName}
      </span>
      <span
        className={cn(
          "font-semibold tabular-nums shrink-0",
          highlight ? "text-primary" : undefined,
        )}
      >
        {Math.round(entry.bestScore)}%
      </span>
    </div>
  );
}

export function ScenarioLeaderboard({
  roleplayId,
  data,
  isLoading,
  canManage,
  className,
}: ScenarioLeaderboardProps) {
  if (isLoading) {
    return (
      <ScenarioDetailCard icon={<Trophy />} title="Scenario leaderboard" className={className}>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </ScenarioDetailCard>
    );
  }

  const entries = data?.entries ?? [];
  const currentUser = data?.currentUser ?? null;
  const userInTop = currentUser != null && entries.some((e) => e.userId === currentUser.userId);
  const showGap = currentUser != null && !userInTop;
  const showUnranked = !currentUser;

  return (
    <ScenarioDetailCard icon={<Trophy />} title="Scenario leaderboard" className={className}>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No scores yet — be the first to complete a run.</p>
      ) : (
        <div className="space-y-1">
          {entries.map((entry) => (
            <LeaderboardRow
              key={entry.userId}
              entry={entry}
              highlight={currentUser?.userId === entry.userId}
            />
          ))}

          {showGap && (
            <>
              <p className="text-center text-muted-foreground text-xs py-1 tracking-widest">· · ·</p>
              <LeaderboardRow entry={currentUser} highlight />
            </>
          )}

          {showUnranked && (
            <p className="text-xs text-muted-foreground pt-2 border-t border-border/50 mt-2">
              Complete a run to get ranked.
            </p>
          )}
        </div>
      )}

      {canManage && (
        <Link
          href={`/roleplays/${roleplayId}/attempts`}
          className="block text-xs text-muted-foreground hover:text-foreground mt-3 pt-2 border-t border-border/50"
        >
          View all attempts
        </Link>
      )}
    </ScenarioDetailCard>
  );
}
