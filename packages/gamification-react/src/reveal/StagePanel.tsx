import type { ComponentType, ReactNode } from "react";
import { cn } from "@heybray/ui/utils";

type StagePanelProps = {
  step: number;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  children: ReactNode;
  className?: string;
};

export function StagePanel({
  step,
  label,
  description,
  icon: Icon,
  children,
  className,
}: StagePanelProps) {
  return (
    <section
      className={cn(
        "flex flex-col min-h-0 rounded-xl border bg-card shadow-sm overflow-hidden",
        className,
      )}
    >
      <header className="shrink-0 border-b bg-muted/40 px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
            {step}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
              <h2 className="text-sm font-semibold tracking-tight">{label}</h2>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </div>
        </div>
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto p-4">{children}</div>
    </section>
  );
}
