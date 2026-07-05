import { ClassificationChip } from "@/components/classifications/ClassificationChip";
import { classificationChipStyle } from "@/lib/classification-display";
import { cn } from "@/lib/utils";
import type { ScenarioClassifications } from "@/components/roleplays/scenario-detail/types";

function formatDifficulty(difficulty: string): string {
  const label = difficulty.trim();
  if (!label) return label;
  return label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();
}

function difficultyColor(difficulty: string): string {
  switch (difficulty.toLowerCase()) {
    case "easy":
      return "#059669";
    case "hard":
      return "#ea580c";
    case "medium":
    default:
      return "#0284c7";
  }
}

type ScenarioMetadataChipsProps = {
  difficulty?: string | null;
  classifications?: ScenarioClassifications | null;
  className?: string;
};

export function ScenarioMetadataChips({
  difficulty,
  classifications,
  className,
}: ScenarioMetadataChipsProps) {
  const difficultyLabel = difficulty?.trim() ? formatDifficulty(difficulty) : null;
  const category = classifications?.category ?? null;
  const audienceLevel = classifications?.audienceLevel ?? null;
  const duration = classifications?.duration ?? null;
  const tags = classifications?.tags ?? [];

  const hasAny =
    difficultyLabel || category || audienceLevel || duration || tags.length > 0;

  if (!hasAny) return null;

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {category && (
        <ClassificationChip
          label={category.label}
          color={category.color}
          icon={category.icon}
        />
      )}
      {audienceLevel && (
        <ClassificationChip
          label={audienceLevel.label}
          color={audienceLevel.color}
          icon={audienceLevel.icon}
        />
      )}
      {difficultyLabel && (
        <span
          className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium shadow-sm"
          style={classificationChipStyle(difficultyColor(difficulty!))}
        >
          {difficultyLabel}
        </span>
      )}
      {duration && (
        <ClassificationChip
          label={duration.label}
          color={duration.color}
          icon={duration.icon}
        />
      )}
      {tags.map((tag) => (
        <ClassificationChip
          key={tag.slug ?? tag.label}
          label={tag.label}
          color={tag.color}
          icon={tag.icon}
        />
      ))}
    </div>
  );
}
