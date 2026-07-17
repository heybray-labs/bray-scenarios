import { TranscriptDivider } from "./TranscriptDivider";
import { TranscriptMessage } from "./TranscriptMessage";
import type { TranscriptMessageItem } from "./types";
import type { ReactNode } from "react";

type TranscriptThreadProps = {
  messages: TranscriptMessageItem[];
  learnerInitials: string;
  showTranscript?: boolean;
  unavailableMessage?: string;
  emptyMessage?: string | null;
  renderEmptyPersonaContent?: () => ReactNode;
  className?: string;
};

export function TranscriptThread({
  messages,
  learnerInitials,
  showTranscript = true,
  unavailableMessage = "Transcript is not available for this roleplay.",
  emptyMessage = "No messages in this attempt.",
  renderEmptyPersonaContent,
  className,
}: TranscriptThreadProps) {
  if (!showTranscript) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        {unavailableMessage}
      </p>
    );
  }

  const visibleMessages = messages.filter(
    (m) => m.role === "persona" || m.role === "learner" || m.role === "ended",
  );

  if (visibleMessages.length === 0) {
    if (emptyMessage == null) return null;
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className={className ?? "space-y-3"}>
      {visibleMessages.map((m) => {
        if (m.role === "ended") {
          return <TranscriptDivider key={m.id} label={m.content} />;
        }

        const isLearner = m.role === "learner";
        const content =
          m.content ||
          (!isLearner && renderEmptyPersonaContent ? renderEmptyPersonaContent() : m.content);

        return (
          <TranscriptMessage
            key={m.id}
            isLearner={isLearner}
            content={content}
            learnerInitials={learnerInitials}
          />
        );
      })}
    </div>
  );
}
