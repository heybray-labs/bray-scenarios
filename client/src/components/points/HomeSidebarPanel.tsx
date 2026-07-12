import type { LucideIcon } from "lucide-react";
import { cn } from "@heybray/ui/utils";

type HomeSidebarPanelProps = {
  icon: LucideIcon;
  iconClassName?: string;
  title: string;
  subtitle?: string;
  className?: string;
  children: React.ReactNode;
};

export function HomeSidebarPanel({
  icon: Icon,
  iconClassName,
  title,
  subtitle,
  className,
  children,
}: HomeSidebarPanelProps) {
  return (
    <section
      className={cn(
        "rounded-2xl border bg-card p-4 shadow-sm",
        className,
      )}
    >
      <header className="shrink-0 mb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Icon className={cn("h-5 w-5 text-primary", iconClassName)} />
          </div>
          <div>
            <p className="font-semibold leading-tight">{title}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>
      </header>
      {children}
    </section>
  );
}
