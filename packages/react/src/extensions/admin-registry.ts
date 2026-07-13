import type { SettingsPanel } from "../components/SettingsModal.tsx";

/**
 * Real, used client-side half of the AdminRegistry extension point. The app
 * registers its settings panels here at module load (see
 * `client/src/admin-panels.ts`) instead of building a local array — an
 * enterprise package can register additional panels the same way.
 */
const panels: SettingsPanel[] = [];

/**
 * Registration is idempotent by `value`: re-registering a panel (e.g. because
 * `admin-panels.ts` re-executes under Vite HMR) replaces the existing entry
 * in place rather than appending a duplicate — otherwise the Settings modal
 * would accumulate repeated tabs with duplicate React keys until a hard
 * refresh.
 */
export function registerAdminPanel(panel: SettingsPanel): void {
  const existingIndex = panels.findIndex((p) => p.value === panel.value);
  if (existingIndex === -1) {
    panels.push(panel);
  } else {
    panels[existingIndex] = panel;
  }
}

/** Sorted by registration order. */
export function getAdminPanels(): SettingsPanel[] {
  return [...panels];
}

/** Test-only reset. */
export function clearAdminPanels(): void {
  panels.length = 0;
}
