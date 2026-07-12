import { useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { MainLayout } from "@/components/MainLayout";
import { Button } from "@heybray/ui/components/button";
import { Input } from "@heybray/ui/components/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@heybray/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@heybray/ui/components/dropdown-menu";
import {
  Plus,
  MoreHorizontal,
  Trash2,
  Download,
  Upload,
  CheckSquare,
  Square,
  Search,
  Drama,
  ArrowLeft,
} from "lucide-react";
import { useAuth } from "@heybray/react/hooks/use-auth";
import { apiRequest, queryClient } from "@heybray/react/lib/queryClient";
import CreateRoleplayDialog from "@/components/roleplays/create-roleplay-dialog";
import EditRoleplayDialog from "@/components/roleplays/edit-roleplay-dialog";
import ImportRoleplaysDialog from "@/components/roleplays/import-roleplays-dialog";
import { ClassificationMultiSelect } from "@/components/classifications/ClassificationMultiSelect";
import { FilterMultiSelect } from "@/components/classifications/FilterMultiSelect";
import { useDebouncedValue } from "@heybray/ui/hooks/use-debounced-value";
import { cn } from "@heybray/ui/utils";
import { ScenarioBrowseCard } from "@/components/roleplays/ScenarioBrowseCard";
import { useScenarioAdminActions } from "@/hooks/use-scenario-admin-actions";

const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 12;

const DIFFICULTY_FILTER_OPTIONS = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
] as const;

const MY_STATUS_FILTER_OPTIONS = [
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "attempted", label: "Attempted" },
  { value: "passed", label: "Passed" },
  { value: "bronze", label: "★ Bronze" },
  { value: "silver", label: "★★ Silver" },
  { value: "gold", label: "★★★ Gold" },
] as const;

