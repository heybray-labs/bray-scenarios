import { ClassificationChip } from "@heybray/react/classifications/ClassificationChip";
import { DifficultyPill } from "../../../components/classifications/DifficultyPill";
import { RewardTierLabel } from "@heybray/gamification-react/points/RewardTierLabel";
import { classificationChipStyle } from "@heybray/react/lib/classification-display";
import { cn } from "@heybray/ui/utils";
import type { ScenarioClassifications } from "../../../components/roleplays/scenario-detail/types";

type AchievedTier = {
  tierName: string;
  starLevel: number;
  color: string;
};

type ScenarioMetadataChipsProps = {
  difficulty?: string | null;
  classifications?: ScenarioClassifications | null;
  variant?: "inline" | "overlay";
  achievedTier?: AchievedTier | null;
  maxTags?: number;
  className?: string;
};

export function ScenarioMetadataChips({
  difficulty,
  classifications,
  variant = "inline",
  achievedTier,
  maxTags,
  className,
}: ScenarioMetadataChipsProps) {
  const category = classifications?.category ?? null;
  const audienceLevel = classifications?.audienceLevel ?? null;
  const duration = classifications?.duration ?? null;
  const tags = classifications?.tags ?? [];
  const displayTags = maxTags != null ? tags.slice(0, maxTags) : tags;
  const overlay = variant === "overlay";

  const hasAny =
    difficulty?.trim() ||
    category ||
    audienceLevel ||
    duration ||
    displayTags.length > 0 ||
    achievedTier;

  if (!hasAny) return null;

  const difficultyVariant = overlay ? "hero" : "inline";

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {category && (
        <ClassificationChip
          label={category.label}
          color={category.color}
          icon={category.icon}
          overlay={overlay}
        />
      )}
      {audienceLevel && (
        <ClassificationChip
          label={audienceLevel.label}
          color={audienceLevel.color}
          icon={audienceLevel.icon}
          overlay={overlay}
        />
      )}
      {difficulty?.trim() && (
        <DifficultyPill difficulty={difficulty} variant={difficultyVariant} />
      )}
      {duration && (
        <ClassificationChip
          label={duration.label}
          color={duration.color}
          icon={duration.icon}
          overlay={overlay}
        />
      )}
      {displayTags.map((tag) => (
        <ClassificationChip
          key={tag.slug ?? tag.label}
          label={tag.label}
          color={tag.color}
          icon={tag.icon}
          overlay={overlay}
        />
      ))}
      {achievedTier && (
        <span
          className={cn(
            overlay
              ? "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium shadow-sm text-white"
              : "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium shadow-sm",
          )}
          style={classificationChipStyle(achievedTier.color)}
        >
          <RewardTierLabel
            compact
            tierName={achievedTier.tierName}
            starLevel={achievedTier.starLevel}
            color={achievedTier.color}
          />
        </span>
      )}
    </div>
  );
}
