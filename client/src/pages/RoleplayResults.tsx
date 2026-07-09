import type { ComponentType, ReactNode } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { FaUser } from "react-icons/fa";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MainLayout } from "@/components/MainLayout";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2,
  XCircle,
  ThumbsUp,
  ArrowUpCircle,
  ArrowLeft,
  Target,
  User,
  Route,
  MessageSquare,
  Flag,
  ClipboardList,
  Star,
} from "lucide-react";
import { ClockFading } from "@/components/icons/roleplay-field-icons";
import { ScenarioCover } from "@/components/roleplays/ScenarioCover";
import { TierStars } from "@/components/points/TierStars";
import { starLevelFromTierName } from "@shared/schemas/points";

const STAGES = [
  {
    id: "challenge",
    step: 1,
    label: "The challenge",
    shortLabel: "Challenge",
    description: "What you were asked to do",
    icon: Target,
  },
  {
    id: "conversation",
    step: 2,
    label: "The conversation",
    shortLabel: "Conversation",
    description: "What happened in the session",
    icon: MessageSquare,
  },
  {
    id: "assessment",
    step: 3,
    label: "Your assessment",
    shortLabel: "Assessment",
    description: "How you performed",
    icon: ClipboardList,
  },
] as const;

function StagePanel({
  step,
  label,
  description,
  icon: Icon,
  children,
  className,
}: {
  step: number;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "flex flex-col min-h-0 rounded-xl border bg-card shadow-sm overflow-hidden",
        className,
      )}
    >
      <header className="shrink-0 border-b bg-muted/40 px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
            {step}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
              <h2 className="text-sm font-semibold tracking-tight">{label}</h2>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </div>
        </div>
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto p-4">{children}</div>
    </section>
  );
}

function FieldBlock({
  icon: Icon,
  label,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
        {children}
      </div>
    </div>
  );
}

