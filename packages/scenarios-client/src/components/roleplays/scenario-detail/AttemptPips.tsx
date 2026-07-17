import { cn } from "@heybray/ui/utils";

type AttemptPipsProps = {
  maxAttempts: number;
  usedCount: number;
  className?: string;
  labelClassName?: string;
};

export function AttemptPips({ maxAttempts, usedCount, className, labelClassName }: AttemptPipsProps) {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <span className={cn("text-xs text-muted-foreground mr-0.5", labelClassName)}>Attempts</span>
      {Array.from({ length: maxAttempts }, (_, i) => {
        const isUsed = i < usedCount;
        const isRemaining = !isUsed;
        return (
          <span
            key={i}
            className={cn(
              "h-2.5 w-2.5 rounded-full border",
              isUsed && "bg-muted border-border",
              isRemaining && "bg-primary border-primary ring-2 ring-primary/20",
            )}
            aria-hidden
          />
        );
      })}
    </div>
  );
}
