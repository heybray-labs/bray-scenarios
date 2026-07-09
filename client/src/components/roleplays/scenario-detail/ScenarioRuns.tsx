import { History, Lightbulb } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScenarioDetailCard } from "./ScenarioDetailCard";
import { overlayClassificationChipStyle } from "@/lib/classification-display";
import { cn } from "@/lib/utils";
import type { ScenarioRun } from "./scenario-progress-types";

const MUTED_CHIP_COLOR = "hsl(215, 13%, 44%)";
const SUCCESS_CHIP_COLOR = "hsl(151, 55%, 41%)";
const DESTRUCTIVE_CHIP_COLOR = "hsl(354, 82%, 56%)";

type ScenarioRunsProps = {
  attempts: ScenarioRun[];
  lastTopImprovement?: string | null;
  onAttemptClick: (attempt: ScenarioRun) => void;
  className?: string;
};

function ResultPill({
  status,
  isPassed,
}: {
  status: string;
  isPassed?: boolean | null;
}) {
  if (status === "in_progress") {
    return <Badge variant="secondary">In progress</Badge>;
  }
  if (status === "completed") {
    if (isPassed === true) {
      return (
        <span
          className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold shadow-sm"
          style={overlayClassificationChipStyle(SUCCESS_CHIP_COLOR)}
        >
          Passed
        </span>
      );
    }
    if (isPassed === false) {
      return (
        <span
          className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold shadow-sm"
          style={overlayClassificationChipStyle(DESTRUCTIVE_CHIP_COLOR)}
        >
          Failed
        </span>
      );
    }
    return <Badge variant="secondary">Completed</Badge>;
  }
  return (
    <Badge variant="outline" className="capitalize">
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

function computeDelta(
  attempt: ScenarioRun,
  previousCompleted: ScenarioRun | null,
): number | null {
  if (attempt.status !== "completed" || !previousCompleted?.score) return null;
  const score = parseFloat(attempt.score || "0");
  const prev = parseFloat(previousCompleted.score || "0");
  if (Number.isNaN(score) || Number.isNaN(prev)) return null;
  return Math.round(score - prev);
}

export function ScenarioRuns({
  attempts,
  lastTopImprovement,
  onAttemptClick,
  className,
}: ScenarioRunsProps) {
  const sorted = [...attempts].sort((a, b) => b.attemptNumber - a.attemptNumber);
  const completedAsc = [...attempts]
    .filter((a) => a.status === "completed")
    .sort((a, b) => a.attemptNumber - b.attemptNumber);

  const previousCompletedById = new Map<number, ScenarioRun | null>();
  for (const attempt of sorted) {
    const prev = completedAsc.filter((c) => c.attemptNumber < attempt.attemptNumber).pop() ?? null;
    previousCompletedById.set(attempt.id, prev);
  }

  return (
    <ScenarioDetailCard icon={<History />} title="Your runs" className={className}>
      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">No attempts yet — your runs will appear here.</p>
      ) : (
        <div className="space-y-2">
          {sorted.map((attempt) => {
            const prev = previousCompletedById.get(attempt.id) ?? null;
            const delta = computeDelta(attempt, prev);
            const clickable =
              attempt.status === "completed" || attempt.status === "in_progress";
            const score =
              attempt.status === "completed"
                ? Math.round(parseFloat(attempt.score || "0"))
                : null;

            return (
              <button
                key={attempt.id}
                type="button"
                disabled={!clickable}
                onClick={() => onAttemptClick(attempt)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg border bg-card text-left text-sm",
                  "hover:bg-muted/50 transition-colors",
                  !clickable && "opacity-60 cursor-default",
                )}
              >
                <span className="text-xs text-muted-foreground w-11 shrink-0">
                  Run {attempt.attemptNumber}
                </span>
                {score != null ? (
                  <span className="font-semibold tabular-nums">{score}</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
                {delta != null && delta !== 0 ? (
                  <span
                    className={cn(
                      "text-xs font-semibold",
                      delta > 0 ? "text-success" : "text-destructive",
                    )}
                  >
                    {delta > 0 ? `▲ +${delta}` : `▼ ${delta}`}
                  </span>
                ) : (
                  <span className="text-xs invisible" aria-hidden>
                    —
                  </span>
                )}
                <span className="ml-auto">
                  <ResultPill status={attempt.status} isPassed={attempt.isPassed} />
                </span>
              </button>
            );
          })}
        </div>
      )}

      {lastTopImprovement?.trim() && (
        <div
          className="mt-4 rounded-xl border px-3 py-2.5 text-sm leading-relaxed"
          style={overlayClassificationChipStyle(MUTED_CHIP_COLOR)}
        >
          <div className="flex gap-2 items-start">
            <Lightbulb className="h-4 w-4 shrink-0 mt-0.5" style={{ color: MUTED_CHIP_COLOR }} />
            <span>
              <strong>Highest-impact fix from last run:</strong> {lastTopImprovement.trim()}
            </span>
          </div>
        </div>
      )}
    </ScenarioDetailCard>
  );
}
