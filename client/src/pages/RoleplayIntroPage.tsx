import { useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MainLayout } from "@/components/MainLayout";
import { NotFoundScreen } from "@/components/errors";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft } from "lucide-react";
import { ScenarioDetailHeader } from "@/components/roleplays/scenario-detail/ScenarioDetailHeader";
import { ScenarioNarrative } from "@/components/roleplays/scenario-detail/ScenarioNarrative";
import { ScenarioRubricPreview } from "@/components/roleplays/scenario-detail/ScenarioRubricPreview";
import { ScenarioDetailRail } from "@/components/roleplays/scenario-detail/ScenarioDetailRail";
import type { ScenarioAttempt } from "@/components/roleplays/scenario-detail/ScenarioAttemptsList";
import type { ScenarioProgressData } from "@/components/roleplays/scenario-detail/ScenarioProgressPanel";
import EditRoleplayDialog from "@/components/roleplays/edit-roleplay-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function RoleplayIntroPage() {
  const params = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const roleplayId = params.id ? parseInt(params.id) : null;
  const [editId, setEditId] = useState<number | null>(null);
  const [duplicating, setDuplicating] = useState(false);
  const [duplicateResult, setDuplicateResult] = useState<{
    id: number;
    title: string;
  } | null>(null);
  const canManage = hasPermission("roleplay:manage");

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

  const settings = roleplay?.settings ?? {};
  const persona = roleplay?.persona ?? {};
  const completedAttempts = myAttempts.filter((a) => a.status === "completed");
  const bestAttempt = completedAttempts.length
    ? completedAttempts.reduce((best, a) => {
        const score = parseFloat(a.score || "0");
        const bestScore = parseFloat(best.score || "0");
        return score > bestScore ? a : best;
      })
    : null;
  const maxAttempts = settings.maxAttempts;
  const hasUnlimited = !maxAttempts || maxAttempts <= 0;
  const remaining = hasUnlimited ? null : Math.max(0, maxAttempts - myAttempts.length);
  const isOutOfAttempts = !hasUnlimited && remaining === 0;
  const maxTurns =
    typeof settings.maxTurns === "number" && settings.maxTurns > 0
      ? settings.maxTurns
      : null;
  const timeLimitMinutes =
    typeof settings.timeLimitMinutes === "number" && settings.timeLimitMinutes > 0
      ? settings.timeLimitMinutes
      : null;
  const liveCoaching = !!settings.liveCoaching;
  const bestScore = progress?.bestScore ?? null;
  const rewardTiers = roleplay?.rewardTiers ?? [];

  const sortedAttempts: ScenarioAttempt[] = [...myAttempts]
    .sort((a, b) => (b.attemptNumber ?? 0) - (a.attemptNumber ?? 0))
    .map((a) => ({
      id: a.id,
      attemptNumber: a.attemptNumber,
      status: a.status,
      score: a.score,
    }));

  const handleAttemptClick = (attempt: ScenarioAttempt) => {
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
      navigate(`/roleplays/${roleplayId}/take`);
    },
    onError: (err: Error) =>
      toast({ title: "Could not start", description: err.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <MainLayout>
        <div className="w-full px-4 lg:px-6 py-6 space-y-6">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-10 w-2/3 max-w-md" />
          <Skeleton className="h-6 w-full max-w-xl" />
          <Skeleton className="h-8 w-full max-w-lg" />
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1 space-y-6">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
            <Skeleton className="h-96 w-full lg:w-[30%] shrink-0" />
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!roleplay) {
    return (
      <MainLayout>
        <NotFoundScreen resource="roleplay" />
      </MainLayout>
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

  const maxAttemptsDisplay =
    maxAttempts && maxAttempts > 0 ? maxAttempts : null;

  return (
    <MainLayout>
      <div className="w-full px-4 lg:px-6 py-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" /> Back to scenarios
        </Link>

        <ScenarioDetailHeader
          title={roleplay.title}
          description={roleplay.description}
          difficulty={persona.difficulty}
          classifications={roleplay.classifications}
          canManage={canManage}
          isPublished={isPublished}
          publishPending={publishMutation.isPending}
          duplicating={duplicating}
          onPublishChange={(c) => publishMutation.mutate(c)}
          onEdit={() => setEditId(roleplayId)}
          onDuplicate={() => void handleDuplicate()}
          onDelete={() => deleteMutation.mutate()}
        />

        <div className="flex flex-col-reverse lg:flex-row gap-6">
          <div className="min-w-0 flex-1 lg:w-[70%]">
            <ScenarioNarrative
              learnerRole={roleplay.learnerRole}
              situationContext={roleplay.situationContext}
              introduction={roleplay.introduction}
              learnerObjective={roleplay.learnerObjective}
              personaName={persona.name}
              personaRoleTitle={persona.roleTitle}
            />
            <ScenarioRubricPreview criteria={roleplay.criteria ?? []} className="mt-8" />
          </div>

          <ScenarioDetailRail
            roleplayId={roleplayId!}
            coverImageMediaId={roleplay.coverImageMediaId}
            coverStatus={
              bestAttempt
                ? {
                    score: parseFloat(bestAttempt.score || "0"),
                    isPassed: bestAttempt.isPassed ?? null,
                  }
                : null
            }
            onCoverStatusClick={
              bestAttempt
                ? () => navigate(`/roleplays/${roleplayId}/results/${bestAttempt.id}`)
                : undefined
            }
            progress={progress}
            progressLoading={progressLoading}
            rewardTiers={rewardTiers}
            bestScore={bestScore}
            attempts={sortedAttempts}
            onAttemptClick={handleAttemptClick}
            passThreshold={settings.passThreshold ?? 70}
            maxTurns={maxTurns}
            autoEndOnMaxTurns={settings.autoEndOnMaxTurns}
            timeLimitMinutes={timeLimitMinutes}
            liveCoaching={liveCoaching}
            maxAttempts={maxAttemptsDisplay}
            notConfigured={notConfigured}
            configNotReady={!!configNotReady}
            canStart={canStart}
            startPending={startMutation.isPending}
            onStart={() => startMutation.mutate()}
            canManage={canManage}
          />
        </div>
      </div>

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
    </MainLayout>
  );
}
