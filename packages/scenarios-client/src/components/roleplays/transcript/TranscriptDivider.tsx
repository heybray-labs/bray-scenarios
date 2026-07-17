import { Flag } from "lucide-react";

type TranscriptDividerProps = {
  label: string;
};

export function TranscriptDivider({ label }: TranscriptDividerProps) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="h-px flex-1 bg-border" />
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Flag className="h-3.5 w-3.5" />
        {label}
      </span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}
