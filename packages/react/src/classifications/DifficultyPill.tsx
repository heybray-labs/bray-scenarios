import {
  classificationChipStyle,
  formatDifficulty,
  getDifficultyColor,
  overlayPillStyle,
} from "../lib/classification-display.ts";
import { cn } from "@heybray/ui/utils";

const variantClasses = {
  inline: "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium shadow-sm",
  overlay:
    "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium shadow-sm",
  hero: "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium shadow-sm text-white",
  cover: "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold shadow-sm",
} as const;

const styleFns = {
  inline: (color: string) => classificationChipStyle(color),
  overlay: (color: string) => overlayPillStyle(color),
  hero: (color: string) => overlayPillStyle(color),
  cover: (color: string) => overlayPillStyle(color),
} as const;

type DifficultyPillProps = {
  difficulty: string;
  variant?: keyof typeof variantClasses;
  className?: string;
};

export function DifficultyPill({
  difficulty,
  variant = "inline",
  className,
}: DifficultyPillProps) {
  const label = formatDifficulty(difficulty);
  if (!label) return null;

  const color = getDifficultyColor(difficulty);

  return (
    <span
      className={cn(variantClasses[variant], className)}
      style={styleFns[variant](color)}
    >
      {label}
    </span>
  );
}
