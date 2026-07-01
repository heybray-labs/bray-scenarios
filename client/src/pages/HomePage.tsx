import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { MainLayout } from "@/components/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Drama, Plus, MoreVertical, Pencil, Trash2, PlayCircle, Trophy } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import CreateRoleplayDialog from "@/components/roleplays/create-roleplay-dialog";
import EditRoleplayDialog from "@/components/roleplays/edit-roleplay-dialog";
import { useToast } from "@/hooks/use-toast";

export default function HomePage() {
  const { hasPermission } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const canManage = hasPermission("roleplay:manage");
  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  const { data: roleplays = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/roleplays"],
  });

  const publishMutation = useMutation({
    mutationFn: ({ id, publish }: { id: number; publish: boolean }) =>
      apiRequest("POST", `/api/roleplays/${id}/${publish ? "publish" : "unpublish"}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/roleplays"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/roleplays/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roleplays"] });
      toast({ title: "Roleplay deleted" });
    },
  });

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold">Roleplay Scenarios</h1>
            <p className="text-muted-foreground">Practice conversations with AI personas</p>
          </div>
          {canManage && (
            <Button onClick={() => setCreateOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              New Roleplay
            </Button>
          )}
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : roleplays.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Drama className="h-12 w-12 mx-auto mb-4 opacity-40" />
              <p>No roleplays yet.{canManage ? " Create your first scenario." : ""}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {roleplays.map((rp: any) => (
              <Card key={rp.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Drama className="h-5 w-5 text-primary shrink-0" />
                      <CardTitle className="text-base truncate">{rp.title}</CardTitle>
                    </div>
                    {canManage && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditId(rp.id)}>
                            <Pencil className="h-4 w-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => publishMutation.mutate({ id: rp.id, publish: rp.status !== "published" })}
                          >
                            {rp.status === "published" ? "Unpublish" : "Publish"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => deleteMutation.mutate(rp.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                  {rp.status !== "published" && (
                    <Badge variant="secondary" className="w-fit">
                      Draft
                    </Badge>
                  )}
                </CardHeader>
                <CardContent>
                  <CardDescription className="line-clamp-2 mb-4">
                    {rp.description || "No description"}
                  </CardDescription>
                  {rp.myBestAttempt && (
                    <button
                      type="button"
                      onClick={() =>
                        navigate(`/roleplays/${rp.id}/results/${rp.myBestAttempt.id}`)
                      }
                      className="mb-4 w-full rounded-md border bg-muted/40 p-3 text-left hover:bg-muted/70 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Trophy className="h-4 w-4 shrink-0" />
                          Best attempt
                        </span>
                        <span className="text-sm font-semibold">
                          {Math.round(parseFloat(rp.myBestAttempt.score || "0"))}%
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground">
                          Attempt {rp.myBestAttempt.attemptNumber}
                        </span>
                        {rp.myBestAttempt.isPassed != null && (
                          <Badge
                            variant={rp.myBestAttempt.isPassed ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {rp.myBestAttempt.isPassed ? "Passed" : "Not passed"}
                          </Badge>
                        )}
                      </div>
                    </button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2"
                    disabled={rp.status !== "published"}
                    onClick={() => navigate(`/roleplays/${rp.id}`)}
                  >
                    <PlayCircle className="h-4 w-4" />
                    {rp.status === "published" ? "Open" : "Draft"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {canManage && (
        <>
          <CreateRoleplayDialog open={createOpen} onOpenChange={setCreateOpen} />
          {editId && (
            <EditRoleplayDialog
              roleplayId={editId}
              open={!!editId}
              onOpenChange={(o) => !o && setEditId(null)}
            />
          )}
        </>
      )}
    </MainLayout>
  );
}
