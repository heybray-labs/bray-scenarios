/** Explicit Bray pink tints — Tailwind `/opacity` does not apply to `var(--primary)` colors. */
export const drawerPink = {
  header: "bg-[var(--bray-pink-light)]",
  categoryHeader: "bg-[var(--bray-pink-light)] hover:bg-[var(--bray-pink-93)]",
  categoryBody: "bg-[var(--bray-pink-98)]",
  scenarioRow: "bg-[var(--bray-pink-97)] border-[var(--bray-pink-90)]",
  scenarioRowHover: "hover:bg-[var(--bray-pink-94)]",
  attemptList: "bg-[var(--bray-pink-95)]",
  attemptRowHover: "hover:bg-[var(--bray-pink-92)]",
} as const;
