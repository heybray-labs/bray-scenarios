import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { MainLayout } from "@/components/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Drama,
  Plus,
  MoreHorizontal,
  MoreVertical,
  Pencil,
  Trash2,
  PlayCircle,
  Download,
  Upload,
  CheckSquare,
  Square,
  Copy,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { ScenarioCover } from "@/components/roleplays/ScenarioCover";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { fetchAndDownloadExport } from "@/lib/roleplay-transfer";
import CreateRoleplayDialog from "@/components/roleplays/create-roleplay-dialog";
import EditRoleplayDialog from "@/components/roleplays/edit-roleplay-dialog";
import ImportRoleplaysDialog from "@/components/roleplays/import-roleplays-dialog";
import { useToast } from "@/hooks/use-toast";
import { ClassificationChip } from "@/components/classifications/ClassificationChip";
import { ClassificationMultiSelect } from "@/components/classifications/ClassificationMultiSelect";
import { FilterMultiSelect } from "@/components/classifications/FilterMultiSelect";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

const SEARCH_DEBOUNCE_MS = 300;

const DIFFICULTY_FILTER_OPTIONS = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
] as const;

export default function HomePage() {
  const { hasPermission } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const canManage = hasPermission("roleplay:manage");
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [bulkPending, setBulkPending] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    ids: number[];
    title?: string;
  } | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<number | null>(null);
  const [duplicateResult, setDuplicateResult] = useState<{
    id: number;
    title: string;
  } | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const trimmedSearchInput = searchInput.trim();
  const debouncedSearch = useDebouncedValue(
    trimmedSearchInput,
    trimmedSearchInput === "" ? 0 : SEARCH_DEBOUNCE_MS,
  );
  const [categoryFilters, setCategoryFilters] = useState<string[]>([]);
  const [tagFilters, setTagFilters] = useState<string[]>([]);
  const [audienceFilters, setAudienceFilters] = useState<string[]>([]);
  const [durationFilters, setDurationFilters] = useState<string[]>([]);
  const [difficultyFilters, setDifficultyFilters] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const pageSize = 12;

  const prevDebouncedSearch = useRef(debouncedSearch);
  useEffect(() => {
    if (prevDebouncedSearch.current !== debouncedSearch) {
      prevDebouncedSearch.current = debouncedSearch;
      setPage(1);
    }
  }, [debouncedSearch]);

  const listUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(pageSize));
    if (debouncedSearch) params.set("search", debouncedSearch);
    categoryFilters.forEach((c) => params.append("category", c));
    tagFilters.forEach((t) => params.append("tag", t));
    audienceFilters.forEach((a) => params.append("audience_level", a));
    durationFilters.forEach((d) => params.append("duration", d));
    difficultyFilters.forEach((d) => params.append("difficulty", d));
    return `/api/roleplays?${params.toString()}`;
  }, [page, pageSize, debouncedSearch, categoryFilters, tagFilters, audienceFilters, durationFilters, difficultyFilters]);

  const { data: listData, isLoading, isFetching } = useQuery<{
    items: any[];
    total: number;
    page: number;
    limit: number;
  }>({
    queryKey: [
      "/api/roleplays",
      page,
      pageSize,
      debouncedSearch,
      categoryFilters,
      tagFilters,
      audienceFilters,
      durationFilters,
      difficultyFilters,
    ],
    queryFn: () => apiRequest("GET", listUrl),
    placeholderData: (previous) => previous,
  });

  const { data: taxonomy } = useQuery<{
    dimensions: Array<{
      slug: string;
      options: Array<{ slug: string; label: string; color: string; icon: string }>;
    }>;
  }>({
    queryKey: ["/api/roleplay-classifications"],
  });

  const roleplays = listData?.items ?? [];
  const total = listData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const dimensionOptions = (slug: string) =>
    taxonomy?.dimensions.find((d) => d.slug === slug)?.options ?? [];

  const clearFilters = () => {
    setSearchInput("");
    setCategoryFilters([]);
    setTagFilters([]);
    setAudienceFilters([]);
    setDurationFilters([]);
    setDifficultyFilters([]);
    setPage(1);
  };

  const hasActiveFilters =
    debouncedSearch ||
    categoryFilters.length > 0 ||
    tagFilters.length > 0 ||
    audienceFilters.length > 0 ||
    durationFilters.length > 0 ||
    difficultyFilters.length > 0;

  const publishMutation = useMutation({
    mutationFn: ({ id, publish }: { id: number; publish: boolean }) =>
      apiRequest("POST", `/api/roleplays/${id}/${publish ? "publish" : "unpublish"}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/roleplays"] }),
  });

  const selectedRoleplays = roleplays.filter((rp: { id: number }) => selectedIds.has(rp.id));
  const selectedCount = selectedIds.size;
  const publishableIds = selectedRoleplays
    .filter((rp: { status: string }) => rp.status !== "published")
    .map((rp: { id: number }) => rp.id);
  const unpublishableIds = selectedRoleplays
    .filter((rp: { status: string }) => rp.status === "published")
    .map((rp: { id: number }) => rp.id);
  const deleteCount = deleteTarget?.ids.length ?? 0;
  const deletePending = bulkPending;

  const toggleSelected = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(roleplays.map((rp: { id: number }) => rp.id)));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const requestDelete = (ids: number[], title?: string) => {
    if (!ids.length) return;
    const resolvedTitle =
      title ??
      (ids.length === 1
        ? roleplays.find((rp: { id: number }) => rp.id === ids[0])?.title
        : undefined);
    setDeleteTarget({ ids, title: resolvedTitle });
  };

  const executeDelete = async () => {
    if (!deleteTarget?.ids.length) return;
    const ids = deleteTarget.ids;
    setBulkPending(true);
    try {
      await Promise.all(ids.map((id) => apiRequest("DELETE", `/api/roleplays/${id}`)));
      queryClient.invalidateQueries({ queryKey: ["/api/roleplays"] });
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.delete(id);
        return next;
      });
      setDeleteTarget(null);
      toast({
        title: ids.length === 1 ? "Scenario deleted" : `${ids.length} scenarios deleted`,
      });
    } catch (error) {
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Could not delete scenarios",
        variant: "destructive",
      });
    } finally {
      setBulkPending(false);
    }
  };

  const handleBulkPublish = async (publish: boolean) => {
    const ids = publish ? publishableIds : unpublishableIds;
    if (!ids.length) return;
    setBulkPending(true);
    try {
      await Promise.all(
        ids.map((id) =>
          apiRequest("POST", `/api/roleplays/${id}/${publish ? "publish" : "unpublish"}`),
        ),
      );
      queryClient.invalidateQueries({ queryKey: ["/api/roleplays"] });
      toast({
        title: publish
          ? ids.length === 1
            ? "Scenario published"
            : `${ids.length} scenarios published`
          : ids.length === 1
            ? "Scenario unpublished"
            : `${ids.length} scenarios unpublished`,
      });
    } catch (error) {
      toast({
        title: publish ? "Publish failed" : "Unpublish failed",
        description: error instanceof Error ? error.message : "Could not update scenarios",
        variant: "destructive",
      });
    } finally {
      setBulkPending(false);
    }
  };

  const handleExport = async (ids: number[]) => {
    if (!ids.length) return;
    setExporting(true);
    try {
      await fetchAndDownloadExport(ids);
      toast({
        title: ids.length === 1 ? "Scenario exported" : `${ids.length} scenarios exported`,
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Could not export",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const handleDuplicate = async (id: number) => {
    setDuplicatingId(id);
    try {
      const created = await apiRequest("POST", `/api/roleplays/${id}/duplicate`);
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
      setDuplicatingId(null);
    }
  };

  const openDuplicatedScenario = () => {
    if (!duplicateResult) return;
    const id = duplicateResult.id;
    setDuplicateResult(null);
    setEditId(id);
  };

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold">Roleplay Scenarios</h1>
            <p className="text-muted-foreground">Practice conversations with AI personas</p>
          </div>
          {canManage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Roleplay
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setImportOpen(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  Import scenarios…
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!selectedIds.size || exporting}
                  onClick={() => void handleExport([...selectedIds])}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export selected
                  {selectedIds.size ? ` (${selectedIds.size})` : ""}
                </DropdownMenuItem>
                {roleplays.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={selectAll}>
                      <CheckSquare className="h-4 w-4 mr-2" />
                      Select all
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={!selectedIds.size}
                      onClick={clearSelection}
                    >
                      <Square className="h-4 w-4 mr-2" />
                      Clear selection
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className="mb-6 space-y-2">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1 max-w-sm">
              <Search
                className={`absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground ${
                  isFetching && listData ? "opacity-50" : ""
                }`}
              />
              <Input
                className="h-8 pl-8 text-sm"
                placeholder="Search scenarios…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
              {(trimmedSearchInput !== debouncedSearch || (isFetching && debouncedSearch)) &&
                listData && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">
                  Searching…
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <ClassificationMultiSelect
                compact
                placeholder="Category"
                className="w-[6.75rem]"
                options={dimensionOptions("category")}
                selected={categoryFilters}
                onChange={(next) => {
                  setCategoryFilters(next);
                  setPage(1);
                }}
              />
              <ClassificationMultiSelect
                compact
                placeholder="Tags"
                className="w-[5.5rem]"
                options={dimensionOptions("tags")}
                selected={tagFilters}
                onChange={(next) => {
                  setTagFilters(next);
                  setPage(1);
                }}
              />
              <ClassificationMultiSelect
                compact
                placeholder="Audience"
                className="w-[6.75rem]"
                options={dimensionOptions("audience_level")}
                selected={audienceFilters}
                onChange={(next) => {
                  setAudienceFilters(next);
                  setPage(1);
                }}
              />
              <ClassificationMultiSelect
                compact
                placeholder="Duration"
                className="w-[6.25rem]"
                options={dimensionOptions("duration")}
                selected={durationFilters}
                onChange={(next) => {
                  setDurationFilters(next);
                  setPage(1);
                }}
              />
              <FilterMultiSelect
                compact
                placeholder="Difficulty"
                className="w-[5.75rem]"
                options={[...DIFFICULTY_FILTER_OPTIONS]}
                selected={difficultyFilters}
                onChange={(next) => {
                  setDifficultyFilters(next);
                  setPage(1);
                }}
              />
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={clearFilters}>
                  Clear
                </Button>
              )}
            </div>
          </div>
          {!isLoading && (
            <p className="text-sm text-muted-foreground">
              {total === 0 ? "No scenarios match your filters" : `${total} scenario${total === 1 ? "" : "s"}`}
            </p>
          )}
        </div>

        {isLoading && !listData ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : roleplays.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Drama className="h-12 w-12 mx-auto mb-4 opacity-40" />
              <p>
                {hasActiveFilters
                  ? "No scenarios match your filters."
                  : `No roleplays yet.${canManage ? " Create your first scenario." : ""}`}
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {canManage && selectedCount > 0 && (
              <div className="flex items-center justify-end gap-2 mb-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={bulkPending || publishableIds.length === 0}
                  onClick={() => void handleBulkPublish(true)}
                >
                  Publish {publishableIds.length}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={bulkPending || unpublishableIds.length === 0}
                  onClick={() => void handleBulkPublish(false)}
                >
                  Unpublish {unpublishableIds.length}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={bulkPending}
                  onClick={() => requestDelete([...selectedIds])}
                >
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  Delete {selectedCount}
                </Button>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {roleplays.map((rp: any) => (
                <Card key={rp.id} className="hover:shadow-md transition-shadow overflow-hidden">
                  <div className="relative">
                    {canManage && (
                      <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border border-border bg-background shadow-sm"
                          checked={selectedIds.has(rp.id)}
                          onChange={() => toggleSelected(rp.id)}
                          aria-label={`Select ${rp.title}`}
                        />
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="secondary"
                              size="icon"
                              className="h-8 w-8 shrink-0 border border-border bg-background text-foreground shadow-sm hover:bg-muted"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            <DropdownMenuItem onClick={() => setEditId(rp.id)}>
                              <Pencil className="h-4 w-4 mr-2" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={duplicatingId === rp.id}
                              onClick={() => void handleDuplicate(rp.id)}
                            >
                              <Copy className="h-4 w-4 mr-2" />
                              {duplicatingId === rp.id ? "Duplicating…" : "Duplicate"}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={exporting}
                              onClick={() => void handleExport([rp.id])}
                            >
                              <Download className="h-4 w-4 mr-2" /> Export
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                publishMutation.mutate({
                                  id: rp.id,
                                  publish: rp.status !== "published",
                                })
                              }
                            >
                              {rp.status === "published" ? "Unpublish" : "Publish"}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => requestDelete([rp.id], rp.title)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                    <ScenarioCover
                      mediaId={rp.coverImageMediaId}
                      difficulty={rp.difficulty}
                      category={rp.classifications?.category ?? null}
                      audienceLevel={rp.classifications?.audienceLevel ?? null}
                      status={
                        rp.myBestAttempt
                          ? {
                              score: parseFloat(rp.myBestAttempt.score || "0"),
                              isPassed: rp.myBestAttempt.isPassed ?? null,
                            }
                          : null
                      }
                      onStatusClick={
                        rp.myBestAttempt
                          ? () =>
                              navigate(
                                `/roleplays/${rp.id}/results/${rp.myBestAttempt.id}`,
                              )
                          : undefined
                      }
                    />
                  </div>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base truncate">{rp.title}</CardTitle>
                      {rp.status !== "published" && (
                        <Badge variant="secondary" className="shrink-0">
                          Draft
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription
                      className={`line-clamp-2 ${(rp.classifications?.tags ?? []).length > 0 ? "mb-3" : "mb-4"}`}
                    >
                      {rp.description || "No description"}
                    </CardDescription>
                    {(rp.classifications?.tags ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {(rp.classifications?.tags ?? []).slice(0, 2).map(
                          (tag: { slug: string; label: string; color: string; icon: string }) => (
                            <ClassificationChip
                              key={tag.slug}
                              label={tag.label}
                              color={tag.color}
                              icon={tag.icon}
                            />
                          ),
                        )}
                      </div>
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
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-8">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {canManage && (
        <>
          <CreateRoleplayDialog open={createOpen} onOpenChange={setCreateOpen} />
          <ImportRoleplaysDialog open={importOpen} onOpenChange={setImportOpen} />
          {editId && (
            <EditRoleplayDialog
              roleplayId={editId}
              open={!!editId}
              onOpenChange={(o) => !o && setEditId(null)}
            />
          )}
          <Dialog
            open={!!deleteTarget}
            onOpenChange={(open) => {
              if (!open && !deletePending) setDeleteTarget(null);
            }}
          >
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {deleteCount === 1 ? "Delete scenario?" : `Delete ${deleteCount} scenarios?`}
                </DialogTitle>
                <DialogDescription>
                  {deleteCount === 1
                    ? `Delete "${deleteTarget?.title ?? "this scenario"}"? This cannot be undone.`
                    : `Delete ${deleteCount} scenarios? This cannot be undone.`}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  disabled={deletePending}
                  onClick={() => setDeleteTarget(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  disabled={deletePending}
                  onClick={() => void executeDelete()}
                >
                  {deletePending ? "Deleting…" : deleteCount === 1 ? "Delete" : `Delete ${deleteCount}`}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
        </>
      )}
    </MainLayout>
  );
}
