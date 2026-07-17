const CHEAT_DIRECTIVE_PATTERN = /CHEAT\s*MODE\s*:\s*([\s\S]+)/i;

export function isCheatModeMessage(text: string): boolean {
  return CHEAT_DIRECTIVE_PATTERN.test(text.trim());
}
