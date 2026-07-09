import { useLocation } from "wouter";
import type { LucideIcon } from "lucide-react";
import { useAuthenticatedImage } from "@/hooks/use-authenticated-image";
import { TierStars } from "@/components/points/TierStars";
import { cn } from "@/lib/utils";
import { resolveRewardTierDisplay } from "@shared/schemas/points";

export type ScenarioMiniCardItem = {
  roleplayId: number;
  title: string;
  coverImageMediaId?: number | null;
  status?: "in_progress" | "retry" | "new";
  bestScore?: number | null;
  starLevel?: number;
  hookLine?: React.ReactNode;
  hookClassName?: string;
  ribbon?: { label: string; variant: "new" | "progress" };
  maxPoints?: number | null;
  difficulty?: string | null;
  showStarClip?: boolean;
};

type ScenarioMiniCardProps = {
  item: ScenarioMiniCardItem;
  onClick?: () => void;
};

function MiniCover({ mediaId }: { mediaId?: number | null }) {
  const { src } = useAuthenticatedImage(mediaId);
  return (
    <div
      className="relative h-[4.875rem] bg-muted bg-cover bg-center"
      style={src ? { backgroundImage: `url(${src})` } : undefined}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-black/5" />
    </div>
  );
}

export function ScenarioMiniCard({ item, onClick }: ScenarioMiniCardProps) {
  const starLevel = (item.starLevel ?? 0) as 0 | 1 | 2 | 3;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-[0_0_15rem] shrink-0 text-left rounded-xl border bg-card overflow-hidden shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="relative">
        <MiniCover mediaId={item.coverImageMediaId} />
        {item.ribbon && (
          <span
            className={cn(
              "absolute top-2 left-0 text-[9.5px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-r text-white",
              item.ribbon.variant === "new" ? "bg-primary" : "bg-warning",
            )}
          >
            {item.ribbon.label}
          </span>
        )}
        {item.showStarClip !== false && (
          <div className="absolute top-2 right-2">
            <TierStars level={starLevel} size="sm" variant="clip" />
          </div>
        )}
      </div>
      <div className="px-3 py-2.5">
        <p className="text-sm font-semibold truncate">{item.title}</p>
        {item.hookLine && (
          <div className={cn("text-xs mt-1 flex items-center gap-1", item.hookClassName)}>
            {item.hookLine}
          </div>
        )}
      </div>
    </button>
  );
}

export function ScenarioMiniCardRow({
  title,
  hint,
  icon: Icon,
  children,
  empty,
}: {
  title: string;
  hint?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  empty?: boolean;
}) {
  if (empty) return null;
  return (
    <section>
      <div className="flex items-center gap-2 mb-2.5">
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />}
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h2>
        {hint && <span className="ml-auto text-xs text-muted-foreground">{hint}</span>}
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1">{children}</div>
    </section>
  );
}

export function useScenarioMiniNavigate() {
  const [, navigate] = useLocation();
  return (roleplayId: number) => navigate(`/roleplays/${roleplayId}`);
}

export function formatRetryHook(
  bestScore: number | null | undefined,
  starLevel: number,
  nextTier: { name: string; minScorePercent: number; starLevel?: number } | null,
) {
  if (bestScore == null || !nextTier) {
    return { text: "Retry for more stars", className: "text-muted-foreground" };
  }
  const delta = Math.max(0, nextTier.minScorePercent - bestScore);
  const display = resolveRewardTierDisplay({ starLevel: nextTier.starLevel ?? 3 });
  if (delta > 0) {
    return {
      text: `${Math.round(bestScore)} · ${Math.ceil(delta)} pts to ${nextTier.name}`,
      className: "font-semibold",
      style: { color: display.color },
    };
  }
  return {
    text: `${Math.round(bestScore)} · retry for 3 stars`,
    className: "text-muted-foreground",
    stars: starLevel as 0 | 1 | 2 | 3,
  };
}
