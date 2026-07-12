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
import { Button } from "@heybray/ui/components/button";
import { Badge } from "@heybray/ui/components/badge";
import { ClassificationChip } from "@/components/classifications/ClassificationChip";
import { GripVertical, Pencil, Trash2 } from "lucide-react";
import { cn } from "@heybray/ui/utils";

export type ClassificationOptionRow = {
  id: number;
  slug: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
  usageCount: number;
  color: string;
  icon: string;
};

type ClassificationOptionListProps = {
  options: ClassificationOptionRow[];
  onReorder: (orderedOptionIds: number[]) => void;
  reorderPending?: boolean;
  onEdit: (option: ClassificationOptionRow) => void;
  onDeactivateOrDelete: (option: ClassificationOptionRow) => void;
  onReactivate: (option: ClassificationOptionRow) => void;
  reactivatePending?: boolean;
};

type SortableOptionRowProps = {
  option: ClassificationOptionRow;
  reorderDisabled: boolean;
  onEdit: (option: ClassificationOptionRow) => void;
  onDeactivateOrDelete: (option: ClassificationOptionRow) => void;
  onReactivate: (option: ClassificationOptionRow) => void;
  reactivatePending: boolean;
};

function SortableOptionRow({
  option,
  reorderDisabled,
  onEdit,
  onDeactivateOrDelete,
  onReactivate,
  reactivatePending,
}: SortableOptionRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: option.id,
    disabled: reorderDisabled,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "flex items-center gap-2 px-2 py-2 text-sm",
        !option.isActive && !isDragging && "opacity-60",
        isDragging && "relative z-10 bg-muted/40 opacity-80 shadow-sm",
      )}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        {...attributes}
        {...listeners}
        disabled={reorderDisabled}
        className={cn(
          "inline-flex shrink-0 touch-none rounded p-1 text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          reorderDisabled ? "cursor-not-allowed opacity-50" : "cursor-grab active:cursor-grabbing",
        )}
        aria-label={`Drag to reorder ${option.label}`}
      >
        <GripVertical className="h-4 w-4" aria-hidden />
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <ClassificationChip
              label={option.label}
              color={option.color}
              icon={option.icon}
            />
            {!option.isActive && (
              <Badge variant="outline" className="text-xs">
                Inactive
              </Badge>
            )}
          </div>
          <span className="text-xs text-muted-foreground">{option.slug}</span>
        </div>
      </div>

      <span className="whitespace-nowrap text-xs text-muted-foreground">
        {option.usageCount} used
      </span>

      <div className="flex items-center gap-1">
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={() => onEdit(option)}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={() => onDeactivateOrDelete(option)}
          disabled={!option.isActive && option.usageCount > 0}
        >
          {option.isActive ? (
            <span className="px-1 text-xs">Off</span>
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </Button>
        {!option.isActive && (
          <Button
            size="sm"
            variant="ghost"
            disabled={reactivatePending}
            onClick={() => onReactivate(option)}
          >
            Reactivate
          </Button>
        )}
      </div>
    </div>
  );
}

export function ClassificationOptionList({
  options,
  onReorder,
  reorderPending = false,
  onEdit,
  onDeactivateOrDelete,
  onReactivate,
  reactivatePending = false,
}: ClassificationOptionListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = options.findIndex((option) => option.id === active.id);
    const newIndex = options.findIndex((option) => option.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const next = arrayMove(options, oldIndex, newIndex);
    onReorder(next.map((option) => option.id));
  };

  const optionIds = options.map((option) => option.id);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={optionIds} strategy={verticalListSortingStrategy}>
        <div className="divide-y rounded-md border">
          {options.map((option) => (
            <SortableOptionRow
              key={option.id}
              option={option}
              reorderDisabled={reorderPending}
              onEdit={onEdit}
              onDeactivateOrDelete={onDeactivateOrDelete}
              onReactivate={onReactivate}
              reactivatePending={reactivatePending}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
