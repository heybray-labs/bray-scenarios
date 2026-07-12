import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { Button } from "@heybray/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@heybray/ui/components/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@heybray/ui/hooks/use-toast";
import { cn } from "@heybray/ui/utils";

type FeaturedManageItem = {
  roleplayId: number;
  sortOrder: number;
  title: string;
  status: string;
};

function SortableFeaturedRow({
  item,
  onRemove,
}: {
  item: FeaturedManageItem;
  onRemove: (roleplayId: number) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.roleplayId });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "flex items-center gap-2 rounded-lg border bg-card px-3 py-2",
        isDragging && "opacity-70 shadow-md",
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        className="text-muted-foreground hover:text-foreground"
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${item.title}`}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{item.title}</p>
        <p className="text-xs text-muted-foreground capitalize">{item.status}</p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={() => onRemove(item.roleplayId)}
        aria-label={`Remove ${item.title} from featured`}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function FeaturedScenariosPanel() {
  const { toast } = useToast();
  const [localItems, setLocalItems] = useState<FeaturedManageItem[] | null>(null);
  const [addSelection, setAddSelection] = useState<string>("");

  const { data, isLoading } = useQuery<{ items: FeaturedManageItem[] }>({
    queryKey: ["/api/roleplays/featured/manage"],
    queryFn: () => apiRequest("GET", "/api/roleplays/featured/manage"),
  });

  const { data: publishedList } = useQuery<{ items: Array<{ id: number; title: string; status: string }> }>({
    queryKey: ["/api/roleplays/published-picker"],
    queryFn: () => apiRequest("GET", "/api/roleplays?limit=100&page=1"),
  });

  const items = localItems ?? data?.items ?? [];

  const saveMutation = useMutation({
    mutationFn: (roleplayIds: number[]) =>
      apiRequest("PUT", "/api/roleplays/featured/manage", { roleplayIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roleplays/featured/manage"] });
      queryClient.invalidateQueries({ queryKey: ["/api/roleplays/featured"] });
      setLocalItems(null);
      toast({ title: "Homepage featured scenarios saved" });
    },
    onError: (error: Error) => {
      toast({
        title: "Save failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const featuredIds = useMemo(() => new Set(items.map((item) => item.roleplayId)), [items]);

  const addableOptions =
    publishedList?.items.filter(
      (rp) => rp.status === "published" && !featuredIds.has(rp.id),
    ) ?? [];

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((item) => item.roleplayId === active.id);
    const newIndex = items.findIndex((item) => item.roleplayId === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    setLocalItems(arrayMove(items, oldIndex, newIndex));
  };

  const handleAdd = () => {
    const id = parseInt(addSelection, 10);
    if (Number.isNaN(id)) return;
    const candidate = addableOptions.find((rp) => rp.id === id);
    if (!candidate) return;
    setLocalItems([
      ...items,
      {
        roleplayId: candidate.id,
        sortOrder: items.length,
        title: candidate.title,
        status: candidate.status,
      },
    ]);
    setAddSelection("");
  };

  const handleRemove = (roleplayId: number) => {
    setLocalItems(items.filter((item) => item.roleplayId !== roleplayId));
  };

  const handleSave = () => {
    saveMutation.mutate(items.map((item) => item.roleplayId));
  };

  const isDirty =
    localItems != null &&
    JSON.stringify(localItems.map((item) => item.roleplayId)) !==
      JSON.stringify((data?.items ?? []).map((item) => item.roleplayId));

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading featured scenarios…</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Homepage hero carousel</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Choose published scenarios to rotate in the cinema banner on the homepage. Order
          determines rotation sequence.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <Select value={addSelection} onValueChange={setAddSelection}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Add published scenario…" />
          </SelectTrigger>
          <SelectContent>
            {addableOptions.map((rp) => (
              <SelectItem key={rp.id} value={String(rp.id)}>
                {rp.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" variant="outline" disabled={!addSelection} onClick={handleAdd}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground rounded-lg border border-dashed p-6 text-center">
          No featured scenarios yet. Add published scenarios to populate the homepage hero.
        </p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={items.map((item) => item.roleplayId)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {items.map((item) => (
                <SortableFeaturedRow key={item.roleplayId} item={item} onRemove={handleRemove} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <div className="flex justify-end">
        <Button
          type="button"
          disabled={!isDirty || saveMutation.isPending}
          onClick={handleSave}
        >
          {saveMutation.isPending ? "Saving…" : "Save featured lineup"}
        </Button>
      </div>
    </div>
  );
}
