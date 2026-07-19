import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@heybray/react/lib/queryClient";
import { invalidateRoleplayBrowseQueries, syncRoleplayInBrowseCaches, browsePatchForPublishResponse, browsePatchForUnpublishResponse } from "../lib/invalidate-roleplay-queries";
import { toggleRoleplayPublishStatus } from "../lib/roleplay-publish-toggle";
import {
  canPublishScenario,
  showPublishValidationToast,
} from "../lib/scenario-publish-validation";
import { fetchAndDownloadExport } from "../lib/roleplay-transfer";
import { toast } from "@heybray/ui/hooks/use-toast";
import { useFeaturedScenarioManage } from "../hooks/use-featured-scenario";
import type { ScenarioBrowseCardData } from "../components/roleplays/ScenarioBrowseCard";

export function useScenarioAdminActions() {
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const featured = useFeaturedScenarioManage();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [bulkPending, setBulkPending] = useState(false);
  const [publishPendingId, setPublishPendingId] = useState<number | null>(null);
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
      invalidateRoleplayBrowseQueries(queryClient);
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
      invalidateRoleplayBrowseQueries(queryClient);
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

  const handleBulkPublish = async (
    roleplays: ScenarioBrowseCardData[],
    publish: boolean,
  ) => {
    const publishable = roleplays.filter(
      (rp) => rp.status !== "published" && canPublishScenario(rp),
    );
    const unpublishable = roleplays.filter((rp) => rp.status === "published");
    const targets = publish ? publishable : unpublishable;

    if (!targets.length) {
      if (publish) {
        const blocked = roleplays.filter(
          (rp) => rp.status !== "published" && !canPublishScenario(rp),
        );
        if (blocked.length) showPublishValidationToast(toast, blocked[0]);
      }
      return;
    }

    setBulkPending(true);
    try {
      const results = await Promise.all(
        targets.map((rp) =>
          apiRequest(
            "POST",
            `/api/roleplays/${rp.id}/${publish ? "publish" : "unpublish"}`,
          ),
        ),
      );
      for (let i = 0; i < targets.length; i++) {
        const rp = targets[i]!;
        const data = results[i] ?? {};
        syncRoleplayInBrowseCaches(
          queryClient,
          rp.id,
          publish
            ? browsePatchForPublishResponse(data)
            : browsePatchForUnpublishResponse(data),
        );
      }
      invalidateRoleplayBrowseQueries(queryClient);
      toast({
        title: publish
          ? targets.length === 1
            ? "Scenario published"
            : `${targets.length} scenarios published`
          : targets.length === 1
            ? "Scenario unpublished"
            : `${targets.length} scenarios unpublished`,
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

  const selectAll = (ids: number[]) => {
    setSelectedIds(new Set(ids));
  };

  const handleCardPublishToggle = async (rp: ScenarioBrowseCardData) => {
    const publishing = rp.status !== "published";
    if (publishing && !canPublishScenario(rp)) {
      showPublishValidationToast(toast, rp);
      return;
    }
    setPublishPendingId(rp.id);
    try {
      await toggleRoleplayPublishStatus(queryClient, rp.id, publishing);
      toast({
        title: publishing ? "Scenario published" : "Scenario unpublished",
      });
    } catch (error) {
      toast({
        title: "Publish update failed",
        description: error instanceof Error ? error.message : "Could not update publish status",
        variant: "destructive",
      });
    } finally {
      setPublishPendingId(null);
    }
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
    publishPending: publishPendingId === rp.id,
    onPublishToggle: () => void handleCardPublishToggle(rp),
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
    toggleSelected,
    clearSelection,
    requestDelete,
    executeDelete,
    handleExport,
    handleDuplicate,
    handleBulkPublish,
    selectAll,
    cardPropsFor,
  };
}
