import { resolveLucideIcon } from "@heybray/react/lib/classification-display";
import { cn } from "@heybray/ui/utils";

type ClassificationOptionLabelProps = {
  label: string;
  color: string;
  icon: string;
  compact?: boolean;
};

export function ClassificationOptionLabel({
  label,
  color,
  icon,
  compact = false,
}: ClassificationOptionLabelProps) {
  const Icon = resolveLucideIcon(icon);
  return (
    <span className={cn("flex items-center", compact ? "gap-1.5 text-xs" : "gap-2")}>
      <Icon
        className={cn("shrink-0", compact ? "h-3 w-3" : "h-4 w-4")}
        style={{ color }}
        aria-hidden
      />
      <span className="truncate">{label}</span>
    </span>
  );
}
