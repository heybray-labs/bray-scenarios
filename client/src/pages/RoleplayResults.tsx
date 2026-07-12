import { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@heybray/ui/components/button";
import { Progress } from "@heybray/ui/components/progress";
import { Skeleton } from "@heybray/ui/components/skeleton";
import { Input } from "@heybray/ui/components/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@heybray/ui/components/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@heybray/ui/components/collapsible";
import { MainLayout } from "@/components/MainLayout";
import { cn } from "@heybray/ui/utils";
import { useAuth } from "@/hooks/use-auth";
import { initialsFromUser } from "@/lib/user-display";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@heybray/ui/hooks/use-toast";
import {
  ThumbsUp,
  ArrowUpCircle,
  ArrowLeft,
  Target,
  User,
  Route,
  ChevronDown,
  Lightbulb,
  PlayCircle,
} from "lucide-react";
import { ClockFading } from "@/components/icons/roleplay-field-icons";
import { ScenarioCover } from "@/components/roleplays/ScenarioCover";
import { AttemptPips } from "@/components/roleplays/scenario-detail/AttemptPips";
import { FinalAttemptDialog } from "@/components/roleplays/scenario-detail/FinalAttemptDialog";
import type { RewardTierRow } from "@/components/roleplays/scenario-detail/scenario-progress-types";
import { FieldBlock } from "@/components/roleplays/results/FieldBlock";
import { ResultsRevealHero } from "@/components/roleplays/results/ResultsRevealHero";
import { usePrefersReducedMotion } from "@/components/roleplays/results/reveal-hooks";
import { RESULT_STAGES } from "@/components/roleplays/results/stages";
import { StagePanel } from "@/components/roleplays/results/StagePanel";
import { TranscriptThread } from "@/components/roleplays/transcript/TranscriptThread";

export default function RoleplayResults() {
  const params = useParams();
  const [, navigate] = useLocation();
  const { hasPermission, user } = useAuth();
  const { toast } = useToast();
  const reducedMotion = usePrefersReducedMotion();
  const canManage = hasPermission("roleplay:manage");
  const roleplayId = params.id ? parseInt(params.id) : null;
  const attemptId = params.attemptId ? parseInt(params.attemptId) : null;
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [finalAttemptOpen, setFinalAttemptOpen] = useState(false);

  const { data: roleplay } = useQuery<any>({
    queryKey: [`/api/roleplays/${roleplayId}`],
    enabled: !!roleplayId,
  });

  const { data: configStatus } = useQuery<{ isReady?: boolean; configured?: boolean }>({
    queryKey: [`/api/roleplays/config-status`],
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

  const startMutation = useMutation({
    mutationFn: async () => apiRequest("POST", `/api/roleplays/${roleplayId}/attempts`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/roleplays/${roleplayId}/my-progress`] });
      queryClient.invalidateQueries({ queryKey: [`/api/roleplays/${roleplayId}/my-attempts`] });
      queryClient.invalidateQueries({ queryKey: [`/api/roleplays/${roleplayId}/leaderboard`] });
      setFinalAttemptOpen(false);
      navigate(`/roleplays/${roleplayId}/take`);
    },
    onError: (err: Error) =>
      toast({ title: "Could not start", description: err.message, variant: "destructive" }),
  });

  if (isLoading || !data) {
    return (
      <MainLayout>
        <div className="p-6 space-y-4 w-full max-w-3xl mx-auto">
          <Skeleton className="h-10 w-1/3" />
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </MainLayout>
    );
  }

  const attempt = data.attempt;
  const isReadOnlyView = attempt.userId !== user?.id;
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
  const tierName = (data.tierName as string | null | undefined) ?? null;
  const previousBestScore = data.previousBestScore as number | null | undefined;
  const isNewBest = !!data.isNewBest;
  const bestScoreAfter = data.bestScoreAfter as number | undefined;
  const rewardTiers = (data.rewardTiers ?? []) as RewardTierRow[];
  const nextTier = data.nextTier ?? null;
  const topImprovement = data.topImprovement as string | null | undefined;
  const attemptContext = data.attemptContext as {
    attemptNumber: number;
    maxAttempts: number | null;
    usedCount: number;
    isOutOfAttempts: boolean;
  } | undefined;
  const totalPoints = Number(data.totalPoints ?? 0);

  const userInitials = initialsFromUser(user);

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

  const conversationContent = (
    <TranscriptThread
      messages={messages}
      learnerInitials={userInitials}
      showTranscript={showTranscript}
    />
  );

  const assessmentContent = (
    <div className="space-y-5">
      {gradingFailed ? (
        <p className="text-sm text-muted-foreground">
          {attempt.overallFeedback || "Grading could not be completed for this attempt."}
        </p>
      ) : (
        attempt.overallFeedback && (
          <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
            {attempt.overallFeedback}
          </p>
        )
      )}

      {displayMode === "full_breakdown" && criterionScores.length > 0 && (
        <div className={cn("space-y-4", attempt.overallFeedback && !gradingFailed && "border-t pt-4")}>
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
                    <div className="flex items-start gap-1.5 text-xs text-[var(--feedback-positive)]">
                      <ThumbsUp className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                      <span>{cs.strengths}</span>
                    </div>
                  )}
                  {cs.improvements && (
                    <div className="flex items-start gap-1.5 text-xs text-[var(--feedback-improvement)]">
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

  const isPublished = !!roleplay?.published;
  const hasRoleplayModels =
    settings.personaProvider &&
    settings.personaModel &&
    settings.graderProvider &&
    settings.graderModel;
  const configNotReady = configStatus && !(configStatus.isReady ?? configStatus.configured);
  const notConfigured = configNotReady || !hasRoleplayModels;
  const isOutOfAttempts = attemptContext?.isOutOfAttempts ?? false;
  const hasUnlimited = !attemptContext?.maxAttempts;
  const maxAttempts = attemptContext?.maxAttempts ?? null;
  const usedCount = attemptContext?.usedCount ?? 0;
  const nextAttemptNumber = usedCount + 1;
  const canStart = isPublished && !isOutOfAttempts && !notConfigured;
  const isFinalAttempt =
    !hasUnlimited && maxAttempts != null && maxAttempts - usedCount === 1;

  const sortedTiers = [...rewardTiers].sort(
    (a, b) => (a.starLevel ?? 0) - (b.starLevel ?? 0) || a.minScorePercent - b.minScorePercent,
  );
  const topTier = sortedTiers[sortedTiers.length - 1];
  const atTopTier =
    bestScoreAfter != null && topTier && bestScoreAfter >= topTier.minScorePercent;

  const remainingAttempts =
    maxAttempts != null ? Math.max(0, maxAttempts - usedCount) : null;

  let retryContextLine: string | null = null;
  if (isOutOfAttempts) {
    retryContextLine = "Best score achieved — no attempts remaining.";
  } else if (atTopTier && remainingAttempts != null) {
    retryContextLine = `Top tier achieved — ${remainingAttempts} attempt${remainingAttempts === 1 ? "" : "s"} remaining if you want to refine your approach.`;
  } else if (nextTier && bestScoreAfter != null && remainingAttempts != null) {
    const delta = Math.max(0, Math.ceil(nextTier.minScorePercent - bestScoreAfter));
    retryContextLine = `${delta} point${delta === 1 ? "" : "s"} from ${nextTier.tierName}. ${remainingAttempts} attempt${remainingAttempts === 1 ? "" : "s"} remaining.`;
  } else if (remainingAttempts != null) {
    retryContextLine = `${remainingAttempts} attempt${remainingAttempts === 1 ? "" : "s"} remaining.`;
  }

  const handleStartClick = () => {
    if (isFinalAttempt) {
      setFinalAttemptOpen(true);
    } else {
      startMutation.mutate();
    }
  };

  const tierContext =
    nextTier
      ? `Score ${nextTier.minScorePercent}%+ to reach ${nextTier.tierName} and earn +${nextTier.rewardPoints} pts.`
      : null;

  const retryCtaLabel = isOutOfAttempts
    ? "No attempts remaining"
    : hasUnlimited
      ? startMutation.isPending
        ? "Starting…"
        : "Try again"
      : startMutation.isPending
        ? "Starting…"
        : `Try again — attempt ${nextAttemptNumber} of ${maxAttempts}`;

  return (
    <MainLayout>
      <div
        className="w-full max-w-[1600px] mx-auto py-4 px-4 lg:px-8 flex flex-col gap-4 min-h-0"
        style={{ minHeight: "calc(100vh - 7rem)" }}
      >
        <div className="shrink-0">
          <Link
            href={`/roleplays/${roleplayId}`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
          >
            <ArrowLeft className="h-4 w-4" /> Back to roleplay
          </Link>

          <div className="min-w-0">
            <span className="inline-block text-xs font-medium uppercase tracking-wide text-primary mb-2 rounded-md bg-primary/10 px-2 py-1">
              Session results
            </span>
            <h1 className="text-2xl font-semibold tracking-tight truncate">
              {roleplay?.title ?? "Roleplay"}
            </h1>
            {isReadOnlyView && (
              <p className="text-xs text-muted-foreground mt-1">
                Viewing another learner&apos;s result · read-only
              </p>
            )}
          </div>
        </div>

        <ResultsRevealHero
          score={score}
          passed={passed}
          gradingFailed={gradingFailed}
          overallFeedback={attempt.overallFeedback}
          tierName={tierName}
          pointsAwarded={pointsAwarded}
          totalPoints={totalPoints}
          isNewBest={isNewBest}
          previousBestScore={previousBestScore ?? null}
          reducedMotion={reducedMotion}
          rewardTiers={rewardTiers}
          nextTier={nextTier}
          bestScoreAfter={bestScoreAfter}
        />

        {!gradingFailed && topImprovement?.trim() && (
          <div className="rounded-xl border bg-card shadow-sm px-4 py-3.5 flex gap-2.5 items-start">
            <Lightbulb className="h-4 w-4 text-warning shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Highest-impact fix this run:</strong>{" "}
              {topImprovement.trim()}
            </p>
          </div>
        )}

        {!isReadOnlyView && (
        <div className="rounded-xl border bg-card shadow-sm px-4 py-3.5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            {!hasUnlimited && maxAttempts != null && (
              <AttemptPips maxAttempts={maxAttempts} usedCount={usedCount} />
            )}
            {retryContextLine && (
              <p className="text-sm text-muted-foreground min-w-0">{retryContextLine}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" asChild>
              <Link href={`/roleplays/${roleplayId}`}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to scenario
              </Link>
            </Button>
            {!isOutOfAttempts && (
              <Button
                disabled={!canStart || startMutation.isPending}
                onClick={handleStartClick}
              >
                <PlayCircle className="h-4 w-4 mr-2" />
                {retryCtaLabel}
              </Button>
            )}
          </div>
        </div>
        )}

        {isReadOnlyView && (
          <div className="rounded-xl border bg-card shadow-sm px-4 py-3.5">
            <Button variant="outline" asChild>
              <Link href={`/team-star-map`}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to star map
              </Link>
            </Button>
          </div>
        )}

        <Collapsible open={breakdownOpen} onOpenChange={setBreakdownOpen} className="mt-2">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className={cn(
                "group flex w-full items-center justify-between gap-3 rounded-xl border-2 border-dashed px-5 py-4",
                "bg-muted/40 hover:bg-muted/70 hover:border-primary/50 transition-colors",
                "text-sm font-semibold text-foreground shadow-sm cursor-pointer",
                breakdownOpen && "border-primary/40 bg-primary/5",
              )}
              aria-expanded={breakdownOpen}
            >
              <span>See Full Breakdown</span>
              <ChevronDown
                className={cn(
                  "h-5 w-5 shrink-0 text-primary transition-transform duration-200",
                  breakdownOpen && "rotate-180",
                )}
              />
            </button>
          </CollapsibleTrigger>

          <CollapsibleContent className="mt-4 flex flex-col flex-1 min-h-0 overflow-hidden data-[state=open]:flex">
            <Tabs defaultValue="assessment" className="flex flex-col flex-1 min-h-0 lg:hidden">
              <TabsList className="w-full shrink-0 h-auto gap-0 p-1">
                {RESULT_STAGES.map((stage) => {
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
              {RESULT_STAGES.map((stage) => (
                <TabsContent
                  key={stage.id}
                  value={stage.id}
                  className="mt-3 flex-1 min-h-0 data-[state=inactive]:hidden"
                >
                  <StagePanel
                    step={stage.step}
                    label={stage.label}
                    description={stage.description}
                    icon={stage.icon}
                    className="min-h-[min(60vh,520px)]"
                  >
                    {stageContents[stage.id]}
                  </StagePanel>
                </TabsContent>
              ))}
            </Tabs>

            <div className="hidden lg:grid grid-cols-3 gap-5 flex-1 min-h-[min(65vh,560px)]">
              {RESULT_STAGES.map((stage) => (
                <StagePanel
                  key={stage.id}
                  step={stage.step}
                  label={stage.label}
                  description={stage.description}
                  icon={stage.icon}
                  className="h-full min-h-[min(65vh,560px)]"
                >
                  {stageContents[stage.id]}
                </StagePanel>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {!isReadOnlyView && isFinalAttempt && maxAttempts != null && (
        <FinalAttemptDialog
          open={finalAttemptOpen}
          onOpenChange={setFinalAttemptOpen}
          attemptNumber={nextAttemptNumber}
          maxAttempts={maxAttempts}
          usedCount={usedCount}
          bestScore={bestScoreAfter ?? null}
          tierContext={tierContext}
          startPending={startMutation.isPending}
          onConfirm={() => startMutation.mutate()}
        />
      )}
    </MainLayout>
  );
}
