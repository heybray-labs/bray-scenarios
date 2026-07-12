import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, PlayCircle } from "lucide-react";
import { AttemptPips } from "./AttemptPips";

type FinalAttemptDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attemptNumber: number;
  maxAttempts: number;
  usedCount: number;
  bestScore: number | null;
  tierContext: string | null;
  startPending: boolean;
  onConfirm: () => void;
};

export function FinalAttemptDialog({
  open,
  onOpenChange,
  attemptNumber,
  maxAttempts,
  usedCount,
  bestScore,
  tierContext,
  startPending,
  onConfirm,
}: FinalAttemptDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
            Start your final attempt?
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 text-sm text-muted-foreground pt-1">
              <p>
                This is attempt <strong className="text-foreground">{attemptNumber} of {maxAttempts}</strong>.
                After this run, your best score of{" "}
                <strong className="text-foreground">
                  {bestScore != null ? `${Math.round(bestScore)}%` : "—"}
                </strong>{" "}
                stands.
                {tierContext && <> {tierContext}</>}
              </p>
              <AttemptPips maxAttempts={maxAttempts} usedCount={usedCount} />
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={startPending}>
            Not yet
          </Button>
          <Button onClick={onConfirm} disabled={startPending}>
            <PlayCircle className="h-4 w-4 mr-2" />
            {startPending ? "Starting…" : "Use final attempt"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
