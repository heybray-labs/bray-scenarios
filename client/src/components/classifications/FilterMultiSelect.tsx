import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type FilterOption = {
  value: string;
  label: string;
};

type FilterMultiSelectProps = {
  placeholder: string;
  options: FilterOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  className?: string;
  compact?: boolean;
};

function buildSummary(
  placeholder: string,
  options: FilterOption[],
  selected: string[],
  compact: boolean,
) {
  if (selected.length === 0) return placeholder;
  if (selected.length === 1) {
    return options.find((o) => o.value === selected[0])?.label ?? "1 selected";
  }
  return compact ? `${placeholder} (${selected.length})` : `${selected.length} selected`;
}

export function FilterMultiSelect({
  placeholder,
  options,
  selected,
  onChange,
  className,
  compact = false,
}: FilterMultiSelectProps) {
  const toggle = (value: string) => {
    onChange(
      selected.includes(value)
        ? selected.filter((s) => s !== value)
        : [...selected, value],
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
          compact ? "w-[140px]" : "w-[180px]",
        )}
      >
        {options.map((opt) => (
          <DropdownMenuCheckboxItem
            key={opt.value}
            compact={compact}
            checked={selected.includes(opt.value)}
            onCheckedChange={() => toggle(opt.value)}
            onSelect={(e) => e.preventDefault()}
          >
            {opt.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
