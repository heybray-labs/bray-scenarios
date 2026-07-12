import { Lock, User } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScenarioDetailCard } from "./ScenarioDetailCard";
import { initialsFromName } from "@/lib/user-display";

type ScenarioDossierProps = {
  name?: string | null;
  roleTitle?: string | null;
  personalityTraits?: string | null;
  hasHiddenObjective?: boolean;
  className?: string;
};

export function ScenarioDossier({
  name,
  roleTitle,
  personalityTraits,
  hasHiddenObjective,
  className,
}: ScenarioDossierProps) {
  if (!name?.trim() && !roleTitle?.trim()) return null;

  const displayName = name?.trim() || "Contact";
  const traits = personalityTraits
    ? personalityTraits
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  return (
    <ScenarioDetailCard
      icon={<User />}
      title="Who you'll meet"
      className={className}
    >
      <div className="flex items-start gap-3">
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
            {initialsFromName(displayName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="font-semibold text-sm">{displayName}</p>
          {roleTitle?.trim() && (
            <p className="text-sm text-muted-foreground mt-0.5">{roleTitle.trim()}</p>
          )}
        </div>
      </div>

      {traits.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border/50">
          <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
            Intel
          </div>
          <div className="flex flex-wrap gap-1.5">
            {traits.map((trait) => (
              <Badge key={trait} variant="secondary" className="font-normal text-xs rounded-full">
                {trait}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {hasHiddenObjective && (
        <div className="mt-4 flex gap-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3 py-2.5 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5 shrink-0 text-primary mt-0.5" />
          <span>
            <span className="font-medium text-foreground">{displayName}</span> has a hidden
            objective — uncover it in conversation.
          </span>
        </div>
      )}
    </ScenarioDetailCard>
  );
}
