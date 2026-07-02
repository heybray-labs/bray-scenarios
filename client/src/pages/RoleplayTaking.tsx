import { useEffect, useRef, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { FaUser } from "react-icons/fa";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, Send, Flag, Lightbulb, Drama } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useRoleplayStream } from "@/hooks/use-roleplay-stream";
import { MainLayout } from "@/components/MainLayout";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: number | string;
  role: string;
  content: string;
}

export default function RoleplayTaking() {
  const params = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const { streamRun, stop } = useRoleplayStream();

  const roleplayId = params.id ? parseInt(params.id) : null;

  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [coachHint, setCoachHint] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const initOnce = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: roleplay } = useQuery<any>({
    queryKey: [`/api/roleplays/${roleplayId}`],
    enabled: !!roleplayId,
  });
  const settings = roleplay?.settings ?? {};
  const persona = roleplay?.persona ?? {};

  const learnerTurns = messages.filter((m) => m.role === "learner").length;
  const maxTurns: number | null = settings.maxTurns ?? null;
  const reachedMaxTurns = maxTurns != null && learnerTurns >= maxTurns;

  const userInitials =
    [user?.profile?.firstName?.[0], user?.profile?.lastName?.[0]]
      .filter(Boolean)
      .join("")
      .toUpperCase() ||
    user?.email?.[0]?.toUpperCase() ||
    "?";

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
          setMessages(data.messages ?? []);
        } else {
          const data = await apiRequest(
            "POST",
            `/api/roleplays/${roleplayId}/attempts`,
          );
          setAttemptId(data.attempt.id);
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

  const submitAttempt = async (endReason: string) => {
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
      navigate(`/roleplays/${roleplayId}/results/${attemptId}`);
    } catch (err) {
      toast({
        title: "Could not submit",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
      setSubmitting(false);
    }
  };

  const sendTurn = async () => {
    const text = input.trim();
    if (!text || !roleplayId || !attemptId || isStreaming) return;

    setInput("");
    setCoachHint(null);
    setMessages((prev) => [...prev, { id: `local-${Date.now()}`, role: "learner", content: text }]);

    const personaMsgId = `streaming-${Date.now()}`;
    setMessages((prev) => [...prev, { id: personaMsgId, role: "persona", content: "" }]);
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
        if (event.type === "token") {
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
          setMessages((prev) => [
            ...prev,
            {
              id: `ended-${Date.now()}`,
              role: "ended",
              content: "This roleplay scenario has ended.",
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
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Drama className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-lg font-semibold leading-tight">{roleplay?.title ?? "Roleplay"}</h1>
            {persona.name && (
              <p className="text-xs text-muted-foreground">
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
            onClick={() => submitAttempt("manual")}
            disabled={submitting || isStreaming}
          >
            <Flag className="h-4 w-4 mr-1" />
            End & Submit
          </Button>
        )}
      </div>

      <Card className="flex-1 overflow-hidden flex flex-col">
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-3" ref={scrollRef as any}>
          {messages.map((m) => {
            if (m.role === "ended") {
              return (
                <div key={m.id} className="flex items-center gap-3 py-2">
                  <div className="h-px flex-1 bg-border" />
                  <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Flag className="h-3.5 w-3.5" />
                    {m.content}
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>
              );
            }
            if (m.role !== "persona" && m.role !== "learner") return null;
            const isLearner = m.role === "learner";
            return (
              <div
                key={m.id}
                className={cn("flex items-end gap-2", isLearner ? "justify-end" : "justify-start")}
              >
                {!isLearner && (
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="bg-muted text-muted-foreground">
                      <FaUser className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                )}
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap",
                    isLearner
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted rounded-bl-sm",
                  )}
                >
                  {m.content || (isStreaming && !isLearner ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : "")}
                </div>
                {isLearner && (
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {coachHint && !submitting && (
        <div className="mt-2 flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-2 text-sm text-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
          <Lightbulb className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span><span className="font-medium">Coach:</span> {coachHint}</span>
        </div>
      )}

      {submitting ? (
        <div className="mt-3 flex items-center justify-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-4 text-primary shadow-sm">
          <Loader2 className="h-6 w-6 flex-shrink-0 animate-spin" />
          <div className="text-left">
            <p className="text-base font-semibold leading-tight">Grading your conversation</p>
            <p className="text-sm text-primary/70">Hang tight while we review your performance…</p>
          </div>
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
            placeholder={reachedMaxTurns ? "Submitting…" : "Type your reply…"}
            rows={2}
            disabled={isStreaming || reachedMaxTurns}
            className="resize-none"
          />
          <Button onClick={sendTurn} disabled={isStreaming || !input.trim()} className="h-auto">
            {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      )}
      {maxTurns != null && !submitting && (
        <p className="text-xs text-muted-foreground mt-1 text-center">
          Turn {Math.min(learnerTurns, maxTurns)} of {maxTurns}
        </p>
      )}
    </div>
    </MainLayout>
  );
}
