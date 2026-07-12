import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@heybray/ui/components/card";
import { Button } from "@heybray/ui/components/button";
import { Textarea } from "@heybray/ui/components/textarea";
import { Skeleton } from "@heybray/ui/components/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@heybray/ui/components/dialog";
import { Loader2, Send, Flag, Lightbulb, Drama, Clock, MessageSquare } from "lucide-react";
import logo from "@assets/logo.png";
import { AppBrandTitle } from "@/components/AppBrandTitle";
import { TranscriptThread } from "@/components/roleplays/transcript/TranscriptThread";
import { NoticeBanner } from "@heybray/ui/components/NoticeBanner";
import { useToast } from "@heybray/ui/hooks/use-toast";
import { useAuth } from "@heybray/react/hooks/use-auth";
import { initialsFromUser } from "@heybray/react/lib/user-display";
import { apiRequest, queryClient } from "@heybray/react/lib/queryClient";
import { useRoleplayStream } from "@/hooks/use-roleplay-stream";
import { MainLayout } from "@/components/MainLayout";
import { APPLICATION_DISPLAY_NAME } from "@/lib/app-config";
import { cn } from "@heybray/ui/utils";
import { isCheatModeMessage } from "@/lib/cheat-mode";

interface ChatMessage {
  id: number | string;
  role: string;
  content: string;
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function RoleplayTaking() {
  const params = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const { streamRun, stop } = useRoleplayStream();

  const roleplayId = params.id ? parseInt(params.id) : null;

  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [coachHint, setCoachHint] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirmEndOpen, setConfirmEndOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const initOnce = useRef(false);
  const timeExpiredOnce = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: roleplay } = useQuery<any>({
    queryKey: [`/api/roleplays/${roleplayId}`],
    enabled: !!roleplayId,
  });
  const { data: configStatus } = useQuery<{ isReady?: boolean; cheatModeEnabled?: boolean }>({
    queryKey: [`/api/roleplays/config-status`],
  });
  const cheatModeEnabled = !!configStatus?.cheatModeEnabled;
  const settings = roleplay?.settings ?? {};
  const persona = roleplay?.persona ?? {};

  const learnerTurns = messages.filter((m) => m.role === "learner").length;
  const maxTurns: number | null =
    typeof settings.maxTurns === "number" && settings.maxTurns > 0
      ? settings.maxTurns
      : null;
  const turnsRemaining = maxTurns != null ? Math.max(0, maxTurns - learnerTurns) : null;
  const reachedMaxTurns = maxTurns != null && learnerTurns >= maxTurns;
  const timeLimitMinutes: number | null =
    typeof settings.timeLimitMinutes === "number" && settings.timeLimitMinutes > 0
      ? settings.timeLimitMinutes
      : null;
  const showTimer = settings.showTimer !== false;
  const remainingMs =
    timeLimitMinutes != null && startedAt
      ? Math.max(0, startedAt.getTime() + timeLimitMinutes * 60_000 - now)
      : null;
  const timeExpired = remainingMs != null && remainingMs <= 0;
  const timeUrgent = remainingMs != null && remainingMs <= 60_000;
  const turnsUrgent = turnsRemaining != null && turnsRemaining <= 1;

  const userInitials = initialsFromUser(user);

