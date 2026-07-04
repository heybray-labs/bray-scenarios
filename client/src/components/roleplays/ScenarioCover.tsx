import { Drama } from "lucide-react";
import { useAuthenticatedImage } from "@/hooks/use-authenticated-image";
import { cn } from "@/lib/utils";

export type ScenarioCoverStatus = {
  score: number;
  isPassed: boolean | null;
};

type ScenarioCoverProps = {
  mediaId?: number | null;
  className?: string;
  /** Compact pass/score pill overlaid top-right (cards). */
  status?: ScenarioCoverStatus | null;
  /** Difficulty pill overlaid bottom-right (cards). */
  difficulty?: string | null;
  /** Click handler for the status pill (e.g. open best attempt). */
  onStatusClick?: () => void;
};

const pillBase =
  "absolute z-[1] rounded-full px-2.5 py-0.5 text-xs font-semibold shadow-sm backdrop-blur-sm";

function formatDifficulty(difficulty: string): string {
  const label = difficulty.trim();
  if (!label) return label;
  return label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();
}

function difficultyPillClass(difficulty: string): string {
  switch (difficulty.toLowerCase()) {
    case "easy":
      return "bg-emerald-600/90 text-white";
    case "hard":
      return "bg-orange-600/90 text-white";
    case "medium":
    default:
      return "bg-sky-600/90 text-white";
  }
}

export function ScenarioCover({
  mediaId,
  className,
  status,
  difficulty,
  onStatusClick,
}: ScenarioCoverProps) {
  const { src, isLoading } = useAuthenticatedImage(mediaId);

  const statusLabel =
    status != null
      ? `${status.isPassed === true ? "Passed" : status.isPassed === false ? "Not passed" : "Score"} · ${Math.round(status.score)}%`
      : null;

  const difficultyLabel = difficulty?.trim() ? formatDifficulty(difficulty) : null;

  return (
    <div
      className={cn(
        "relative aspect-video w-full overflow-hidden bg-muted",
        className,
      )}
    >
      {src ? (
        <img
          src={src}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
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
          className={cn(
            pillBase,
            "top-2 right-2",
            status?.isPassed === true
              ? "bg-emerald-600/95 text-white"
              : status?.isPassed === false
                ? "bg-rose-600/95 text-white"
                : "bg-slate-700/90 text-white",
            onStatusClick && "hover:opacity-90 cursor-pointer",
            !onStatusClick && "cursor-default",
          )}
        >
          {statusLabel}
        </button>
      )}

      {difficultyLabel && (
        <span
          className={cn(
            pillBase,
            "bottom-2 right-2",
            difficultyPillClass(difficultyLabel),
          )}
        >
          {difficultyLabel}
        </span>
      )}
    </div>
  );
}
