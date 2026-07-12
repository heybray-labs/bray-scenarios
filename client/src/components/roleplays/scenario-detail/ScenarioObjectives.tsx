import { Target } from "lucide-react";
import { Progress } from "@heybray/ui/components/progress";
import { ScenarioDetailCard } from "./ScenarioDetailCard";
import { overlayClassificationChipStyle } from "@/lib/classification-display";
import { cn } from "@heybray/ui/utils";
import type { CriterionBest } from "./scenario-progress-types";

const WARNING_CHIP_COLOR = "hsl(35, 100%, 58%)";

export type RubricCriterion = {
  id?: number;
  name: string;
  description?: string | null;
  weight?: number | string | null;
};

type ScenarioObjectivesProps = {
  criteria: RubricCriterion[];
  criterionBests?: CriterionBest[];
  hasCompletedAttempt: boolean;
  className?: string;
};

function CriterionBar({
  value,
  isWeakest,
}: {
  value: number | null;
  isWeakest: boolean;
}) {
  const pct = value != null ? Math.min(100, Math.max(0, value)) : 0;
  return (
    <div className="flex items-center gap-2 shrink-0">
      <Progress
        value={pct}
        className={cn("h-1.5 w-16 bg-muted", isWeakest && "[&>div]:bg-warning")}
      />
      <span className="text-xs font-semibold tabular-nums w-8 text-right">
        {value != null ? Math.round(value) : "—"}
      </span>
    </div>
  );
}

export function ScenarioObjectives({
  criteria,
  criterionBests = [],
  hasCompletedAttempt,
  className,
}: ScenarioObjectivesProps) {
  if (!criteria.length) return null;

  const bestByCriterionId = new Map(criterionBests.map((b) => [b.criterionId, b.bestScore]));

  const scoresWithIds = criteria
    .filter((c) => c.id != null && hasCompletedAttempt)
    .map((c) => ({
      criterionId: c.id!,
      bestScore: bestByCriterionId.get(c.id!) ?? null,
    }))
    .filter((s): s is { criterionId: number; bestScore: number } => s.bestScore != null);

  let weakestId: number | null = null;
  if (scoresWithIds.length >= 2) {
    const minScore = Math.min(...scoresWithIds.map((s) => s.bestScore));
    const atMin = scoresWithIds.filter((s) => s.bestScore === minScore);
    if (atMin.length === 1) weakestId = atMin[0].criterionId;
  }

  return (
    <ScenarioDetailCard
      icon={<Target />}
      title="Objectives — Your best per criterion"
      className={className}
    >
      <ul className="space-y-4">
        {criteria.map((criterion) => {
          const bestScore =
            criterion.id != null ? (bestByCriterionId.get(criterion.id) ?? null) : null;
          const isWeakest =
            hasCompletedAttempt && weakestId != null && criterion.id === weakestId;

          return (
            <li key={criterion.id ?? criterion.name} className="flex gap-3 items-start">
              <span className="mt-1.5 shrink-0 w-4 flex justify-center">
                <span className="h-2 w-2 rounded-full border-2 border-muted-foreground/40" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">{criterion.name}</p>
                      {isWeakest && (
                        <span
                          className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium shadow-sm"
                          style={overlayClassificationChipStyle(WARNING_CHIP_COLOR)}
                        >
                          Weakest front
                        </span>
                      )}
                    </div>
                    {criterion.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                        {criterion.description}
                      </p>
                    )}
                  </div>
                  <CriterionBar value={bestScore} isWeakest={!!isWeakest} />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground mt-4 pt-3 border-t border-border/50">
        Bars show your best score per criterion across attempts
      </p>
    </ScenarioDetailCard>
  );
}
