import { PlayCircle, Copy, Download, Pencil, Trash2, MoreVertical, Star } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@heybray/ui/components/card";
import { Button } from "@heybray/ui/components/button";
import { Badge } from "@heybray/ui/components/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@heybray/ui/components/dropdown-menu";
import { ScenarioCover } from "@/components/roleplays/ScenarioCover";
import { CardRibbon } from "@/components/roleplays/CardRibbon";
import { ClassificationChip } from "@/components/classifications/ClassificationChip";
import { TierStars } from "@/components/points/TierStars";
import { cn } from "@heybray/ui/utils";
import {
  computePointsAvailable,
  computeStarLevel,
  pointsLineStyle,
} from "@/lib/reward-tier-utils";

export type ScenarioBrowseCardData = {
  id: number;
  title: string;
  description?: string | null;
  status: string;
  coverImageMediaId?: number | null;
  difficulty?: string | null;
  publishedAt?: string | null;
  classifications?: {
    category?: { label: string; color: string; icon: string } | null;
    audienceLevel?: { label: string; color: string; icon: string } | null;
    tags?: Array<{ slug: string; label: string; color: string; icon: string }>;
  };
  rewardTiers?: Array<{
    minScorePercent: number;
    rewardPoints?: number;
    starLevel?: number | null;
  }>;
  myBestAttempt?: {
    id: number;
    score?: string | null;
    isPassed?: boolean | null;
  } | null;
  myPointsEarned?: number;
  myInProgressAttempt?: {
    id: number;
    currentTurn: number;
    maxTurns: number | null;
  } | null;
};

type ScenarioBrowseCardProps = {
  roleplay: ScenarioBrowseCardData;
  layout?: "default" | "carousel";
  canManage?: boolean;
  selected?: boolean;
  duplicating?: boolean;
  exporting?: boolean;
  onToggleSelect?: () => void;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onExport?: () => void;
  onPublishToggle?: () => void;
  isFeatured?: boolean;
  featuredPending?: boolean;
  onFeaturedToggle?: () => void;
  onDelete?: () => void;
  onOpen?: () => void;
  onBestScoreClick?: () => void;
};

function isRecentlyPublished(publishedAt?: string | null): boolean {
  if (!publishedAt) return false;
  const published = new Date(publishedAt);
  if (Number.isNaN(published.getTime())) return false;
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  return published >= thirtyDaysAgo;
}

