import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type ScenarioDetailCardProps = {
  icon?: ReactNode;
  title: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
};

export function ScenarioDetailCard({
  icon,
  title,
  children,
  className,
  bodyClassName,
}: ScenarioDetailCardProps) {
  return (
    <div className={cn("rounded-xl border bg-card shadow-sm overflow-hidden", className)}>
      <header className="shrink-0 border-b bg-muted/40 px-4 py-3">
        <div className="flex items-center gap-2">
          {icon && (
            <span className="text-muted-foreground shrink-0 [&_svg]:h-4 [&_svg]:w-4">{icon}</span>
          )}
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        </div>
      </header>
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </div>
  );
}
