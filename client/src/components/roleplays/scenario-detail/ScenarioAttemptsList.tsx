import { History } from "lucide-react";
import { cn } from "@/lib/utils";

export type ScenarioAttempt = {
  id: number;
  attemptNumber: number;
  status: string;
  score?: string | null;
};

type ScenarioAttemptsListProps = {
  attempts: ScenarioAttempt[];
  onAttemptClick: (attempt: ScenarioAttempt) => void;
  className?: string;
};

export function ScenarioAttemptsList({
  attempts,
  onAttemptClick,
  className,
}: ScenarioAttemptsListProps) {
  return (
    <div className={cn("rounded-xl border bg-muted/20 p-4 space-y-2", className)}>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
        <History className="h-3.5 w-3.5" />
        Your attempts
      </h3>
      {attempts.length === 0 ? (
        <p className="text-sm text-muted-foreground py-1">No attempts yet.</p>
      ) : (
        <div className="space-y-0.5">
          {attempts.map((attempt) => (
            <button
              key={attempt.id}
              type="button"
              onClick={() => onAttemptClick(attempt)}
              disabled={attempt.status !== "completed" && attempt.status !== "in_progress"}
              className="w-full text-left px-2 py-1.5 rounded-md text-sm hover:bg-muted/60 disabled:pointer-events-none disabled:opacity-60"
            >
              Attempt {attempt.attemptNumber}
              {attempt.status === "completed" ? (
                <> — {Math.round(parseFloat(attempt.score || "0"))}%</>
              ) : attempt.status === "in_progress" ? (
                <span className="text-muted-foreground"> — In progress</span>
              ) : (
                <span className="text-muted-foreground"> — {attempt.status}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
