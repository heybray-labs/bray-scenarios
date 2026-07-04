import type { ReactNode } from "react";
import { ClassificationChip } from "@/components/classifications/ClassificationChip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { classificationChipStyle } from "@/lib/classification-display";
import { cn } from "@/lib/utils";

export type ScenarioClassificationRef = {
  slug?: string;
  label: string;
  color: string;
  icon: string;
};

export type ScenarioClassifications = {
  category?: ScenarioClassificationRef | null;
  audienceLevel?: ScenarioClassificationRef | null;
  duration?: ScenarioClassificationRef | null;
  tags?: ScenarioClassificationRef[];
};

type ScenarioMetadataProps = {
  difficulty?: string | null;
  classifications?: ScenarioClassifications | null;
  className?: string;
};

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

function MetadataSection({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  if (!children) return null;

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

export function ScenarioMetadata({
  difficulty,
  classifications,
  className,
}: ScenarioMetadataProps) {
  const difficultyLabel = difficulty?.trim() ? formatDifficulty(difficulty) : null;
  const category = classifications?.category ?? null;
  const audienceLevel = classifications?.audienceLevel ?? null;
  const duration = classifications?.duration ?? null;
  const tags = classifications?.tags ?? [];

  const hasAny =
    difficultyLabel || category || audienceLevel || duration || tags.length > 0;

  if (!hasAny) return null;

  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Scenario details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <MetadataSection label="Category">
          {category && (
            <ClassificationChip
              label={category.label}
              color={category.color}
              icon={category.icon}
            />
          )}
        </MetadataSection>

        <MetadataSection label="Audience">
          {audienceLevel && (
            <ClassificationChip
              label={audienceLevel.label}
              color={audienceLevel.color}
              icon={audienceLevel.icon}
            />
          )}
        </MetadataSection>

        <MetadataSection label="Difficulty">
          {difficultyLabel && (
            <span
              className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium shadow-sm"
              style={classificationChipStyle(difficultyColor(difficulty!))}
            >
              {difficultyLabel}
            </span>
          )}
        </MetadataSection>

        <MetadataSection label="Duration">
          {duration && (
            <ClassificationChip
              label={duration.label}
              color={duration.color}
              icon={duration.icon}
            />
          )}
        </MetadataSection>

        <MetadataSection label="Tags">
          {tags.length > 0 &&
            tags.map((tag) => (
              <ClassificationChip
                key={tag.slug ?? tag.label}
                label={tag.label}
                color={tag.color}
                icon={tag.icon}
              />
            ))}
        </MetadataSection>
      </CardContent>
    </Card>
  );
}