  // Initialize: resume in-progress attempt or start a new one
  useEffect(() => {
    if (!roleplayId || initOnce.current) return;
    initOnce.current = true;
    (async () => {
      try {
        const existing: any[] = await apiRequest(
          "GET",
          `/api/roleplays/${roleplayId}/my-attempts`,
        );
        const inProgress = existing.find((a) => a.status === "in_progress");
        if (inProgress) {
          const data = await apiRequest(
            "GET",
            `/api/roleplays/${roleplayId}/attempts/${inProgress.id}`,
          );
          setAttemptId(inProgress.id);
          setStartedAt(new Date(inProgress.startedAt ?? data.attempt?.startedAt ?? Date.now()));
          setMessages(data.messages ?? []);
        } else {
          const data = await apiRequest(
            "POST",
            `/api/roleplays/${roleplayId}/attempts`,
          );
          setAttemptId(data.attempt.id);
          setStartedAt(new Date(data.attempt.startedAt ?? Date.now()));
          setMessages(data.messages ?? []);
        }
      } catch (err) {
        toast({
          title: "Could not start roleplay",
          description: err instanceof Error ? err.message : undefined,
          variant: "destructive",
        });
        navigate(`/roleplays/${roleplayId}`);
      } finally {
        setInitializing(false);
      }
    })();
  }, [roleplayId, navigate, toast]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isStreaming]);

  useEffect(() => () => stop(), [stop]);

  useEffect(() => {
    if (timeLimitMinutes == null || !startedAt || submitting) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [timeLimitMinutes, startedAt, submitting]);

  const submitAttempt = useCallback(async (endReason: string) => {
    if (!roleplayId || !attemptId || submitting) return;
    setSubmitting(true);
    try {
      await apiRequest(
        "POST",
        `/api/roleplays/${roleplayId}/attempts/${attemptId}/submit`,
        { endReason },
      );
      queryClient.invalidateQueries({
        queryKey: [`/api/roleplays/${roleplayId}/my-attempts`],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/roleplays"] });
      queryClient.invalidateQueries({ queryKey: ["/api/points/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/points/me/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/points/leaderboard"] });
      navigate(`/roleplays/${roleplayId}/results/${attemptId}`);
    } catch (err) {
      toast({
        title: "Could not submit",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
      setSubmitting(false);
    }
  }, [roleplayId, attemptId, submitting, navigate, toast]);

  useEffect(() => {
    if (remainingMs == null || remainingMs > 0 || submitting || timeExpiredOnce.current) return;
    timeExpiredOnce.current = true;
    toast({
      title: "Time's up",
      description: "Your time limit has been reached. Submitting for grading…",
    });
    void submitAttempt("time_limit");
  }, [remainingMs, submitting, submitAttempt, toast]);

  const sendTurn = async () => {
    const text = input.trim();
    if (!text || !roleplayId || !attemptId || isStreaming || timeExpired || reachedMaxTurns) return;

    const cheatMessage = cheatModeEnabled && isCheatModeMessage(text);
    setInput("");
    setCoachHint(null);
    setMessages((prev) => [...prev, { id: `local-${Date.now()}`, role: "learner", content: text }]);

    const personaMsgId = cheatMessage ? null : `streaming-${Date.now()}`;
    if (personaMsgId) {
      setMessages((prev) => [...prev, { id: personaMsgId, role: "persona", content: "" }]);
    }
    setIsStreaming(true);

    let shouldEnd = false;
    let endReason = "manual";

    try {
      const { runId } = await apiRequest(
        "POST",
        `/api/roleplays/${roleplayId}/attempts/${attemptId}/turn`,
        { message: text },
      );

      await streamRun(roleplayId, runId, (event) => {
        if (event.type === "token" && personaMsgId) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === personaMsgId ? { ...m, content: m.content + event.content } : m,
            ),
          );
        } else if (event.type === "coach") {
          setCoachHint(event.content);
        } else if (event.type === "ended") {
          shouldEnd = true;
          endReason = event.reason;
          if (personaMsgId) {
            setMessages((prev) => prev.filter((m) => m.id !== personaMsgId || m.content.trim()));
          }
          setMessages((prev) => [
            ...prev,
            {
              id: `ended-${Date.now()}`,
              role: "ended",
              content:
                event.reason === "cheat_mode"
                  ? "Cheat mode — submitting for grading…"
                  : "This roleplay scenario has ended.",
            },
          ]);
        } else if (event.type === "error") {
          toast({ title: "The persona could not respond", description: event.message, variant: "destructive" });
        }
      });
    } catch (err) {
      toast({
        title: "Failed to send",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setIsStreaming(false);
    }

    if (shouldEnd) {
      await submitAttempt(endReason);
    }
  };

  if (initializing) {
    return (
      <MainLayout>
        <div className="p-6 space-y-4 w-full max-w-3xl mx-auto">
          <Skeleton className="h-10 w-1/3" />
          <Skeleton className="h-64 w-full" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
    <div className="w-full max-w-3xl mx-auto py-4 flex flex-col px-4" style={{ height: "calc(100vh - 7rem)" }}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Drama className="h-5 w-5 text-primary shrink-0" />
          <div className="min-w-0">
            <h1 className="text-lg font-semibold leading-tight truncate">{roleplay?.title ?? "Roleplay"}</h1>
            {persona.name && (
              <p className="text-xs text-muted-foreground truncate">
                Talking to {persona.name}
                {persona.roleTitle ? ` · ${persona.roleTitle}` : ""}
              </p>
            )}
          </div>
        </div>
        {settings.allowManualEnd && (
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => setConfirmEndOpen(true)}
            disabled={submitting || isStreaming}
          >
            <Flag className="h-4 w-4 mr-1" />
            End & Submit
          </Button>
        )}
      </div>

      {(maxTurns != null || (timeLimitMinutes != null && showTimer)) && !submitting && (
        <div className="mb-3 flex flex-wrap gap-2">
          {timeLimitMinutes != null && showTimer && remainingMs != null && (
            <NoticeBanner
              variant={timeUrgent ? "urgent" : "timer"}
              layout="inline"
              className={cn("tabular-nums", timeUrgent && "[&_svg]:animate-pulse")}
              aria-live="polite"
              aria-label={`${formatCountdown(remainingMs)} remaining`}
            >
              <Clock className="h-4 w-4" />
              <span>{formatCountdown(remainingMs)}</span>
              <span className="font-medium opacity-80">remaining</span>
            </NoticeBanner>
          )}
          {maxTurns != null && turnsRemaining != null && (
            <NoticeBanner
              variant={turnsUrgent ? "urgent" : undefined}
              layout="inline"
              className={cn(
                !turnsUrgent &&
                  "border-primary/30 bg-primary/10 text-primary shadow-sm",
              )}
              aria-live="polite"
              aria-label={
                turnsRemaining === 0
                  ? "No turns remaining"
                  : `${turnsRemaining} ${turnsRemaining === 1 ? "turn" : "turns"} remaining`
              }
            >
              <MessageSquare className="h-4 w-4" />
              <span>
                {turnsRemaining === 0
                  ? "No turns left"
                  : `${turnsRemaining} ${turnsRemaining === 1 ? "turn" : "turns"} left`}
              </span>
              <span className="font-medium opacity-70">
                ({Math.min(learnerTurns, maxTurns)}/{maxTurns})
              </span>
            </NoticeBanner>
          )}
        </div>
      )}

      <Card className="flex-1 overflow-hidden flex flex-col">
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-3" ref={scrollRef as any}>
          <TranscriptThread
            messages={messages}
            learnerInitials={userInitials}
            className="space-y-3"
            emptyMessage={null}
            renderEmptyPersonaContent={() => (
              isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : null
            )}
          />
        </CardContent>
      </Card>

      {coachHint && !submitting && (
        <NoticeBanner variant="info" layout="compact" className="mt-2">
          <Lightbulb className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span><span className="font-medium">Coach:</span> {coachHint}</span>
        </NoticeBanner>
      )}

      {submitting ? (
        <div className="mt-3 flex items-center justify-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-4 text-primary shadow-sm">
          <Loader2 className="h-6 w-6 flex-shrink-0 animate-spin" />
          <div className="text-left">
            <p className="text-base font-semibold leading-tight">Grading your conversation</p>
            <p className="text-sm text-primary/70">Hang tight while we review your performance…</p>
          </div>
        </div>
      ) : timeExpired ? (
        <div className="mt-3 text-center text-sm text-muted-foreground">
          Time&apos;s up — submitting for grading…
        </div>
      ) : reachedMaxTurns && !settings.autoEndOnMaxTurns ? (
        <div className="mt-3 text-center">
          <p className="text-sm text-muted-foreground mb-2">You've reached the maximum number of turns.</p>
          <Button onClick={() => submitAttempt("max_turns")} disabled={submitting}>
            <Flag className="h-4 w-4 mr-1" /> Submit for grading
          </Button>
        </div>
      ) : (
        <div className="mt-3 flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendTurn();
              }
            }}
            placeholder={
              reachedMaxTurns
                ? "Submitting…"
                : cheatModeEnabled
                  ? "Type your reply… or CHEAT MODE: 81% Silver tier, passed"
                  : "Type your reply…"
            }
            rows={2}
            disabled={isStreaming || reachedMaxTurns || timeExpired}
            className="resize-none"
          />
          <Button
            onClick={sendTurn}
            disabled={isStreaming || !input.trim() || timeExpired}
            className="h-auto"
          >
            {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      )}
    </div>

      <Dialog
        open={confirmEndOpen}
        onOpenChange={(open) => {
          if (!submitting) setConfirmEndOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="items-center text-center sm:items-center sm:text-center">
            <div className="mx-auto mb-2 flex items-center gap-3">
              <img src={logo} alt="" className="h-10 w-10" />
              <AppBrandTitle appName={APPLICATION_DISPLAY_NAME} />
            </div>
            <DialogTitle className="flex items-center justify-center gap-2">
              <Flag className="h-5 w-5 text-primary" />
              End & submit?
            </DialogTitle>
            <DialogDescription>
              This will end the conversation and submit it for grading. You won&apos;t be able to
              send any more messages.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmEndOpen(false)}
              disabled={submitting}
            >
              Keep going
            </Button>
            <Button
              onClick={() => {
                setConfirmEndOpen(false);
                void submitAttempt("manual");
              }}
              disabled={submitting}
            >
              <Flag className="h-4 w-4 mr-1" />
              End & Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
