import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Copy, MoreVertical, Pencil, Trash2 } from "lucide-react";
import {
  ScenarioMetadataChips,
} from "@/components/roleplays/scenario-detail/ScenarioMetadataChips";
import type { ScenarioClassifications } from "@/components/roleplays/scenario-detail/types";

type ScenarioDetailHeaderProps = {
  title: string;
  description?: string | null;
  difficulty?: string | null;
  classifications?: ScenarioClassifications | null;
  canManage: boolean;
  isPublished: boolean;
  publishPending: boolean;
  duplicating: boolean;
  onPublishChange: (published: boolean) => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
};

export function ScenarioDetailHeader({
  title,
  description,
  difficulty,
  classifications,
  canManage,
  isPublished,
  publishPending,
  duplicating,
  onPublishChange,
  onEdit,
  onDuplicate,
  onDelete,
}: ScenarioDetailHeaderProps) {
  return (
    <div className="mb-6 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">{title}</h1>
          {description && (
            <p className="text-muted-foreground mt-1">{description}</p>
          )}
        </div>
        {canManage && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <div className="px-2 py-1.5 flex items-center gap-2">
                <Switch
                  checked={isPublished}
                  onCheckedChange={onPublishChange}
                  disabled={publishPending}
                />
                <span className="text-sm">Published</span>
              </div>
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="h-4 w-4 mr-2" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem disabled={duplicating} onClick={onDuplicate}>
                <Copy className="h-4 w-4 mr-2" />
                {duplicating ? "Duplicating…" : "Duplicate"}
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onClick={onDelete}>
                <Trash2 className="h-4 w-4 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <ScenarioMetadataChips
        difficulty={difficulty}
        classifications={classifications}
      />
    </div>
  );
}
