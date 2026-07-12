import { useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { NotFoundScreen } from "@heybray/react/errors";
import { Button } from "@heybray/ui/components/button";
import { Skeleton } from "@heybray/ui/components/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@heybray/ui/components/dialog";
import { ArrowLeft } from "lucide-react";
import { ScenarioHeroBanner } from "@/components/roleplays/scenario-detail/ScenarioHeroBanner";
import { ScenarioBriefing } from "@/components/roleplays/scenario-detail/ScenarioBriefing";
import { ScenarioDossier } from "@/components/roleplays/scenario-detail/ScenarioDossier";
import { ScenarioObjectives } from "@/components/roleplays/scenario-detail/ScenarioObjectives";
import { ScenarioRewardsLadder } from "@/components/roleplays/scenario-detail/ScenarioRewardsLadder";
import { ScenarioRuns } from "@/components/roleplays/scenario-detail/ScenarioRuns";
import { ScenarioLeaderboard } from "@/components/roleplays/scenario-detail/ScenarioLeaderboard";
import { ScenarioLaunchBar } from "@/components/roleplays/scenario-detail/ScenarioLaunchBar";
import { FinalAttemptDialog } from "@/components/roleplays/scenario-detail/FinalAttemptDialog";
import type {
  ScenarioLeaderboardData,
  ScenarioProgressData,
  ScenarioRun,
} from "@/components/roleplays/scenario-detail/scenario-progress-types";
import EditRoleplayDialog from "@/components/roleplays/edit-roleplay-dialog";
import { useToast } from "@heybray/ui/hooks/use-toast";
import { useAuth } from "@heybray/react/hooks/use-auth";
import { useFeaturedScenarioManage } from "@/hooks/use-featured-scenario";
import { apiRequest, queryClient } from "@heybray/react/lib/queryClient";

export default function RoleplayIntroPage() {
  const params = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const roleplayId = params.id ? parseInt(params.id) : null;
  const [editId, setEditId] = useState<number | null>(null);
  const [duplicating, setDuplicating] = useState(false);
  const [finalAttemptOpen, setFinalAttemptOpen] = useState(false);
  const [duplicateResult, setDuplicateResult] = useState<{
    id: number;
    title: string;
  } | null>(null);
  const canManage = hasPermission("roleplay:manage");
  const featured = useFeaturedScenarioManage(canManage);

  const { data: roleplay, isLoading } = useQuery<any>({
    queryKey: [`/api/roleplays/${roleplayId}`],
    enabled: !!roleplayId,
  });

  const { data: configStatus } = useQuery<{ isReady?: boolean; configured?: boolean }>({
    queryKey: [`/api/roleplays/config-status`],
  });

  const { data: myAttempts = [] } = useQuery<any[]>({
    queryKey: [`/api/roleplays/${roleplayId}/my-attempts`],
    enabled: !!roleplayId,
  });

  const { data: progress, isLoading: progressLoading } = useQuery<ScenarioProgressData>({
    queryKey: [`/api/roleplays/${roleplayId}/my-progress`],
    enabled: !!roleplayId,
  });

  const { data: leaderboard, isLoading: leaderboardLoading } = useQuery<ScenarioLeaderboardData>({
    queryKey: [`/api/roleplays/${roleplayId}/leaderboard`, { limit: 3 }],
    queryFn: () => apiRequest("GET", `/api/roleplays/${roleplayId}/leaderboard?limit=3`),
    enabled: !!roleplayId,
  });

  const settings = roleplay?.settings ?? {};
  const persona = roleplay?.persona ?? {};
  const criteria = roleplay?.criteria ?? [];
  const completedAttempts = myAttempts.filter((a) => a.status === "completed");
  const maxAttempts = settings.maxAttempts;
  const hasUnlimited = !maxAttempts || maxAttempts <= 0;
  const remaining = hasUnlimited ? null : Math.max(0, maxAttempts - myAttempts.length);
  const isOutOfAttempts = !hasUnlimited && remaining === 0;
  const maxTurns =
    typeof settings.maxTurns === "number" && settings.maxTurns > 0 ? settings.maxTurns : null;
  const timeLimitMinutes =
    typeof settings.timeLimitMinutes === "number" && settings.timeLimitMinutes > 0
      ? settings.timeLimitMinutes
      : null;
  const liveCoaching = !!settings.liveCoaching;
  const bestScore = progress?.bestScore ?? null;
  const rewardTiers = roleplay?.rewardTiers ?? [];
  const attemptCount = progress?.attemptCount ?? myAttempts.length;

  const sortedAttempts: ScenarioRun[] = [...myAttempts]
    .sort((a, b) => (b.attemptNumber ?? 0) - (a.attemptNumber ?? 0))
    .map((a) => ({
      id: a.id,
      attemptNumber: a.attemptNumber,
      status: a.status,
      score: a.score,
      isPassed: a.isPassed,
    }));

  const handleAttemptClick = (attempt: ScenarioRun) => {
    if (attempt.status === "completed") {
      navigate(`/roleplays/${roleplayId}/results/${attempt.id}`);
    } else if (attempt.status === "in_progress") {
      navigate(`/roleplays/${roleplayId}/take`);
    }
  };

  const publishMutation = useMutation({
    mutationFn: async (publish: boolean) =>
      apiRequest("POST", `/api/roleplays/${roleplayId}/${publish ? "publish" : "unpublish"}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/roleplays/${roleplayId}`] }),
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => apiRequest("DELETE", `/api/roleplays/${roleplayId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roleplays"] });
      toast({ title: "Roleplay deleted" });
      navigate("/");
    },
  });

  const handleDuplicate = async () => {
    if (!roleplayId) return;
    setDuplicating(true);
    try {
      const created = await apiRequest("POST", `/api/roleplays/${roleplayId}/duplicate`);
      queryClient.invalidateQueries({ queryKey: ["/api/roleplays"] });
      setDuplicateResult({
        id: created.id,
        title: created.title ?? "Copy of scenario",
      });
    } catch (error) {
      toast({
        title: "Duplicate failed",
        description: error instanceof Error ? error.message : "Could not duplicate scenario",
        variant: "destructive",
      });
    } finally {
      setDuplicating(false);
    }
  };

  const openDuplicatedScenario = () => {
    if (!duplicateResult) return;
    const id = duplicateResult.id;
    setDuplicateResult(null);
    setEditId(id);
  };

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

  if (isLoading) {
    return (
      <AppLayout>
        <div className="w-full max-w-6xl mx-auto px-4 lg:px-6 py-6 pb-24 space-y-6">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-[260px] w-full rounded-xl" />
          <div className="grid grid-cols-1 lg:grid-cols-[62%_38%] gap-6">
            <div className="space-y-6">
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
            <div className="space-y-6">
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-36 w-full" />
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!roleplay) {
    return (
      <AppLayout>
        <NotFoundScreen resource="roleplay" />
      </AppLayout>
    );
  }

  const isPublished = !!roleplay.published;
  const hasRoleplayModels =
    settings.personaProvider &&
    settings.personaModel &&
    settings.graderProvider &&
    settings.graderModel;
  const configNotReady = configStatus && !(configStatus.isReady ?? configStatus.configured);
  const notConfigured = configNotReady || !hasRoleplayModels;
  const canStart = isPublished && !isOutOfAttempts && !notConfigured;

  const maxAttemptsDisplay = maxAttempts && maxAttempts > 0 ? maxAttempts : null;
  const isFinalAttempt =
    !hasUnlimited && remaining === 1 && maxAttemptsDisplay != null;

  const handleStartClick = () => {
    if (isFinalAttempt) {
      setFinalAttemptOpen(true);
    } else {
      startMutation.mutate();
    }
  };

  const tierContext =
    progress?.currentTier && progress?.nextTier
      ? `${progress.currentTier.tierName} is locked in — score ${progress.nextTier.minScorePercent}%+ to reach ${progress.nextTier.tierName} and earn +${progress.nextTier.rewardPoints} pts.`
      : progress?.nextTier
        ? `Score ${progress.nextTier.minScorePercent}%+ to reach ${progress.nextTier.tierName} and earn +${progress.nextTier.rewardPoints} pts.`
        : null;

  return (
    <AppLayout>
      <div className="w-full max-w-6xl mx-auto px-4 lg:px-6 py-6 pb-24 flex flex-col min-h-0">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" /> Back to scenarios
        </Link>

        <ScenarioHeroBanner
          title={roleplay.title}
          description={roleplay.description}
          coverImageMediaId={roleplay.coverImageMediaId}
          difficulty={persona.difficulty}
          classifications={roleplay.classifications}
          achievedTier={progress?.currentTier ?? null}
          roleplayId={roleplayId!}
          canManage={canManage}
          isPublished={isPublished}
          publishPending={publishMutation.isPending}
          duplicating={duplicating}
          isFeatured={roleplayId != null && featured.isFeatured(roleplayId)}
          featuredPending={featured.pending}
          featuredDisabled={!isPublished}
          onFeaturedChange={
            roleplayId != null && isPublished
              ? (next) => void featured.setFeatured(roleplayId, next)
              : undefined
          }
          onPublishChange={(c) => publishMutation.mutate(c)}
          onEdit={() => setEditId(roleplayId)}
          onDuplicate={() => void handleDuplicate()}
          onDelete={() => deleteMutation.mutate()}
          className="mb-6"
        />

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-6 flex-1 min-h-0">
          <div className="contents lg:flex lg:flex-col lg:gap-6 lg:min-w-0 lg:flex-1">
            <ScenarioBriefing
              introduction={roleplay.introduction}
              situationContext={roleplay.situationContext}
              learnerRole={roleplay.learnerRole}
              learnerObjective={roleplay.learnerObjective}
              showLearnerObjective={criteria.length === 0}
              className="order-1 lg:order-none"
            />

            <ScenarioObjectives
              criteria={criteria}
              criterionBests={progress?.criterionBests}
              hasCompletedAttempt={completedAttempts.length > 0}
              className="order-2 lg:order-none"
            />

            <ScenarioLeaderboard
              roleplayId={roleplayId!}
              data={leaderboard}
              isLoading={leaderboardLoading}
              canManage={canManage}
              className="order-3 lg:order-none"
            />
          </div>

          <div className="contents lg:flex lg:flex-col lg:gap-6 lg:min-w-0 lg:w-[30%] lg:shrink-0">
            <ScenarioDossier
              name={persona.name}
              roleTitle={persona.roleTitle}
              personalityTraits={persona.personalityTraits}
              hasHiddenObjective={persona.hasHiddenObjective}
              className="order-4 lg:order-none"
            />

            {!progressLoading && (
              <ScenarioRewardsLadder
                tiers={rewardTiers}
                bestScore={bestScore}
                nextTier={progress?.nextTier ?? null}
                className="order-5 lg:order-none"
              />
            )}

            <ScenarioRuns
              attempts={sortedAttempts}
              lastTopImprovement={progress?.lastTopImprovement}
              onAttemptClick={handleAttemptClick}
              className="order-6 lg:order-none"
            />
          </div>
        </div>
      </div>

      <ScenarioLaunchBar
        maxTurns={maxTurns}
        autoEndOnMaxTurns={settings.autoEndOnMaxTurns}
        timeLimitMinutes={timeLimitMinutes}
        liveCoaching={liveCoaching}
        maxAttempts={maxAttemptsDisplay}
        attemptCount={attemptCount}
        isOutOfAttempts={isOutOfAttempts}
        canStart={canStart}
        startPending={startMutation.isPending}
        notConfigured={notConfigured}
        configNotReady={!!configNotReady}
        onStartClick={handleStartClick}
      />

      {isFinalAttempt && maxAttemptsDisplay != null && (
        <FinalAttemptDialog
          open={finalAttemptOpen}
          onOpenChange={setFinalAttemptOpen}
          attemptNumber={attemptCount + 1}
          maxAttempts={maxAttemptsDisplay}
          usedCount={attemptCount}
          bestScore={bestScore}
          tierContext={tierContext}
          startPending={startMutation.isPending}
          onConfirm={() => startMutation.mutate()}
        />
      )}

      {editId && (
        <EditRoleplayDialog
          roleplayId={editId}
          open={!!editId}
          onOpenChange={(open) => {
            if (!open) setEditId(null);
          }}
        />
      )}
      <Dialog
        open={!!duplicateResult}
        onOpenChange={(open) => {
          if (!open) setDuplicateResult(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Scenario duplicated</DialogTitle>
            <DialogDescription>
              &quot;{duplicateResult?.title}&quot; was created as a draft.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDuplicateResult(null)}>
              OK
            </Button>
            <Button onClick={openDuplicatedScenario}>Open</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
