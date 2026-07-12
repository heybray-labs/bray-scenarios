import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { TierStars } from "@/components/points/TierStars";
import { HomeSidebarPanel } from "@/components/points/HomeSidebarPanel";
import { currentUserHighlightStyle, getRankColor } from "@/lib/classification-display";
import { initialsFromName } from "@/lib/user-display";
import { cn } from "@/lib/utils";
import { Star } from "lucide-react";

const RECENT_STARS_LIMIT = 15;

type RecentStarItem = {
  id: number;
  userId: number;
  userName: string;
  roleplayId: number;
  scenarioTitle: string;
  tierName: string;
  starLevel: number;
  tierColor: string | null;
  createdAt: string;
  isCurrentUser: boolean;
};

type RecentStarsPanelProps = {
  className?: string;
};

function formatRelativeTime(value: string) {
  const date = new Date(value);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
}

function RecentStarRow({ item, onSelect }: { item: RecentStarItem; onSelect: () => void }) {
  const starLevel = Math.min(3, Math.max(0, item.starLevel)) as 0 | 1 | 2 | 3;
  const isGold = starLevel === 3;
  const goldColor = getRankColor(1);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full flex items-center gap-2.5 rounded-lg border border-transparent px-2 py-2 text-left transition-colors",
        "hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        item.isCurrentUser && "border-l-[3px] pl-[calc(0.5rem-3px)]",
      )}
      style={item.isCurrentUser ? currentUserHighlightStyle() : undefined}
    >
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback
          className={cn(
            "text-xs font-semibold",
            item.isCurrentUser
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground",
          )}
        >
          {initialsFromName(item.userName)}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className="truncate text-sm font-medium leading-tight">{item.userName}</p>
          {item.isCurrentUser && (
            <Badge
              variant="outline"
              className="h-4 shrink-0 px-1 text-[10px] font-semibold"
              style={currentUserHighlightStyle()}
            >
              You
            </Badge>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">{item.scenarioTitle}</p>
      </div>

      <div className="shrink-0 flex flex-col items-end gap-0.5">
        <span
          className="inline-flex rounded-full p-0.5"
          style={
            isGold
              ? {
                  boxShadow: `0 0 6px color-mix(in srgb, ${goldColor} 35%, transparent)`,
                  outline: `1px solid color-mix(in srgb, ${goldColor} 40%, transparent)`,
                }
              : undefined
          }
        >
          <TierStars level={starLevel} size="sm" />
        </span>
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {formatRelativeTime(item.createdAt)}
        </span>
      </div>
    </button>
  );
}

export function RecentStarsPanel({ className }: RecentStarsPanelProps) {
  const [, navigate] = useLocation();

  const { data, isLoading } = useQuery<{ items: RecentStarItem[] }>({
    queryKey: ["/api/points/recent-stars", RECENT_STARS_LIMIT],
    queryFn: () =>
      apiRequest("GET", `/api/points/recent-stars?limit=${RECENT_STARS_LIMIT}`),
  });

  const items = data?.items ?? [];

  return (
    <HomeSidebarPanel
      icon={Star}
      iconClassName="fill-primary/20"
      title="Recent stars"
      subtitle="Latest tier upgrades across the team"
      className={cn("flex flex-col", className)}
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          No star achievements yet — be the first!
        </p>
      ) : (
        <div className="max-h-[22rem] overflow-y-auto -mx-1 px-1 space-y-0.5">
          {items.map((item) => (
            <RecentStarRow
              key={item.id}
              item={item}
              onSelect={() => navigate(`/roleplays/${item.roleplayId}`)}
            />
          ))}
        </div>
      )}
    </HomeSidebarPanel>
  );
}
