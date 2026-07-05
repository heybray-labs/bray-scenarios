import { AlertTriangle, PlayCircle, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ScenarioSessionRulesProps = {
  passThreshold: number;
  maxTurns: number | null;
  autoEndOnMaxTurns?: boolean;
  timeLimitMinutes: number | null;
  liveCoaching: boolean;
  maxAttempts: number | null;
  notConfigured: boolean;
  configNotReady: boolean;
  canStart: boolean;
  startPending: boolean;
  onStart: () => void;
  className?: string;
};

export function ScenarioSessionRules({
  passThreshold,
  maxTurns,
  autoEndOnMaxTurns,
  timeLimitMinutes,
  liveCoaching,
  maxAttempts,
  notConfigured,
  configNotReady,
  canStart,
  startPending,
  onStart,
  className,
}: ScenarioSessionRulesProps) {
  const maxAttemptsLabel =
    maxAttempts && maxAttempts > 0 ? String(maxAttempts) : "Unlimited";

  return (
    <div className={cn("rounded-xl border bg-muted/20 p-4 space-y-3", className)}>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
        <ListChecks className="h-3.5 w-3.5" />
        Before you start
      </h3>
      <ul className="space-y-1.5 text-sm text-muted-foreground">
        <li className="flex justify-between gap-2">
          <span>Pass threshold</span>
          <span className="font-medium text-foreground tabular-nums">{passThreshold}%</span>
        </li>
        {maxTurns != null && (
          <li className="flex justify-between gap-2">
            <span>Max turns</span>
            <span className="font-medium text-foreground tabular-nums">
              {maxTurns}
              {autoEndOnMaxTurns ? " (auto-submit)" : ""}
            </span>
          </li>
        )}
        {timeLimitMinutes != null && (
          <li className="flex justify-between gap-2">
            <span>Time limit</span>
            <span className="font-medium text-foreground tabular-nums">
              {timeLimitMinutes} {timeLimitMinutes === 1 ? "minute" : "minutes"}
            </span>
          </li>
        )}
        <li className="flex justify-between gap-2">
          <span>Coaching</span>
          <span className="font-medium text-foreground">{liveCoaching ? "On" : "Off"}</span>
        </li>
        <li className="flex justify-between gap-2">
          <span>Max attempts</span>
          <span className="font-medium text-foreground">{maxAttemptsLabel}</span>
        </li>
      </ul>
      {notConfigured && (
        <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {configNotReady
            ? "AI not configured. Ask an admin to set up API keys and model allowlists."
            : "This roleplay is missing AI models. An admin must edit it and select persona and grader models."}
        </div>
      )}
      <Button
        className="w-full"
        size="lg"
        onClick={onStart}
        disabled={!canStart || startPending}
      >
        <PlayCircle className="mr-2 h-4 w-4" />
        {startPending ? "Starting…" : "Start Roleplay"}
      </Button>
    </div>
  );
}
