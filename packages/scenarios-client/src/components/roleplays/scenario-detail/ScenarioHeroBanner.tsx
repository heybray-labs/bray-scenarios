import { Button } from "@heybray/ui/components/button";
import { Switch } from "@heybray/ui/components/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@heybray/ui/components/dropdown-menu";
import { ScenarioMetadataChips } from "../../../components/roleplays/scenario-detail/ScenarioMetadataChips";
import { useAuthenticatedImage } from "@heybray/react/hooks/use-authenticated-image";
import { cn } from "@heybray/ui/utils";
import { Copy, MoreVertical, Pencil, Star, Trash2 } from "lucide-react";
import { Link } from "wouter";
import type { ScenarioClassifications } from "./types";

type AchievedTier = {
  tierName: string;
  starLevel: number;
  color: string;
};

type ScenarioHeroBannerProps = {
  title: string;
  description?: string | null;
  coverImageMediaId?: number | null;
  difficulty?: string | null;
  classifications?: ScenarioClassifications | null;
  achievedTier?: AchievedTier | null;
  roleplayId: number;
  canManage: boolean;
  isPublished: boolean;
  publishPending: boolean;
  duplicating: boolean;
  isFeatured?: boolean;
  featuredPending?: boolean;
  featuredDisabled?: boolean;
  onFeaturedChange?: (featured: boolean) => void;
  onPublishChange: (published: boolean) => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  className?: string;
};

export function ScenarioHeroBanner({
  title,
  description,
  coverImageMediaId,
  difficulty,
  classifications,
  achievedTier,
  roleplayId,
  canManage,
  isPublished,
  publishPending,
  duplicating,
  isFeatured = false,
  featuredPending = false,
  featuredDisabled = false,
  onFeaturedChange,
  onPublishChange,
  onEdit,
  onDuplicate,
  onDelete,
  className,
}: ScenarioHeroBannerProps) {
  const { src, isLoading } = useAuthenticatedImage(coverImageMediaId);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl min-h-[200px] lg:min-h-[260px] flex flex-col justify-end",
        !src && "bg-primary",
        className,
      )}
    >
      {src && (
        <>
          <img
            src={src}
            alt=""
            className={cn(
              "absolute inset-0 h-full w-full object-cover",
              isLoading && "opacity-0",
            )}
          />
          <div
            className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20"
            aria-hidden
          />
        </>
      )}
      {!src && (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/95 to-primary/75" aria-hidden />
      )}

      {canManage && (
        <div className="absolute top-3 right-3 z-10">
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
            <DropdownMenuContent align="end">
              <div className="px-2 py-1.5 flex items-center gap-2">
                <Switch
                  checked={isPublished}
                  onCheckedChange={onPublishChange}
                  disabled={publishPending}
                />
                <span className="text-sm">Published</span>
              </div>
              <div className="px-2 py-1.5 flex items-center gap-2">
                <Switch
                  checked={isFeatured}
                  onCheckedChange={(next) => onFeaturedChange?.(next)}
                  disabled={featuredPending || featuredDisabled || !onFeaturedChange}
                />
                <span className="text-sm flex items-center gap-1.5">
                  <Star className={cn("h-3.5 w-3.5", isFeatured && "fill-current text-[var(--featured-star)]")} />
                  Homepage hero
                </span>
              </div>
              {!isPublished && (
                <p className="px-2 pb-1 text-[11px] text-muted-foreground">
                  Publish this scenario to feature it on the homepage.
                </p>
              )}
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="h-4 w-4 mr-2" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem disabled={duplicating} onClick={onDuplicate}>
                <Copy className="h-4 w-4 mr-2" />
                {duplicating ? "Duplicating…" : "Duplicate"}
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onClick={onDelete}>
                <Trash2 className="h-4 w-4 mr-2" /> Delete
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="text-muted-foreground text-xs">
                <Link href={`/roleplays/${roleplayId}/attempts`}>View all attempts</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <div className="relative z-[1] p-6 w-full">
        <ScenarioMetadataChips
          difficulty={difficulty}
          classifications={classifications}
          variant="overlay"
          achievedTier={achievedTier}
          className="gap-2 mb-3"
        />
        <h1 className="text-2xl lg:text-3xl font-semibold text-white drop-shadow-md">{title}</h1>
        {description && (
          <p className="text-white/85 text-sm lg:text-base mt-1.5 max-w-3xl drop-shadow-sm">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
