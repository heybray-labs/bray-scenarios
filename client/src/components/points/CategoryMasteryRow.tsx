import {
  CategoryMasteryBar,
  categoryStarred,
} from "@/components/points/CategoryMasteryBar";
import { cn } from "@heybray/ui/utils";

type CategoryMasteryRowProps = {
  label: React.ReactNode;
  starCounts: { gold: number; silver: number; bronze: number };
  total: number;
  highlight?: boolean;
  barClassName?: string;
  countClassName?: string;
  className?: string;
};

export function CategoryMasteryRow({
  label,
  starCounts,
  total,
  highlight,
  barClassName,
  countClassName,
  className,
}: CategoryMasteryRowProps) {
  const starred = categoryStarred(starCounts);

  return (
    <div className={cn("flex items-center gap-3 text-sm py-0.5", className)}>
      {label}
      <CategoryMasteryBar
        starCounts={starCounts}
        total={total}
        highlight={highlight}
        className={barClassName}
      />
      <span
        className={cn(
          "w-10 text-right tabular-nums text-muted-foreground",
          countClassName,
        )}
      >
        {starred}/{total}
      </span>
    </div>
  );
}
