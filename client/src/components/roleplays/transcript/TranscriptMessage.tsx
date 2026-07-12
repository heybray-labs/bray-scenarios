import { FaUser } from "react-icons/fa";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type TranscriptMessageProps = {
  isLearner: boolean;
  content: ReactNode;
  learnerInitials: string;
};

export function TranscriptMessage({
  isLearner,
  content,
  learnerInitials,
}: TranscriptMessageProps) {
  return (
    <div
      className={cn(
        "flex items-end gap-2",
        isLearner ? "justify-end" : "justify-start",
      )}
    >
      {!isLearner && (
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="bg-muted text-muted-foreground">
            <FaUser className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      )}
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap",
          isLearner
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-muted rounded-bl-sm",
        )}
      >
        {content}
      </div>
      {isLearner && (
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="bg-primary text-primary-foreground text-xs">
            {learnerInitials}
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
