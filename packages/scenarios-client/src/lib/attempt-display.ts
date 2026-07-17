type StartAttemptLabelParams = {
  isOutOfAttempts: boolean;
  hasUnlimited: boolean;
  attemptCount: number;
  maxAttempts: number | null;
  startPending: boolean;
};

export function getStartAttemptLabel({
  isOutOfAttempts,
  hasUnlimited,
  attemptCount,
  maxAttempts,
  startPending,
}: StartAttemptLabelParams): string {
  if (isOutOfAttempts) return "No attempts remaining";
  if (hasUnlimited) return startPending ? "Starting…" : "Start roleplay";
  const nextAttemptNumber = attemptCount + 1;
  if (startPending) return "Starting…";
  return `Start attempt ${nextAttemptNumber} of ${maxAttempts}`;
}
