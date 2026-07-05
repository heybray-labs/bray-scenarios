import type { ComponentType, ReactNode } from "react";
import { Route, Target, User, Briefcase } from "lucide-react";
import { ClockFading } from "@/components/icons/roleplay-field-icons";
import { cn } from "@/lib/utils";

type ScenarioNarrativeProps = {
  learnerRole?: string | null;
  situationContext?: string | null;
  introduction?: string | null;
  learnerObjective?: string | null;
  personaName?: string | null;
  personaRoleTitle?: string | null;
  className?: string;
};

function NarrativeSection({
  icon: Icon,
  title,
  children,
  className,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("border-b border-border/50 pb-8 last:border-0 last:pb-0", className)}>
      <h2 className="text-base font-semibold mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
        {title}
      </h2>
      {children}
    </section>
  );
}

export function ScenarioNarrative({
  learnerRole,
  situationContext,
  introduction,
  learnerObjective,
  personaName,
  personaRoleTitle,
  className,
}: ScenarioNarrativeProps) {
  const hasContent =
    learnerRole ||
    situationContext ||
    introduction ||
    learnerObjective ||
    personaName ||
    personaRoleTitle;

  if (!hasContent) return null;

  return (
    <div className={cn("space-y-8", className)}>
      {learnerRole && (
        <NarrativeSection icon={Briefcase} title="Your role">
          <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
            {learnerRole}
          </p>
        </NarrativeSection>
      )}
      {situationContext && (
        <NarrativeSection icon={Route} title="Context">
          <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
            {situationContext}
          </p>
        </NarrativeSection>
      )}
      {introduction && (
        <NarrativeSection icon={ClockFading} title="Current situation">
          <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
            {introduction}
          </p>
        </NarrativeSection>
      )}
      {learnerObjective && (
        <NarrativeSection icon={Target} title="Your objective">
          <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
            {learnerObjective}
          </p>
        </NarrativeSection>
      )}
      {(personaName || personaRoleTitle) && (
        <NarrativeSection icon={User} title="Who you'll meet">
          <div className="text-sm text-muted-foreground leading-relaxed">
            {personaName && <p className="font-medium text-foreground">{personaName}</p>}
            {personaRoleTitle && <p>{personaRoleTitle}</p>}
          </div>
        </NarrativeSection>
      )}
    </div>
  );
}
