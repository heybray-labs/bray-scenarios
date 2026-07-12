const TRUTHY = new Set(["1", "true", "yes", "on"]);

const CHEAT_DIRECTIVE_PATTERN = /CHEAT\s*MODE\s*:\s*([\s\S]+)/i;

export function isCheatModeEnabled(): boolean {
  const raw = process.env.CHEAT_MODE?.trim().toLowerCase();
  return raw != null && TRUTHY.has(raw);
}

/** Extract the directive after "CHEAT MODE:" from a single text field. */
export function extractCheatDirective(text: string | null | undefined): string | null {
  if (!text?.trim()) return null;
  const match = text.match(CHEAT_DIRECTIVE_PATTERN);
  const directive = match?.[1]?.trim();
  return directive || null;
}

export function isCheatModeMessage(text: string | null | undefined): boolean {
  return extractCheatDirective(text) != null;
}

/** Find the first CHEAT MODE directive in learner conversation messages. */
export function findCheatDirectiveInMessages(
  messages: Array<{ role: string; content: string }>,
): string | null {
  for (const message of messages) {
    if (message.role !== "learner") continue;
    const directive = extractCheatDirective(message.content);
    if (directive) return directive;
  }
  return null;
}
