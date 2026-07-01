import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { MainLayout } from "@/components/MainLayout";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Drama,
  CheckCircle2,
  XCircle,
  ThumbsUp,
  ArrowUpCircle,
  ChevronDown,
  ChevronRight,
  RotateCcw,
} from "lucide-react";

export default function RoleplayResults() {
  const params = useParams();
  const [, navigate] = useLocation();
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const canManage = hasPermission("roleplay:manage");
  const roleplayId = params.id ? parseInt(params.id) : null;
  const attemptId = params.attemptId ? parseInt(params.attemptId) : null;
  const [transcriptOpen, setTranscriptOpen] = useState(false);

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
        <div className="p-6 space-y-4 w-full max-w-3xl mx-auto">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </MainLayout>
    );
  }

  const attempt = data.attempt;
  const criterionScores: any[] = data.criterionScores ?? [];
  const messages: any[] = data.messages ?? [];
  const settings = roleplay?.settings ?? {};
  const displayMode = settings.postSessionDisplayMode ?? "full_breakdown";

  const score = attempt.score != null ? Math.round(parseFloat(attempt.score)) : null;
  const passed = attempt.isPassed;
  const gradingFailed = attempt.gradingStatus === "failed";

  return (
    <MainLayout>
    <div className="w-full max-w-3xl mx-auto py-4 px-4 space-y-4">
      <div className="flex items-center gap-2">
        <Drama className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-semibold">{roleplay?.title ?? "Roleplay"} — Results</h1>
      </div>

      {/* Overall */}
      <Card>
        <CardContent className="pt-6">
          {gradingFailed ? (
            <p className="text-sm text-muted-foreground">
              {attempt.overallFeedback || "Grading could not be completed for this attempt."}
            </p>
          ) : (
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-4xl font-bold">{score ?? "—"}%</div>
                {passed != null && (
                  <Badge
                    variant={passed ? "default" : "destructive"}
                    className="mt-2"
                  >
                    {passed ? (
                      <><CheckCircle2 className="h-3 w-3 mr-1" /> Passed</>
                    ) : (
                      <><XCircle className="h-3 w-3 mr-1" /> Not passed</>
                    )}
                  </Badge>
                )}
              </div>
              <div className="flex-1 space-y-2">
                {score != null && <Progress value={score} className="h-2" />}
              </div>
            </div>
          )}

          {attempt.overallFeedback && !gradingFailed && (
            <p className="mt-4 text-sm text-muted-foreground border-t pt-4 whitespace-pre-wrap">
              {attempt.overallFeedback}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Rubric breakdown */}
      {displayMode === "full_breakdown" && criterionScores.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Rubric breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {criterionScores.map((cs) => {
              const max = cs.maxScore || 100;
              const value = parseFloat(cs.manualScore ?? cs.score) || 0;
              const pct = Math.round((value / max) * 100);
              return (
                <div key={cs.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{cs.criterionName ?? "Criterion"}</span>
                    <span className="text-muted-foreground">
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
                  <div className="grid sm:grid-cols-2 gap-2 pt-1">
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
          </CardContent>
        </Card>
      )}

      {/* Transcript */}
      {settings.showTranscript !== false && messages.length > 0 && (
        <Card>
          <Collapsible open={transcriptOpen} onOpenChange={setTranscriptOpen}>
            <CollapsibleTrigger className="w-full">
              <CardHeader className="pb-3 flex-row items-center justify-between">
                <CardTitle className="text-base">Conversation transcript</CardTitle>
                {transcriptOpen ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-3">
                {messages
                  .filter((m) => m.role === "persona" || m.role === "learner")
                  .map((m) => {
                    const isLearner = m.role === "learner";
                    return (
                      <div key={m.id} className={cn("flex", isLearner ? "justify-end" : "justify-start")}>
                        <div
                          className={cn(
                            "max-w-[80%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap",
                            isLearner ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted rounded-bl-sm",
                          )}
                        >
                          {m.content}
                        </div>
                      </div>
                    );
                  })}
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      <div className="flex gap-2">
        <Button variant="outline" onClick={() => navigate(`/roleplays/${roleplayId}`)}>
          <RotateCcw className="h-4 w-4 mr-1" /> Back to roleplay
        </Button>
      </div>
    </div>
    </MainLayout>
  );
}
