/** Explicit Bray pink tints — Tailwind `/opacity` does not apply to `var(--primary)` colors. */
export const drawerPink = {
  header: "bg-[hsl(330,65%,96%)]",
  categoryHeader: "bg-[hsl(330,65%,96%)] hover:bg-[hsl(330,65%,93%)]",
  categoryBody: "bg-[hsl(330,65%,98%)]",
  scenarioRow: "bg-[hsl(330,65%,97%)] border-[hsl(330,65%,90%)]",
  scenarioRowHover: "hover:bg-[hsl(330,65%,94%)]",
  attemptList: "bg-[hsl(330,65%,95%)]",
  attemptRowHover: "hover:bg-[hsl(330,65%,92%)]",
} as const;
