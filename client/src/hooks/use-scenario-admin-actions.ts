import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { fetchAndDownloadExport } from "@/lib/roleplay-transfer";
import { useToast } from "@heybray/ui/hooks/use-toast";
import { useFeaturedScenarioManage } from "@/hooks/use-featured-scenario";
import type { ScenarioBrowseCardData } from "@/components/roleplays/ScenarioBrowseCard";

export function useScenarioAdminActions() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const featured = useFeaturedScenarioManage();
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
  const [editId, setEditId] = useState<number | null>(null);

  const publishMutation = useMutation({
    mutationFn: ({ id, publish }: { id: number; publish: boolean }) =>
      apiRequest("POST", `/api/roleplays/${id}/${publish ? "publish" : "unpublish"}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roleplays"] });
      queryClient.invalidateQueries({ queryKey: ["/api/roleplays/featured"] });
      queryClient.invalidateQueries({ queryKey: ["/api/roleplays/continue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/roleplays/popular"] });
      queryClient.invalidateQueries({ queryKey: ["/api/roleplays/recommended"] });
      queryClient.invalidateQueries({ queryKey: ["/api/roleplays/room-for-improvement"] });
    },
  });

  const toggleSelected = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const requestDelete = (ids: number[], title?: string) => {
    if (!ids.length) return;
    setDeleteTarget({ ids, title });
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

  const selectAll = (ids: number[]) => {
    setSelectedIds(new Set(ids));
  };

  const cardPropsFor = (rp: ScenarioBrowseCardData, canManage: boolean) => ({
    roleplay: rp,
    canManage,
    selected: selectedIds.has(rp.id),
    duplicating: duplicatingId === rp.id,
    exporting,
    onToggleSelect: () => toggleSelected(rp.id),
    onEdit: () => setEditId(rp.id),
    onDuplicate: () => void handleDuplicate(rp.id),
    onExport: () => void handleExport([rp.id]),
    onPublishToggle: () =>
      publishMutation.mutate({
        id: rp.id,
        publish: rp.status !== "published",
      }),
    isFeatured: featured.isFeatured(rp.id),
    featuredPending: featured.pending,
    onFeaturedToggle:
      rp.status === "published"
        ? () => void featured.toggleFeatured(rp.id)
        : undefined,
    onDelete: () => requestDelete([rp.id], rp.title),
    onOpen: () => navigate(`/roleplays/${rp.id}`),
    onBestScoreClick: rp.myBestAttempt
      ? () => navigate(`/roleplays/${rp.id}/results/${rp.myBestAttempt!.id}`)
      : undefined,
  });

  return {
    selectedIds,
    exporting,
    bulkPending,
    deleteTarget,
    setDeleteTarget,
    duplicatingId,
    duplicateResult,
    setDuplicateResult,
    editId,
    setEditId,
    publishMutation,
    toggleSelected,
    clearSelection,
    requestDelete,
    executeDelete,
    handleExport,
    handleDuplicate,
    selectAll,
    cardPropsFor,
  };
}
