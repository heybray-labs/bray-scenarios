import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@heybray/ui/components/select";
import { Label } from "@heybray/ui/components/label";
import { Input } from "@heybray/ui/components/input";
import { resolveLucideIcon } from "../lib/classification-display.ts";
import {
  CLASSIFICATION_ICON_OPTIONS,
  DIMENSION_DISPLAY_DEFAULTS,
  FALLBACK_OPTION_DISPLAY,
} from "@heybray/taxonomy/schema";

type OptionDisplayFieldsProps = {
  dimensionSlug: string;
  color: string;
  icon: string;
  onColorChange: (color: string) => void;
  onIconChange: (icon: string) => void;
};

export function OptionDisplayFields({
  dimensionSlug,
  color,
  icon,
  onColorChange,
  onIconChange,
}: OptionDisplayFieldsProps) {
  const dimDefault = DIMENSION_DISPLAY_DEFAULTS[dimensionSlug] ?? FALLBACK_OPTION_DISPLAY;
  const IconPreview = resolveLucideIcon(icon);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="option-color">Color</Label>
        <div className="flex items-center gap-2">
          <Input
            id="option-color"
            type="color"
            value={color}
            onChange={(e) => onColorChange(e.target.value)}
            className="h-10 w-14 cursor-pointer p-1"
          />
          <Input
            value={color}
            onChange={(e) => onColorChange(e.target.value)}
            placeholder={dimDefault.color}
            className="font-mono text-sm"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="option-icon">Icon</Label>
        <Select value={icon} onValueChange={onIconChange}>
          <SelectTrigger id="option-icon">
            <SelectValue placeholder="Select icon">
              <span className="flex items-center gap-2">
                <IconPreview className="h-4 w-4" />
                {icon}
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="max-h-60">
            {CLASSIFICATION_ICON_OPTIONS.map((name) => {
              const ItemIcon = resolveLucideIcon(name);
              return (
                <SelectItem key={name} value={name}>
                  <span className="flex items-center gap-2">
                    <ItemIcon className="h-4 w-4" />
                    {name}
                  </span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export function defaultDisplayForDimension(dimensionSlug: string) {
  return DIMENSION_DISPLAY_DEFAULTS[dimensionSlug] ?? FALLBACK_OPTION_DISPLAY;
}
