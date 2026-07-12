import { Drama } from "lucide-react";
import { ClassificationChip } from "@heybray/react/classifications/ClassificationChip";
import { DifficultyPill } from "@heybray/react/classifications/DifficultyPill";
import { useAuthenticatedImage } from "@heybray/react/hooks/use-authenticated-image";
import { overlayPillStyle, formatDifficulty, getStatusPillColor } from "@heybray/react/lib/classification-display";
import { cn } from "@heybray/ui/utils";
import { CAROUSEL_COVER_HEIGHT_CLASS } from "@/components/roleplays/browse/carousel-card-layout";

export type ScenarioCoverStatus = {
  score: number;
  isPassed: boolean | null;
};

export type ScenarioCoverClassification = {
  label: string;
  color: string;
  icon: string;
};

type ScenarioCoverProps = {
  mediaId?: number | null;
  className?: string;
  /** Use a fixed height instead of aspect-ratio (carousel cards). */
  fixedHeight?: boolean;
  /** Compact pass/score pill overlaid top-right (cards). */
  status?: ScenarioCoverStatus | null;
  /** Difficulty pill overlaid bottom-right (cards). */
  difficulty?: string | null;
  /** Category pill overlaid bottom-right below difficulty. */
  category?: ScenarioCoverClassification | null;
  /** Audience level pill overlaid bottom-right beside category. */
  audienceLevel?: ScenarioCoverClassification | null;
  /** Click handler for the status pill (e.g. open best attempt). */
  onStatusClick?: () => void;
};

const pillBase =
  "rounded-full border px-2.5 py-0.5 text-xs font-semibold shadow-sm";

export function ScenarioCover({
  mediaId,
  className,
  fixedHeight = false,
  status,
  difficulty,
  category,
  audienceLevel,
  onStatusClick,
}: ScenarioCoverProps) {
  const { src, isLoading } = useAuthenticatedImage(mediaId);

  const statusLabel =
    status != null
      ? `${status.isPassed === true ? "Passed" : status.isPassed === false ? "Not passed" : "Score"} · ${Math.round(status.score)}%`
      : null;

  const difficultyLabel = difficulty?.trim() ? formatDifficulty(difficulty) : null;
  const showBottomRight = difficultyLabel || category || audienceLevel;

  return (
    <div
      className={cn(
        "relative w-full max-w-full shrink-0 overflow-hidden bg-muted",
        fixedHeight ? CAROUSEL_COVER_HEIGHT_CLASS : "aspect-video",
        className,
      )}
    >
      {src ? (
        <img
          src={src}
          alt=""
          className="absolute inset-0 h-full w-full max-h-full max-w-full object-cover object-center"
          draggable={false}
        />
      ) : (
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/15",
            isLoading && "animate-pulse",
          )}
        >
          <Drama className="h-10 w-10 text-muted-foreground/50" />
        </div>
      )}

      {statusLabel && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onStatusClick?.();
          }}
          style={overlayPillStyle(getStatusPillColor(status!))}
          className={cn(
            pillBase,
            "absolute top-2 right-2 z-[1]",
            onStatusClick && "hover:opacity-90 cursor-pointer",
            !onStatusClick && "cursor-default",
          )}
        >
          {statusLabel}
        </button>
      )}

      {showBottomRight && (
        <div className="absolute bottom-2 right-2 z-[1] flex max-w-[calc(100%-1rem)] flex-col items-end gap-1.5">
          {difficultyLabel && (
            <DifficultyPill difficulty={difficulty!} variant="cover" />
          )}
          {(category || audienceLevel) && (
            <div className="flex flex-wrap justify-end gap-1.5">
              {category && (
                <ClassificationChip
                  label={category.label}
                  color={category.color}
                  icon={category.icon}
                  overlay
                />
              )}
              {audienceLevel && (
                <ClassificationChip
                  label={audienceLevel.label}
                  color={audienceLevel.color}
                  icon={audienceLevel.icon}
                  overlay
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