export default function RoleplayResults() {
  const params = useParams();
  const { hasPermission, user } = useAuth();
  const { toast } = useToast();
  const canManage = hasPermission("roleplay:manage");
  const roleplayId = params.id ? parseInt(params.id) : null;
  const attemptId = params.attemptId ? parseInt(params.attemptId) : null;

  const { data: roleplay } = useQuery<any>({
    queryKey: [`/api/roleplays/${roleplayId}`],
    enabled: !!roleplayId,
  });

  const { data, isLoading } = useQuery<any>({
    queryKey: [`/api/roleplays/${roleplayId}/attempts/${attemptId}/results`],
    enabled: !!roleplayId && !!attemptId,
  });

  const overrideMutation = useMutation({
    mutationFn: ({ scoreId, score }: { scoreId: number; score: number }) =>
      apiRequest("POST", `/api/roleplays/${roleplayId}/criterion-scores/${scoreId}/override`, { score }),
    onSuccess: () => {
      toast({ title: "Score updated" });
      queryClient.invalidateQueries({
        queryKey: [`/api/roleplays/${roleplayId}/attempts/${attemptId}/results`],
      });
    },
  });

  if (isLoading || !data) {
    return (
      <MainLayout>
        <div className="p-6 space-y-4 w-full max-w-7xl mx-auto">
          <Skeleton className="h-10 w-1/3" />
          <Skeleton className="h-8 w-1/2" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </MainLayout>
    );
  }

  const attempt = data.attempt;
  const criterionScores: any[] = data.criterionScores ?? [];
  const messages: any[] = data.messages ?? [];
  const settings = roleplay?.settings ?? {};
  const persona = roleplay?.persona ?? {};
  const displayMode = settings.postSessionDisplayMode ?? "full_breakdown";
  const showTranscript = settings.showTranscript !== false;

  const score = attempt.score != null ? Math.round(parseFloat(attempt.score)) : null;
  const passed = attempt.isPassed;
  const gradingFailed = attempt.gradingStatus === "failed";
  const pointsAwarded = Number(data.pointsAwarded ?? 0);
  const tierName = data.tierName as string | null | undefined;

  const userInitials =
    [user?.profile?.firstName?.[0], user?.profile?.lastName?.[0]]
      .filter(Boolean)
      .join("")
      .toUpperCase() ||
    user?.email?.[0]?.toUpperCase() ||
    "?";

  const transcriptMessages = messages.filter(
    (m) => m.role === "persona" || m.role === "learner" || m.role === "ended",
  );

  const hasChallengeContent =
    roleplay?.situationContext ||
    roleplay?.introduction ||
    roleplay?.learnerObjective ||
    persona.name ||
    persona.roleTitle;

  const challengeContent = (
    <div className="space-y-5">
      {roleplay?.coverImageMediaId && (
        <div className="overflow-hidden rounded-lg border">
          <ScenarioCover mediaId={roleplay.coverImageMediaId} />
        </div>
      )}
      {roleplay?.situationContext && (
        <FieldBlock icon={Route} label="Context">
          {roleplay.situationContext}
        </FieldBlock>
      )}
      {roleplay?.introduction && (
        <FieldBlock icon={ClockFading} label="Current situation">
          {roleplay.introduction}
        </FieldBlock>
      )}
      {roleplay?.learnerObjective && (
        <FieldBlock icon={Target} label="Your objective">
          {roleplay.learnerObjective}
        </FieldBlock>
      )}
      {(persona.name || persona.roleTitle) && (
        <FieldBlock icon={User} label="Who you met">
          {persona.name && <p className="font-medium">{persona.name}</p>}
          {persona.roleTitle && (
            <p className={persona.name ? "text-muted-foreground" : undefined}>{persona.roleTitle}</p>
          )}
        </FieldBlock>
      )}
      {!hasChallengeContent && !roleplay?.coverImageMediaId && (
        <p className="text-sm text-muted-foreground">
          No scenario overview is available for this roleplay.
        </p>
      )}
    </div>
  );

  const conversationContent = showTranscript ? (
    transcriptMessages.length === 0 ? (
      <p className="text-sm text-muted-foreground py-8 text-center">
        No messages in this attempt.
      </p>
    ) : (
      <div className="space-y-3">
        {transcriptMessages.map((m) => {
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
          const isLearner = m.role === "learner";
          return (
            <div
              key={m.id}
              className={cn(
                "flex items-end gap-2",
                isLearner ? "justify-end" : "justify-start",
              )}
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
                {m.content}
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
      </div>
    )
  ) : (
    <p className="text-sm text-muted-foreground text-center py-8">
      Transcript is not available for this roleplay.
    </p>
  );

  const assessmentContent = (
    <div className="space-y-5">
      <div>
        {gradingFailed ? (
          <p className="text-sm text-muted-foreground">
            {attempt.overallFeedback || "Grading could not be completed for this attempt."}
          </p>
        ) : (
          <div className="flex items-center gap-5">
            <div className="text-center shrink-0">
              <div className="text-4xl font-bold tabular-nums">{score ?? "—"}%</div>
              {passed != null && (
                <Badge
                  variant={passed ? "default" : "destructive"}
                  className="mt-2"
                >
                  {passed ? (
                    <>
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Passed
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3 w-3 mr-1" /> Not passed
                    </>
                  )}
                </Badge>
              )}
            </div>
            <div className="flex-1 space-y-2 min-w-0">
              {score != null && <Progress value={score} className="h-2" />}
            </div>
          </div>
        )}

        {pointsAwarded > 0 && !gradingFailed && (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-3 py-2.5 text-sm text-amber-900 dark:text-amber-100 flex items-center gap-2">
            {tierName ? (
              <TierStars
                level={starLevelFromTierName(tierName) as 0 | 1 | 2 | 3}
                size="sm"
              />
            ) : (
              <Star className="h-4 w-4 fill-amber-400 text-amber-500 shrink-0" />
            )}
            <span>
              <span className="font-semibold">+{pointsAwarded} points earned</span>
              {tierName ? ` — reached ${tierName}` : ""}
            </span>
          </div>
        )}

        {attempt.overallFeedback && !gradingFailed && (
          <p className="mt-4 text-sm text-muted-foreground border-t pt-4 whitespace-pre-wrap leading-relaxed">
            {attempt.overallFeedback}
          </p>
        )}
      </div>

      {displayMode === "full_breakdown" && criterionScores.length > 0 && (
        <div className="space-y-4 border-t pt-4">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Rubric breakdown
          </h3>
          {criterionScores.map((cs) => {
            const max = cs.maxScore || 100;
            const value = parseFloat(cs.manualScore ?? cs.score) || 0;
            const pct = Math.round((value / max) * 100);
            return (
              <div key={cs.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm gap-2">
                  <span className="font-medium">{cs.criterionName ?? "Criterion"}</span>
                  <span className="text-muted-foreground tabular-nums shrink-0">
                    {Math.round(value)} / {max}
                  </span>
                </div>
                <Progress value={pct} className="h-1.5" />
                {cs.feedback && (
                  <p className="text-sm text-muted-foreground">{cs.feedback}</p>
                )}
                {canManage && (
                  <div className="flex items-center gap-2 pt-1">
                    <Input
                      type="number"
                      className="h-8 w-24"
                      defaultValue={Math.round(value)}
                      min={0}
                      max={max}
                      onBlur={(e) => {
                        const next = parseFloat(e.target.value);
                        if (!Number.isNaN(next) && next !== value) {
                          overrideMutation.mutate({ scoreId: cs.id, score: next });
                        }
                      }}
                    />
                    <span className="text-xs text-muted-foreground">Override score (admin)</span>
                  </div>
                )}
                <div className="grid gap-2 pt-1">
                  {cs.strengths && (
                    <div className="flex items-start gap-1.5 text-xs text-green-700 dark:text-green-400">
                      <ThumbsUp className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                      <span>{cs.strengths}</span>
                    </div>
                  )}
                  {cs.improvements && (
                    <div className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                      <ArrowUpCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                      <span>{cs.improvements}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const stageContents = {
    challenge: challengeContent,
    conversation: conversationContent,
    assessment: assessmentContent,
  };

  return (
    <MainLayout>
      <div
        className="w-full max-w-[1600px] mx-auto py-4 px-4 flex flex-col"
        style={{ height: "calc(100vh - 7rem)" }}
      >
        <div className="shrink-0 mb-4">
          <Link
            href={`/roleplays/${roleplayId}`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
          >
            <ArrowLeft className="h-4 w-4" /> Back to roleplay
          </Link>

          <div className="min-w-0">
            <span className="inline-block text-xs font-medium uppercase tracking-wide text-pink-800 dark:text-pink-200 mb-2 rounded-md bg-pink-100 dark:bg-pink-950/50 px-2 py-1">
              Session results
            </span>
            <h1 className="text-2xl font-semibold tracking-tight truncate">
              {roleplay?.title ?? "Roleplay"}
            </h1>
          </div>
        </div>

        {/* Mobile / tablet: tabs following the same progression */}
        <Tabs defaultValue="assessment" className="flex flex-col flex-1 min-h-0 lg:hidden">
          <TabsList className="w-full shrink-0 h-auto gap-0 p-1">
            {STAGES.map((stage) => {
              const Icon = stage.icon;
              return (
                <TabsTrigger
                  key={stage.id}
                  value={stage.id}
                  className="flex-1 flex-col gap-0.5 py-2 h-auto data-[state=active]:shadow-sm"
                >
                  <span className="flex items-center gap-1.5 text-xs font-semibold">
                    <Icon className="h-3.5 w-3.5" />
                    {stage.shortLabel}
                  </span>
                </TabsTrigger>
              );
            })}
          </TabsList>
          {STAGES.map((stage) => (
            <TabsContent
              key={stage.id}
              value={stage.id}
              className="flex-1 min-h-0 mt-3 overflow-hidden data-[state=inactive]:hidden"
            >
              <StagePanel
                step={stage.step}
                label={stage.label}
                description={stage.description}
                icon={stage.icon}
                className="h-full"
              >
                {stageContents[stage.id]}
              </StagePanel>
            </TabsContent>
          ))}
        </Tabs>

        {/* Desktop: three stage panels left → right */}
        <div className="hidden lg:grid grid-cols-3 gap-5 flex-1 min-h-0">
          {STAGES.map((stage) => (
            <StagePanel
              key={stage.id}
              step={stage.step}
              label={stage.label}
              description={stage.description}
              icon={stage.icon}
              className="h-full"
            >
              {stageContents[stage.id]}
            </StagePanel>
          ))}
        </div>
      </div>
    </MainLayout>
  );
}
