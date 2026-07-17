import {
  AlertTriangle,
  Clock,
  Headphones,
  MessageSquare,
  PlayCircle,
} from "lucide-react";
import { Button } from "@heybray/ui/components/button";
import { Badge } from "@heybray/ui/components/badge";
import { AttemptPips } from "./AttemptPips";
import { getStartAttemptLabel } from "../../../lib/attempt-display";
import { NoticeBanner } from "@heybray/ui/components/NoticeBanner";
import { cn } from "@heybray/ui/utils";

type ScenarioLaunchBarProps = {
  maxTurns: number | null;
  autoEndOnMaxTurns?: boolean;
  timeLimitMinutes: number | null;
  liveCoaching: boolean;
  maxAttempts: number | null;
  attemptCount: number;
  isOutOfAttempts: boolean;
  canStart: boolean;
  startPending: boolean;
  notConfigured: boolean;
  configNotReady: boolean;
  onStartClick: () => void;
  className?: string;
};

function ModifierChip({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <Badge
      variant="secondary"
      className="gap-2 font-normal text-[0.9375rem] leading-none px-3 py-1 rounded-full"
    >
      <Icon className="h-[1.09375rem] w-[1.09375rem] shrink-0 text-muted-foreground" />
      {children}
    </Badge>
  );
}

export function ScenarioLaunchBar({
  maxTurns,
  autoEndOnMaxTurns,
  timeLimitMinutes,
  liveCoaching,
  maxAttempts,
  attemptCount,
  isOutOfAttempts,
  canStart,
  startPending,
  notConfigured,
  configNotReady,
  onStartClick,
  className,
}: ScenarioLaunchBarProps) {
  const hasUnlimited = !maxAttempts || maxAttempts <= 0;

  const ctaLabel = getStartAttemptLabel({
    isOutOfAttempts,
    hasUnlimited,
    attemptCount,
    maxAttempts,
    startPending,
  });

  return (
    <footer
      className={cn(
        "fixed bottom-0 inset-x-0 z-30 border-t bg-card",
        className,
      )}
    >
      {notConfigured && (
        <NoticeBanner variant="admin" layout="strip" className="border-b">
          <div className="max-w-6xl mx-auto px-4 lg:px-6 py-2 flex gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            {configNotReady
              ? "AI not configured. Ask an admin to set up API keys and model allowlists."
              : "This roleplay is missing AI models. An admin must edit it and select persona and grader models."}
          </div>
        </NoticeBanner>
      )}
      <div className="max-w-6xl mx-auto px-4 lg:px-6 py-2.5">
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2.5 min-w-0">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground shrink-0">
              Rules
            </span>
            {timeLimitMinutes != null && (
              <ModifierChip icon={Clock}>
                <strong className="font-semibold text-foreground">{timeLimitMinutes}</strong>{" "}
                {timeLimitMinutes === 1 ? "min" : "min"} limit
              </ModifierChip>
            )}
            {maxTurns != null && (
              <ModifierChip icon={MessageSquare}>
                <strong className="font-semibold text-foreground">{maxTurns}</strong> turns
                {autoEndOnMaxTurns && " · auto-submit"}
              </ModifierChip>
            )}
            <ModifierChip icon={Headphones}>
              Coaching <strong className="font-semibold text-foreground">{liveCoaching ? "on" : "off"}</strong>
            </ModifierChip>
          </div>

          <div className="flex items-center justify-between gap-4 lg:justify-end shrink-0">
            {hasUnlimited ? (
              <Badge variant="secondary" className="text-xs font-normal">
                Unlimited attempts
              </Badge>
            ) : maxAttempts ? (
              <AttemptPips maxAttempts={maxAttempts} usedCount={attemptCount} />
            ) : null}

            <Button
              size="lg"
              className="shrink-0"
              disabled={!canStart || startPending || isOutOfAttempts}
              onClick={onStartClick}
            >
              <PlayCircle className="h-4 w-4 mr-2" />
              {ctaLabel}
            </Button>
          </div>
        </div>
      </div>
    </footer>
  );
}