function useSearchParams() {
  const search = useSearch();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function ScenarioSearchPage() {
  const { hasPermission } = useAuth();
  const [, navigate] = useLocation();
  const params = useSearchParams();
  const canManage = hasPermission("roleplay:manage");
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const admin = useScenarioAdminActions();
  const loadMoreRef = useRef<HTMLDivElement>(null);

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
  const [myStatusFilter, setMyStatusFilter] = useState<string[]>([]);

  useEffect(() => {
    const category = params.get("category");
    if (category) {
      setCategoryFilters([category]);
    }
  }, [params]);

  const { data: taxonomy } = useQuery<{
    dimensions: Array<{
      slug: string;
      options: Array<{ slug: string; label: string; color: string; icon: string }>;
    }>;
  }>({
    queryKey: ["/api/roleplay-classifications"],
  });

  const dimensionOptions = (slug: string) =>
    taxonomy?.dimensions.find((d) => d.slug === slug)?.options ?? [];

  const buildListUrl = (page: number) => {
    const urlParams = new URLSearchParams();
    urlParams.set("page", String(page));
    urlParams.set("limit", String(PAGE_SIZE));
    if (debouncedSearch) urlParams.set("search", debouncedSearch);
    categoryFilters.forEach((c) => urlParams.append("category", c));
    tagFilters.forEach((t) => urlParams.append("tag", t));
    audienceFilters.forEach((a) => urlParams.append("audience_level", a));
    durationFilters.forEach((d) => urlParams.append("duration", d));
    difficultyFilters.forEach((d) => urlParams.append("difficulty", d));
    if (myStatusFilter[0]) urlParams.set("myStatus", myStatusFilter[0]);
    return `/api/roleplays?${urlParams.toString()}`;
  };

  const {
    data,
    isLoading,
    isFetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: [
      "/api/roleplays/search",
      debouncedSearch,
      categoryFilters,
      tagFilters,
      audienceFilters,
      durationFilters,
      difficultyFilters,
      myStatusFilter,
    ],
    queryFn: ({ pageParam = 1 }) => apiRequest("GET", buildListUrl(pageParam)),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const nextPage = lastPage.page + 1;
      return nextPage <= Math.ceil(lastPage.total / lastPage.limit) ? nextPage : undefined;
    },
  });

  const roleplays = data?.pages.flatMap((page) => page.items) ?? [];
  const total = data?.pages[0]?.total ?? 0;

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || !hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const clearFilters = () => {
    setSearchInput("");
    setCategoryFilters([]);
    setTagFilters([]);
    setAudienceFilters([]);
    setDurationFilters([]);
    setDifficultyFilters([]);
    setMyStatusFilter([]);
  };

  const hasActiveFilters =
    debouncedSearch ||
    categoryFilters.length > 0 ||
    tagFilters.length > 0 ||
    audienceFilters.length > 0 ||
    durationFilters.length > 0 ||
    difficultyFilters.length > 0 ||
    myStatusFilter.length > 0;

  const selectedRoleplays = roleplays.filter((rp: { id: number }) =>
    admin.selectedIds.has(rp.id),
  );
  const publishableIds = selectedRoleplays
    .filter((rp: { status: string }) => rp.status !== "published")
    .map((rp: { id: number }) => rp.id);
  const unpublishableIds = selectedRoleplays
    .filter((rp: { status: string }) => rp.status === "published")
    .map((rp: { id: number }) => rp.id);

  const handleBulkPublish = async (publish: boolean) => {
    const ids = publish ? publishableIds : unpublishableIds;
    if (!ids.length) return;
    await Promise.all(
      ids.map((id) =>
        apiRequest("POST", `/api/roleplays/${id}/${publish ? "publish" : "unpublish"}`),
      ),
    );
    queryClient.invalidateQueries({ queryKey: ["/api/roleplays"] });
  };

  const selectAllLoaded = () => {
    admin.selectAll(roleplays.map((rp: { id: number }) => rp.id));
  };

  return (
    <MainLayout>
      <div className="w-full max-w-6xl mx-auto px-4 lg:px-6 py-8">
        <div className="mb-6 flex items-center gap-3">
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4" />
            Browse
          </Button>
        </div>

        <div className="mx-auto max-w-3xl mb-8 space-y-4">
          <div className="text-center">
            <h1 className="text-2xl font-semibold">Search scenarios</h1>
            <p className="text-muted-foreground mt-1">
              Find roleplay scenarios by title, category, or filters
            </p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-11 pl-10 text-base"
              placeholder="Search scenarios…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              autoFocus
            />
            {(trimmedSearchInput !== debouncedSearch || (isFetching && data)) && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                Searching…
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            <ClassificationMultiSelect
              compact
              placeholder="Category"
              className="w-[7rem]"
              options={dimensionOptions("category")}
              selected={categoryFilters}
              onChange={setCategoryFilters}
            />
            <ClassificationMultiSelect
              compact
              placeholder="Tags"
              className="w-[6rem]"
              options={dimensionOptions("tags")}
              selected={tagFilters}
              onChange={setTagFilters}
            />
            <ClassificationMultiSelect
              compact
              placeholder="Audience"
              className="w-[7rem]"
              options={dimensionOptions("audience_level")}
              selected={audienceFilters}
              onChange={setAudienceFilters}
            />
            <ClassificationMultiSelect
              compact
              placeholder="Duration"
              className="w-[6.5rem]"
              options={dimensionOptions("duration")}
              selected={durationFilters}
              onChange={setDurationFilters}
            />
            <FilterMultiSelect
              compact
              placeholder="Difficulty"
              className="w-[6.5rem]"
              options={[...DIFFICULTY_FILTER_OPTIONS]}
              selected={difficultyFilters}
              onChange={setDifficultyFilters}
            />
            <FilterMultiSelect
              compact
              placeholder="My status"
              className={cn(
                "w-[7rem]",
                myStatusFilter.length > 0 &&
                  "border-primary/50 bg-primary/10 text-primary font-semibold",
              )}
              options={[...MY_STATUS_FILTER_OPTIONS]}
              selected={myStatusFilter}
              onChange={(next) => {
                if (next.length === 0) setMyStatusFilter([]);
                else setMyStatusFilter([next[next.length - 1]]);
              }}
            />
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={clearFilters}>
                Clear
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              {total === 0
                ? "No scenarios match your filters"
                : `${total} scenario${total === 1 ? "" : "s"}`}
            </p>
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
                    disabled={!admin.selectedIds.size || admin.exporting}
                    onClick={() => void admin.handleExport([...admin.selectedIds])}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export selected
                    {admin.selectedIds.size ? ` (${admin.selectedIds.size})` : ""}
                  </DropdownMenuItem>
                  {roleplays.length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={selectAllLoaded}>
                        <CheckSquare className="h-4 w-4 mr-2" />
                        Select all on page
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={!admin.selectedIds.size}
                        onClick={admin.clearSelection}
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

          {isLoading && !data ? (
            <p className="text-muted-foreground py-6 text-center">Loading…</p>
          ) : roleplays.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Drama className="h-12 w-12 mx-auto mb-4 opacity-40" />
              <p>
                {hasActiveFilters
                  ? "No scenarios match your filters."
                  : `No roleplays yet.${canManage ? " Create your first scenario." : ""}`}
              </p>
            </div>
          ) : (
            <>
              {canManage && admin.selectedIds.size > 0 && (
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={admin.bulkPending || publishableIds.length === 0}
                    onClick={() => void handleBulkPublish(true)}
                  >
                    Publish {publishableIds.length}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={admin.bulkPending || unpublishableIds.length === 0}
                    onClick={() => void handleBulkPublish(false)}
                  >
                    Unpublish {unpublishableIds.length}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={admin.bulkPending}
                    onClick={() => admin.requestDelete([...admin.selectedIds])}
                  >
                    <Trash2 className="h-4 w-4 mr-1.5" />
                    Delete {admin.selectedIds.size}
                  </Button>
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {roleplays.map((rp: any) => (
                  <ScenarioBrowseCard
                    key={rp.id}
                    {...admin.cardPropsFor(rp, canManage)}
                  />
                ))}
              </div>
              <div ref={loadMoreRef} className="py-6 text-center text-sm text-muted-foreground">
                {isFetchingNextPage
                  ? "Loading more…"
                  : hasNextPage
                    ? "Scroll for more"
                    : roleplays.length > 0
                      ? "All scenarios loaded"
                      : null}
              </div>
            </>
          )}
        </div>
      </div>

      {canManage && (
        <>
          <CreateRoleplayDialog open={createOpen} onOpenChange={setCreateOpen} />
          <ImportRoleplaysDialog open={importOpen} onOpenChange={setImportOpen} />
          {admin.editId && (
            <EditRoleplayDialog
              roleplayId={admin.editId}
              open={!!admin.editId}
              onOpenChange={(open) => !open && admin.setEditId(null)}
            />
          )}
          <Dialog
            open={!!admin.deleteTarget}
            onOpenChange={(open) => {
              if (!open && !admin.bulkPending) admin.setDeleteTarget(null);
            }}
          >
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Delete scenario?</DialogTitle>
                <DialogDescription>
                  {admin.deleteTarget?.ids.length === 1
                    ? `Delete "${admin.deleteTarget?.title ?? "this scenario"}"? This cannot be undone.`
                    : `Delete ${admin.deleteTarget?.ids.length} scenarios? This cannot be undone.`}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => admin.setDeleteTarget(null)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={() => void admin.executeDelete()}>
                  Delete
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </MainLayout>
  );
}
