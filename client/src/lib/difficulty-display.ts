// Roleplay difficulty semantics (easy/medium/hard). App-specific: the platform
// taxonomy package stays free of any one app's difficulty vocabulary.

export function formatDifficulty(difficulty: string | null | undefined): string {
  const label = (difficulty ?? "").trim();
  if (!label) return label;
  return label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();
}

export function getDifficultyColor(difficulty: string | null | undefined): string {
  switch ((difficulty ?? "").toLowerCase()) {
    case "easy":
      return "var(--difficulty-easy)";
    case "hard":
      return "var(--difficulty-hard)";
    case "medium":
    default:
      return "var(--difficulty-medium)";
  }
}
