import { ScenarioMetadataChips } from "@/components/roleplays/scenario-detail/ScenarioMetadataChips";
import type { ScenarioClassifications } from "@/components/roleplays/scenario-detail/types";

export type { ScenarioClassificationRef, ScenarioClassifications } from "@/components/roleplays/scenario-detail/types";

type ScenarioMetadataProps = {
  difficulty?: string | null;
  classifications?: ScenarioClassifications | null;
  className?: string;
};

/** @deprecated Prefer ScenarioMetadataChips in the detail page header. */
export function ScenarioMetadata({
  difficulty,
  classifications,
  className,
}: ScenarioMetadataProps) {
  return (
    <ScenarioMetadataChips
      difficulty={difficulty}
      classifications={classifications}
      className={className}
    />
  );
}
