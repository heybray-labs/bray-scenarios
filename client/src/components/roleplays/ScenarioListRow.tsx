import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { useAuthenticatedImage } from "@heybray/react/hooks/use-authenticated-image";
import { TierStars } from "@/components/points/TierStars";
import { drawerPink } from "@/components/teams/drawer-pink-styles";
import { apiRequest } from "@heybray/react/lib/queryClient";
import { cn } from "@heybray/ui/utils";

export type ScenarioListRowItem = {
  roleplayId: number;
  title: string;
  coverImageMediaId?: number | null;
  starLevel?: number;
  bestScore?: number | null;
  lastAttemptAt?: string | null;
  attemptCount?: number;
};

type ScenarioAttempt = {
  id: number;
  attemptNumber: number;
  score: number | null;
  isPassed: boolean | null;
  status: string;
  completedAt: string | null;
  tierName: string | null;
  starLevel: 0 | 1 | 2 | 3;
};

function formatRelativeDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

function formatAttemptDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function ListCover({ mediaId }: { mediaId?: number | null }) {
  const { src } = useAuthenticatedImage(mediaId);
  return (
    <div
      className="h-12 w-16 shrink-0 rounded-md bg-muted bg-cover bg-center"
      style={src ? { backgroundImage: `url(${src})` } : undefined}
    />
  );
}

function StarPill({ level }: { level: 0 | 1 | 2 | 3 }) {
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 bg-[hsl(340,14%,94%)] shrink-0">
      <TierStars level={level} size="sm" variant="default" />
    </span>
  );
}

type ScenarioListRowProps = {
  item: ScenarioListRowItem;
  teamId: number | "all";
  memberUserId: number;
};

export function ScenarioListRow({ item, teamId, memberUserId }: ScenarioListRowProps) {
  const [, navigate] = useLocation();
  const [expanded, setExpanded] = useState(false);
  const starLevel = (item.starLevel ?? 0) as 0 | 1 | 2 | 3;
  const attempted = (item.attemptCount ?? 0) > 0;

  const { data, isLoading } = useQuery<{ attempts: ScenarioAttempt[] }>({
    queryKey: [
      `/api/teams/${teamId}/members/${memberUserId}/roleplays/${item.roleplayId}/attempts`,
    ],
    queryFn: () =>
      apiRequest(
        "GET",
        `/api/teams/${teamId}/members/${memberUserId}/roleplays/${item.roleplayId}/attempts`,
      ),
    enabled: expanded && attempted,
  });

  const attempts = data?.attempts ?? [];

  const metaParts: string[] = [];
  if (attempted && item.bestScore != null) {
    metaParts.push(`${Math.round(item.bestScore)}%`);
  }
  if (attempted && item.attemptCount != null) {
    metaParts.push(`${item.attemptCount} attempt${item.attemptCount === 1 ? "" : "s"}`);
  }
  if (attempted && item.lastAttemptAt) {
    metaParts.push(formatRelativeDate(item.lastAttemptAt));
  }

  return (
    <div
      className={cn(
        "rounded-lg border overflow-hidden",
        attempted
          ? cn("border", drawerPink.scenarioRow)
          : "bg-card border-border opacity-50",
      )}
    >
      <button
        type="button"
        disabled={!attempted}
        onClick={() => attempted && setExpanded((v) => !v)}
        className={cn(
          "flex w-full items-center gap-3 px-3 py-2.5 text-left",
          attempted && cn("transition-colors cursor-pointer", drawerPink.scenarioRowHover),
          !attempted && "cursor-default",
        )}
      >
        <ListCover mediaId={item.coverImageMediaId} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold truncate">{item.title}</p>
            {attempted && <StarPill level={starLevel} />}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {attempted ? metaParts.join(" · ") : "Not started"}
          </p>
        </div>
        {attempted && (
          <span className="shrink-0 text-muted-foreground">
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </span>
        )}
      </button>

      {expanded && attempted && (
        <div
          className={cn(
            "border-t border-[hsl(330,65%,90%)] px-2 py-2 space-y-0.5",
            drawerPink.attemptList,
          )}
        >
          {isLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2 px-1">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading attempts…
            </div>
          ) : attempts.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2 px-1">No completed attempts.</p>
          ) : (
            attempts.map((attempt) => (
              <button
                key={attempt.id}
                type="button"
                onClick={() =>
                  navigate(`/roleplays/${item.roleplayId}/results/${attempt.id}`)
                }
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors",
                  drawerPink.attemptRowHover,
                )}
              >
                <span className="w-[3.25rem] shrink-0 tabular-nums text-muted-foreground text-left">
                  {formatAttemptDate(attempt.completedAt)}
                </span>
                <span className="flex-1 min-w-0 font-medium text-left truncate">
                  Attempt #{attempt.attemptNumber}
                  {attempt.score != null && (
                    <span className="text-muted-foreground font-normal">
                      {" "}
                      · {Math.round(attempt.score)}%
                    </span>
                  )}
                </span>
                <StarPill level={attempt.starLevel} />
                <span className="shrink-0 w-12 text-right">
                  {attempt.isPassed ? (
                    <span className="text-success font-medium">Pass</span>
                  ) : (
                    <span className="text-muted-foreground">Fail</span>
                  )}
                </span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
