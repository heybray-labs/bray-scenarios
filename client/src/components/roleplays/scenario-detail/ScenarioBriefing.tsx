import { FileText } from "lucide-react";
import { ScenarioDetailCard } from "./ScenarioDetailCard";
import { cn } from "@/lib/utils";

type ScenarioBriefingProps = {
  introduction?: string | null;
  situationContext?: string | null;
  learnerRole?: string | null;
  learnerObjective?: string | null;
  showLearnerObjective: boolean;
  className?: string;
};

export function ScenarioBriefing({
  introduction,
  situationContext,
  learnerRole,
  learnerObjective,
  showLearnerObjective,
  className,
}: ScenarioBriefingProps) {
  const hasContent =
    introduction?.trim() ||
    situationContext?.trim() ||
    (showLearnerObjective && learnerObjective?.trim()) ||
    learnerRole?.trim();

  if (!hasContent) return null;

  return (
    <ScenarioDetailCard icon={<FileText />} title="Briefing" className={className}>
      {introduction?.trim() && (
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{introduction.trim()}</p>
      )}

      {situationContext?.trim() && (
        <p
          className={cn(
            "text-sm leading-relaxed whitespace-pre-wrap",
            introduction?.trim() && "mt-4",
          )}
        >
          {situationContext.trim()}
        </p>
      )}

      {showLearnerObjective && learnerObjective?.trim() && (
        <p className="text-sm leading-relaxed whitespace-pre-wrap mt-3">
          <span className="font-semibold">Your objective: </span>
          {learnerObjective.trim()}
        </p>
      )}

      {learnerRole?.trim() && (
        <div className="text-sm leading-relaxed pt-3 mt-3 border-t border-border/50">
          Your role: <strong className="font-semibold text-foreground">{learnerRole.trim()}</strong>
        </div>
      )}
    </ScenarioDetailCard>
  );
}
