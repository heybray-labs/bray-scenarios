import type { SettingsPanel } from "../components/SettingsModal.tsx";

/**
 * Real, used client-side half of the AdminRegistry extension point. The app
 * registers its settings panels here at module load (see
 * `client/src/admin-panels.ts`) instead of building a local array — an
 * enterprise package can register additional panels the same way.
 */
const panels: SettingsPanel[] = [];

export function registerAdminPanel(panel: SettingsPanel): void {
  panels.push(panel);
}

/** Sorted by registration order. */
export function getAdminPanels(): SettingsPanel[] {
  return [...panels];
}

/** Test-only reset. */
export function clearAdminPanels(): void {
  panels.length = 0;
}
