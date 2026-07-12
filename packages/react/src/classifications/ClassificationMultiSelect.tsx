import { ChevronDown } from "lucide-react";
import { ClassificationOptionLabel } from "./ClassificationOptionLabel.tsx";
import { Button } from "@heybray/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@heybray/ui/components/dropdown-menu";
import { cn } from "@heybray/ui/utils";

export type ClassificationSelectOption = {
  slug: string;
  label: string;
  color: string;
  icon: string;
};

type ClassificationMultiSelectProps = {
  placeholder: string;
  options: ClassificationSelectOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  className?: string;
  compact?: boolean;
};

function buildSummary(
  placeholder: string,
  options: ClassificationSelectOption[],
  selected: string[],
  compact: boolean,
) {
  if (selected.length === 0) return placeholder;
  if (selected.length === 1) {
    return options.find((o) => o.slug === selected[0])?.label ?? "1 selected";
  }
  return compact ? `${placeholder} (${selected.length})` : `${selected.length} selected`;
}

export function ClassificationMultiSelect({
  placeholder,
  options,
  selected,
  onChange,
  className,
  compact = false,
}: ClassificationMultiSelectProps) {
  const toggle = (slug: string) => {
    onChange(
      selected.includes(slug)
        ? selected.filter((s) => s !== slug)
        : [...selected, slug],
    );
  };

  const summary = buildSummary(placeholder, options, selected, compact);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size={compact ? "sm" : "default"}
          className={cn(
            "min-w-0 justify-between font-normal hover:text-foreground data-[state=open]:text-foreground",
            compact && "h-8 gap-1 px-2 text-xs",
            className,
          )}
        >
          <span className="truncate">{summary}</span>
          <ChevronDown
            className={cn("shrink-0 opacity-50", compact ? "h-3 w-3" : "h-4 w-4")}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className={cn(
          "max-h-64 overflow-y-auto",
          compact ? "w-[200px]" : "w-[220px]",
        )}
      >
        {options.map((opt) => (
          <DropdownMenuCheckboxItem
            key={opt.slug}
            compact={compact}
            checked={selected.includes(opt.slug)}
            onCheckedChange={() => toggle(opt.slug)}
            onSelect={(e) => e.preventDefault()}
          >
            <ClassificationOptionLabel
              label={opt.label}
              color={opt.color}
              icon={opt.icon}
              compact={compact}
            />
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