export function ScenarioBrowseCard({
  roleplay: rp,
  layout = "default",
  canManage,
  selected,
  duplicating,
  exporting,
  onToggleSelect,
  onEdit,
  onDuplicate,
  onExport,
  onPublishToggle,
  isFeatured = false,
  featuredPending = false,
  onFeaturedToggle,
  onDelete,
  onOpen,
  onBestScoreClick,
}: ScenarioBrowseCardProps) {
  const hasRewardTiers = (rp.rewardTiers?.length ?? 0) > 0;
  const bestScore = rp.myBestAttempt
    ? parseFloat(rp.myBestAttempt.score || "0")
    : null;
  const starLevel = computeStarLevel(bestScore, rp.rewardTiers);
  const pointsAvailable = computePointsAvailable(rp.rewardTiers);
  const pointsEarned = rp.myPointsEarned ?? 0;
  const inProgress = !!rp.myInProgressAttempt;
  const hasAttempts = !!rp.myBestAttempt || inProgress;
  const showNew =
    !hasAttempts &&
    isRecentlyPublished(rp.publishedAt) &&
    rp.status === "published";
  const pointsPct =
    pointsAvailable > 0 ? Math.min(100, (pointsEarned / pointsAvailable) * 100) : 0;
  const isCarousel = layout === "carousel";
  const tags = rp.classifications?.tags ?? [];

  return (
    <Card
      className={cn(
        "hover:shadow-md transition-shadow overflow-hidden flex flex-col",
        isCarousel && "h-full min-h-0 min-w-0 max-w-full w-full",
      )}
    >
      <div
        className={cn(
          "relative shrink-0 w-full max-w-full min-w-0 overflow-hidden",
          rp.status === "published" && onOpen && "cursor-pointer",
        )}
        onClick={() => {
          if (rp.status === "published") onOpen?.();
        }}
        onKeyDown={(e) => {
          if (rp.status === "published" && onOpen && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            onOpen();
          }
        }}
        role={rp.status === "published" && onOpen ? "button" : undefined}
        tabIndex={rp.status === "published" && onOpen ? 0 : undefined}
        aria-label={rp.status === "published" && onOpen ? `Open ${rp.title}` : undefined}
      >
        {canManage && (
          <div
            className="absolute top-2 left-2 z-20 flex items-center gap-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              className="h-4 w-4 rounded border border-border bg-background shadow-sm"
              checked={selected}
              onChange={onToggleSelect}
              aria-label={`Select ${rp.title}`}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-8 w-8 shrink-0 border border-border bg-background text-foreground shadow-sm hover:bg-muted"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil className="h-4 w-4 mr-2" /> Edit
                </DropdownMenuItem>
                <DropdownMenuItem disabled={duplicating} onClick={onDuplicate}>
                  <Copy className="h-4 w-4 mr-2" />
                  {duplicating ? "Duplicating…" : "Duplicate"}
                </DropdownMenuItem>
                <DropdownMenuItem disabled={exporting} onClick={onExport}>
                  <Download className="h-4 w-4 mr-2" /> Export
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onPublishToggle}>
                  {rp.status === "published" ? "Unpublish" : "Publish"}
                </DropdownMenuItem>
                {rp.status === "published" ? (
                  <DropdownMenuItem
                    disabled={featuredPending}
                    onClick={onFeaturedToggle}
                  >
                    <Star className={cn("h-4 w-4 mr-2", isFeatured && "fill-current text-[var(--featured-star)]")} />
                    {featuredPending
                      ? "Updating…"
                      : isFeatured
                        ? "Remove from homepage hero"
                        : "Feature on homepage hero"}
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem disabled>
                    <Star className="h-4 w-4 mr-2" />
                    Feature on homepage (publish first)
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem className="text-destructive" onClick={onDelete}>
                  <Trash2 className="h-4 w-4 mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {inProgress && <CardRibbon variant="progress">In progress</CardRibbon>}
        {showNew && <CardRibbon variant="new">New</CardRibbon>}

        <ScenarioCover
          mediaId={rp.coverImageMediaId}
          difficulty={rp.difficulty}
          category={rp.classifications?.category ?? null}
          audienceLevel={rp.classifications?.audienceLevel ?? null}
          fixedHeight={isCarousel}
        />

        {bestScore != null && (
          <button
            type="button"
            className={cn(
              "absolute bottom-2 left-2 z-10 rounded-full px-2 py-0.5 text-[10.5px] font-semibold shadow-sm",
              "bg-white/95 border",
              rp.myBestAttempt?.isPassed ? "text-success" : "text-warning",
            )}
            onClick={(e) => {
              e.stopPropagation();
              onBestScoreClick?.();
            }}
          >
            Best {Math.round(bestScore)}
          </button>
        )}

        {hasRewardTiers && (
          <div className="absolute top-2 right-2 z-10">
            <TierStars level={starLevel} size="sm" variant="clip" />
          </div>
        )}
      </div>

      <CardHeader
        className={cn(
          isCarousel ? "px-3 pt-2.5 pb-1 shrink-0 space-y-0" : "pb-2",
        )}
      >
        <div className="flex items-start justify-between gap-2 min-w-0">
          <CardTitle className="text-base truncate min-w-0">{rp.title}</CardTitle>
          {rp.status !== "published" && (
            <Badge variant="secondary" className="shrink-0">
              Draft
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent
        className={cn(
          "flex flex-col flex-1 min-h-0 min-w-0",
          isCarousel ? "px-3 pb-3 pt-0 overflow-hidden" : undefined,
        )}
      >
        <CardDescription className="line-clamp-2 min-h-[2.5rem] mb-3 shrink-0">
          {rp.description || "No description"}
        </CardDescription>

        <div className={cn("mb-3 shrink-0", isCarousel ? "min-h-[1.625rem]" : tags.length ? undefined : "hidden")}>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.slice(0, 2).map((tag) => (
                <ClassificationChip
                  key={tag.slug}
                  label={tag.label}
                  color={tag.color}
                  icon={tag.icon}
                />
              ))}
            </div>
          )}
        </div>

        {hasRewardTiers ? (
          <div className={cn("mb-3 shrink-0", isCarousel && "min-h-[1.25rem]")}>
            {inProgress ? (
              <p className="text-xs text-muted-foreground">Run in progress</p>
            ) : !hasAttempts ? (
              <p className="text-xs text-muted-foreground">
                0/{pointsAvailable} pts · not started
              </p>
            ) : (
              <div className="flex items-center gap-2 text-xs min-w-0" style={pointsLineStyle(starLevel)}>
                <span className="shrink-0 tabular-nums">
                  {pointsEarned}/{pointsAvailable} pts banked
                </span>
                <div className="flex-1 min-w-0 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${pointsPct}%`,
                      backgroundColor: pointsLineStyle(starLevel)?.color ?? undefined,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        ) : isCarousel ? (
          <div className="mb-3 shrink-0 min-h-[1.25rem]" aria-hidden />
        ) : null}

        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2 mt-auto shrink-0"
          disabled={rp.status !== "published"}
          onClick={onOpen}
        >
          <PlayCircle className="h-4 w-4" />
          {rp.status === "published" ? "Open" : "Draft"}
        </Button>
      </CardContent>
    </Card>
  );
}
