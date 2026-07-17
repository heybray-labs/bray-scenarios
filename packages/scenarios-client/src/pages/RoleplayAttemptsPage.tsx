import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AppLayout } from "../components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@heybray/ui/components/card";
import { Button } from "@heybray/ui/components/button";
import { Input } from "@heybray/ui/components/input";
import { ArrowLeft } from "lucide-react";
import { apiRequest, queryClient } from "@heybray/react/lib/queryClient";
import { useToast } from "@heybray/ui/hooks/use-toast";

export default function RoleplayAttemptsPage() {
  const params = useParams();
  const roleplayId = params.id ? parseInt(params.id) : null;
  const { toast } = useToast();
  const [overrideScore, setOverrideScore] = useState<Record<number, string>>({});

  const { data: roleplay } = useQuery<any>({
    queryKey: [`/api/roleplays/${roleplayId}`],
    enabled: !!roleplayId,
  });

  const { data: attempts = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/roleplays/${roleplayId}/attempts`],
    enabled: !!roleplayId,
  });

  const overrideMutation = useMutation({
    mutationFn: ({ scoreId, score }: { scoreId: number; score: number }) =>
      apiRequest("POST", `/api/roleplays/${roleplayId}/criterion-scores/${scoreId}/override`, { score }),
    onSuccess: () => {
      toast({ title: "Score updated" });
      queryClient.invalidateQueries({ queryKey: [`/api/roleplays/${roleplayId}/attempts`] });
    },
  });

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto p-6">
        <Link href={`/roleplays/${roleplayId}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-4">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <h1 className="text-2xl font-semibold mb-6">
          Attempts — {roleplay?.title ?? "Roleplay"}
        </h1>

        {isLoading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : attempts.length === 0 ? (
          <p className="text-muted-foreground">No attempts yet.</p>
        ) : (
          <div className="space-y-4">
            {attempts.map((a) => (
              <Card key={a.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex justify-between">
                    <span>Attempt #{a.attemptNumber} — User {a.userId}</span>
                    <span>{a.score != null ? `${Math.round(parseFloat(a.score))}%` : "—"}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-2">
                  <p>Status: {a.status} · Turns: {a.turnCount}</p>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/roleplays/${roleplayId}/results/${a.id}`}>View results</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
