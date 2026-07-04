import { useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MainLayout } from "@/components/MainLayout";
import { NotFoundScreen } from "@/components/errors";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  PlayCircle,
  MoreVertical,
  Pencil,
  Trash2,
  Target,
  User,
  Route,
  AlertTriangle,
  ArrowLeft,
  Copy,
} from "lucide-react";
import { ScenarioCover } from "@/components/roleplays/ScenarioCover";
import { ClockFading } from "@/components/icons/roleplay-field-icons";
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

  const settings = roleplay?.settings ?? {};
  const persona = roleplay?.persona ?? {};
  const completedAttempts = myAttempts.filter((a) => a.status === "completed");
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
  const bestScore = completedAttempts.length
    ? Math.max(...completedAttempts.map((a) => parseFloat(a.score) || 0))
    : null;

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
    onSuccess: () => navigate(`/roleplays/${roleplayId}/take`),
    onError: (err: Error) =>
      toast({ title: "Could not start", description: err.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <MainLayout>
        <div className="p-6 space-y-6 max-w-6xl mx-auto">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
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

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto p-6">
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to scenarios
        </Link>

        <div className="mb-6 overflow-hidden rounded-xl border">
          <ScenarioCover mediaId={roleplay.coverImageMediaId} />
        </div>

        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold">{roleplay.title}</h1>
            {roleplay.description && (
              <p className="text-muted-foreground text-sm mt-1">{roleplay.description}</p>
            )}
          </div>
          {canManage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <div className="px-2 py-1.5 flex items-center gap-2">
                  <Switch
                    checked={isPublished}
                    onCheckedChange={(c) => publishMutation.mutate(c)}
                    disabled={publishMutation.isPending}
                  />
                  <span className="text-sm">Published</span>
                </div>
                <DropdownMenuItem onClick={() => setEditId(roleplayId)}>
                  <Pencil className="h-4 w-4 mr-2" /> Edit
                </DropdownMenuItem>
                <DropdownMenuItem disabled={duplicating} onClick={() => void handleDuplicate()}>
                  <Copy className="h-4 w-4 mr-2" />
                  {duplicating ? "Duplicating…" : "Duplicate"}
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive" onClick={() => deleteMutation.mutate()}>
                  <Trash2 className="h-4 w-4 mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 space-y-4 min-w-0">
            {roleplay.situationContext && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Route className="h-4 w-4" /> Context
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{roleplay.situationContext}</p>
                </CardContent>
              </Card>
            )}
            {roleplay.introduction && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ClockFading className="h-4 w-4" /> Current Situation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{roleplay.introduction}</p>
                </CardContent>
              </Card>
            )}
            {roleplay.learnerObjective && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Target className="h-4 w-4" /> Your Objective
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{roleplay.learnerObjective}</p>
                </CardContent>
              </Card>
            )}
            {(persona.name || persona.roleTitle) && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="h-4 w-4" /> Who you&apos;ll talk to
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {persona.name && <p className="font-medium text-foreground">{persona.name}</p>}
                  {persona.roleTitle && <p>{persona.roleTitle}</p>}
                </CardContent>
              </Card>
            )}
          </div>

          <aside className="w-full lg:w-72 shrink-0 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Ready to start?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  <li>Pass threshold: {settings.passThreshold ?? 70}%</li>
                  {maxTurns != null && (
                    <li>
                      Max turns: {maxTurns}
                      {settings.autoEndOnMaxTurns ? " (auto-submits)" : ""}
                    </li>
                  )}
                  {timeLimitMinutes != null && (
                    <li>
                      Time limit: {timeLimitMinutes}{" "}
                      {timeLimitMinutes === 1 ? "minute" : "minutes"}
                    </li>
                  )}
                  <li>Coaching: {liveCoaching ? "On" : "Off"}</li>
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
                  onClick={() => startMutation.mutate()}
                  disabled={!canStart || startMutation.isPending}
                >
                  <PlayCircle className="mr-2 h-4 w-4" />
                  {startMutation.isPending ? "Starting…" : "Start Roleplay"}
                </Button>
              </CardContent>
            </Card>

            {completedAttempts.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Your attempts</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {completedAttempts.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => navigate(`/roleplays/${roleplayId}/results/${a.id}`)}
                      className="w-full text-left p-2 rounded-md text-sm hover:bg-muted"
                    >
                      Attempt {a.attemptNumber} — {Math.round(parseFloat(a.score || "0"))}%
                    </button>
                  ))}
                </CardContent>
              </Card>
            )}

            {canManage && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Admin</CardTitle>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" size="sm" className="w-full" asChild>
                    <Link href={`/roleplays/${roleplayId}/attempts`}>View all attempts</Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </aside>
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
              "{duplicateResult?.title}" was created as a draft.
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
