import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@heybray/ui/components/button";
import { Input } from "@heybray/ui/components/input";
import { Label } from "@heybray/ui/components/label";
import { Badge } from "@heybray/ui/components/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@heybray/ui/components/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@heybray/ui/components/collapsible";
import { useToast } from "@heybray/ui/hooks/use-toast";
import { apiRequest, queryClient } from "@heybray/react/lib/queryClient";
import { HttpError } from "@heybray/react/lib/http-error";
import {
  ChevronDown,
  Loader2,
  Plus,
  Tags,
} from "lucide-react";
import {
  ClassificationOptionList,
  type ClassificationOptionRow,
} from "@heybray/react/classifications/ClassificationOptionList";
import {
  OptionDisplayFields,
  defaultDisplayForDimension,
} from "@heybray/react/classifications/OptionDisplayFields";

type ClassificationOption = ClassificationOptionRow;

type ClassificationDimension = {
  id: number;
  slug: string;
  name: string;
  cardinality: string;
  sortOrder: number;
  options: ClassificationOption[];
};

type ClassificationsResponse = {
  dimensions: ClassificationDimension[];
};

const QUERY_KEY = ["/api/roleplay-classifications?includeInactive=true"];

export function ClassificationManagementPanel() {
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [createDimension, setCreateDimension] = useState<ClassificationDimension | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState("#6366f1");
  const [newIcon, setNewIcon] = useState("tag");
  const [editTarget, setEditTarget] = useState<ClassificationOption | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editColor, setEditColor] = useState("#6366f1");
  const [editIcon, setEditIcon] = useState("tag");
  const [confirmAction, setConfirmAction] = useState<{
    type: "deactivate" | "delete";
    option: ClassificationOption;
  } | null>(null);

  const { data, isLoading, error } = useQuery<ClassificationsResponse>({
    queryKey: QUERY_KEY,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/roleplay-classifications"] });
    queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  };

  const createMutation = useMutation({
    mutationFn: (payload: {
      dimensionSlug: string;
      label: string;
      color: string;
      icon: string;
    }) => apiRequest("POST", "/api/roleplay-classifications/options", payload),
    onSuccess: () => {
      invalidate();
      toast({ title: "Option created" });
      setCreateOpen(false);
      setCreateDimension(null);
      setNewLabel("");
    },
    onError: (err: unknown) => {
      const message = err instanceof HttpError ? err.message : "Failed to create option";
      toast({ title: "Could not create option", description: message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: number;
      label?: string;
      isActive?: boolean;
      color?: string;
      icon?: string;
    }) => apiRequest("PATCH", `/api/roleplay-classifications/options/${id}`, body),
    onSuccess: () => {
      invalidate();
      toast({ title: "Option updated" });
      setEditTarget(null);
      setConfirmAction(null);
    },
    onError: (err: unknown) => {
      const message = err instanceof HttpError ? err.message : "Failed to update option";
      toast({ title: "Could not update option", description: message, variant: "destructive" });
    },
  });

  const reorderListMutation = useMutation({
    mutationFn: (payload: { dimensionSlug: string; orderedOptionIds: number[] }) =>
      apiRequest("PATCH", "/api/roleplay-classifications/options/reorder", payload),
    onMutate: async ({ dimensionSlug, orderedOptionIds }) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previous = queryClient.getQueryData<ClassificationsResponse>(QUERY_KEY);
      if (previous) {
        queryClient.setQueryData<ClassificationsResponse>(QUERY_KEY, {
          dimensions: previous.dimensions.map((dim) => {
            if (dim.slug !== dimensionSlug) return dim;
            const byId = new Map(dim.options.map((o) => [o.id, o]));
            const options = orderedOptionIds
              .map((id, index) => {
                const opt = byId.get(id);
                return opt ? { ...opt, sortOrder: index } : null;
              })
              .filter((opt): opt is ClassificationOption => opt != null);
            return { ...dim, options };
          }),
        });
      }
      return { previous };
    },
    onError: (err: unknown, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(QUERY_KEY, context.previous);
      }
      const message = err instanceof HttpError ? err.message : "Failed to reorder";
      toast({ title: "Could not reorder", description: message, variant: "destructive" });
    },
    onSettled: () => invalidate(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/roleplay-classifications/options/${id}`),
    onSuccess: () => {
      invalidate();
      toast({ title: "Option deleted" });
      setConfirmAction(null);
    },
    onError: (err: unknown) => {
      const message = err instanceof HttpError ? err.message : "Failed to delete option";
      toast({ title: "Could not delete option", description: message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-destructive">
        {error instanceof Error ? error.message : "Failed to load classifications"}
      </p>
    );
  }

  const dimensions = data?.dimensions ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <Tags className="mt-0.5 h-5 w-5 text-muted-foreground" />
        <div>
          <p className="font-medium">Scenario classifications</p>
          <p className="text-sm text-muted-foreground">
            Manage categories, tags, audience levels, and duration options used when browsing and
            authoring scenarios. Drag options to reorder.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {dimensions.map((dimension) => (
          <Collapsible key={dimension.id}>
            <div className="rounded-lg border">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{dimension.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {dimension.cardinality === "multi" ? "Multi" : "Single"}
                    </Badge>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="border-t px-4 py-3 space-y-2">
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => {
                        const defaults = defaultDisplayForDimension(dimension.slug);
                        setCreateDimension(dimension);
                        setNewLabel("");
                        setNewColor(defaults.color);
                        setNewIcon(defaults.icon);
                        setCreateOpen(true);
                      }}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add option
                    </Button>
                  </div>

                  {dimension.options.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">No options yet.</p>
                  ) : (
                    <ClassificationOptionList
                      options={dimension.options}
                      reorderPending={reorderListMutation.isPending}
                      onReorder={(orderedOptionIds) =>
                        reorderListMutation.mutate({
                          dimensionSlug: dimension.slug,
                          orderedOptionIds,
                        })
                      }
                      onEdit={(option) => {
                        setEditTarget(option);
                        setEditLabel(option.label);
                        setEditColor(option.color);
                        setEditIcon(option.icon);
                      }}
                      onDeactivateOrDelete={(option) =>
                        setConfirmAction({
                          type: option.isActive ? "deactivate" : "delete",
                          option,
                        })
                      }
                      onReactivate={(option) =>
                        updateMutation.mutate({ id: option.id, isActive: true })
                      }
                      reactivatePending={updateMutation.isPending}
                    />
                  )}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        ))}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add {createDimension?.name ?? "option"}</DialogTitle>
            <DialogDescription>
              A URL-friendly slug is generated automatically from the label.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-option-label">Label</Label>
              <Input
                id="new-option-label"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g. Customer Service"
              />
            </div>
            {createDimension && (
              <OptionDisplayFields
                dimensionSlug={createDimension.slug}
                color={newColor}
                icon={newIcon}
                onColorChange={setNewColor}
                onIconChange={setNewIcon}
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!newLabel.trim() || !createDimension || createMutation.isPending}
              onClick={() => {
                if (!createDimension) return;
                createMutation.mutate({
                  dimensionSlug: createDimension.slug,
                  label: newLabel.trim(),
                  color: newColor,
                  icon: newIcon,
                });
              }}
            >
              {createMutation.isPending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit option</DialogTitle>
            <DialogDescription>
              Slug <code className="text-xs">{editTarget?.slug}</code> cannot be changed after
              creation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-option-label">Label</Label>
              <Input
                id="edit-option-label"
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
              />
            </div>
            {editTarget && (
              <OptionDisplayFields
                dimensionSlug={
                  dimensions.find((d) => d.options.some((o) => o.id === editTarget.id))?.slug ?? "tags"
                }
                color={editColor}
                icon={editIcon}
                onColorChange={setEditColor}
                onIconChange={setEditIcon}
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>
              Cancel
            </Button>
            <Button
              disabled={!editLabel.trim() || !editTarget || updateMutation.isPending}
              onClick={() => {
                if (!editTarget) return;
                updateMutation.mutate({
                  id: editTarget.id,
                  label: editLabel.trim(),
                  color: editColor,
                  icon: editIcon,
                });
              }}
            >
              {updateMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmAction?.type === "delete" ? "Delete option?" : "Deactivate option?"}
            </DialogTitle>
            <DialogDescription>
              {confirmAction?.type === "delete" ? (
                <>Delete &ldquo;{confirmAction.option.label}&rdquo;? This cannot be undone.</>
              ) : confirmAction && confirmAction.option.usageCount > 0 ? (
                <>
                  Deactivate &ldquo;{confirmAction.option.label}&rdquo;? {confirmAction.option.usageCount}{" "}
                  scenario(s) still use this value. Existing scenarios keep the link but new
                  selections will hide it.
                </>
              ) : (
                <>Deactivate &ldquo;{confirmAction?.option.label}&rdquo;?</>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={updateMutation.isPending || deleteMutation.isPending}
              onClick={() => {
                if (!confirmAction) return;
                if (confirmAction.type === "delete") {
                  deleteMutation.mutate(confirmAction.option.id);
                } else {
                  updateMutation.mutate({ id: confirmAction.option.id, isActive: false });
                }
              }}
            >
              {confirmAction?.type === "delete" ? "Delete" : "Deactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
