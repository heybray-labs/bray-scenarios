import {
  resolveLucideIcon,
  classificationChipStyle,
  overlayClassificationChipStyle,
  solidClassificationChipStyle,
} from "@/lib/classification-display";
import { cn } from "@heybray/ui/utils";

type ClassificationChipProps = {
  label: string;
  color: string;
  icon: string;
  className?: string;
  solid?: boolean;
  /** Opaque color-mix tint for pills on cover images. */
  overlay?: boolean;
};

export function ClassificationChip({
  label,
  color,
  icon,
  className,
  solid = false,
  overlay = false,
}: ClassificationChipProps) {
  const Icon = resolveLucideIcon(icon);
  const style = overlay
    ? overlayClassificationChipStyle(color)
    : solid
      ? solidClassificationChipStyle(color)
      : classificationChipStyle(color);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium shadow-sm",
        className,
      )}
      style={style}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
    </span>
  );
}
