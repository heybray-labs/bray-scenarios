import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveRewardTierDisplay } from "@shared/schemas/points";

type TierStarsProps = {
  level: 0 | 1 | 2 | 3;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "clip";
  animateStamp?: boolean;
  className?: string;
};

const SIZE_CLASSES = {
  sm: "h-2.5 w-2.5",
  md: "h-3 w-3",
  lg: "h-[1.625rem] w-[1.625rem]",
} as const;

const STAMP_DELAYS = ["150ms", "420ms", "690ms"] as const;

export function TierStars({
  level,
  size = "md",
  variant = "default",
  animateStamp = false,
  className,
}: TierStarsProps) {
  const earnedDisplay =
    level > 0 ? resolveRewardTierDisplay({ starLevel: level }) : null;

  const stars = (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-hidden>
      {[1, 2, 3].map((slot) => {
        const filled = slot <= level;
        const fillColor = filled && earnedDisplay ? earnedDisplay.color : undefined;
        return (
          <Star
            key={slot}
            className={cn(
              SIZE_CLASSES[size],
              !filled && "fill-none",
              animateStamp && filled && "opacity-0 animate-star-stamp",
              animateStamp && !filled && "opacity-100",
            )}
            style={{
              ...(animateStamp && filled
                ? { animationDelay: STAMP_DELAYS[slot - 1] }
                : {}),
              ...(filled
                ? { fill: fillColor, color: fillColor }
                : {
                    fill: "none",
                    stroke: variant === "clip" ? "rgba(255,255,255,0.7)" : "currentColor",
                    strokeWidth: 1.6,
                    color: variant === "clip" ? undefined : "var(--muted-foreground)",
                  }),
            }}
          />
        );
      })}
    </span>
  );

  if (variant === "clip") {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full px-2 py-0.5",
          "bg-[rgba(20,14,26,0.55)]",
        )}
      >
        {stars}
      </span>
    );
  }

  return stars;
}
