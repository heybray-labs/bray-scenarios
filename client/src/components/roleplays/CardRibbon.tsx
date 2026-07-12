import { cn } from "@heybray/ui/utils";

export function CardRibbon({
  variant,
  children,
  className,
}: {
  variant: "new" | "progress" | "featured";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "absolute top-2.5 left-0 z-10 text-[10px] font-bold tracking-wide uppercase",
        "px-2 py-0.5 rounded-r text-white",
        variant === "new" || variant === "featured"
          ? "bg-primary"
          : "bg-warning",
        className,
      )}
    >
      {children}
    </span>
  );
}
