import { ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type RubricCriterion = {
  id?: number;
  name: string;
  description?: string | null;
  weight?: number | string | null;
};

type ScenarioRubricPreviewProps = {
  criteria: RubricCriterion[];
  className?: string;
};

export function ScenarioRubricPreview({ criteria, className }: ScenarioRubricPreviewProps) {
  if (!criteria.length) return null;

  return (
    <section className={cn("border-t border-border/50 pt-8", className)}>
      <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
        <ClipboardList className="h-4 w-4 text-muted-foreground shrink-0" />
        How you&apos;ll be assessed
      </h2>
      <ul className="space-y-4">
        {criteria.map((criterion) => {
          const weight = criterion.weight != null ? parseFloat(String(criterion.weight)) : 1;
          const showWeight = !Number.isNaN(weight) && weight !== 1;
          return (
            <li key={criterion.id ?? criterion.name} className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium">{criterion.name}</p>
                {showWeight && (
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-normal">
                    Weight {weight}
                  </Badge>
                )}
              </div>
              {criterion.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                  {criterion.description}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
