# Phase 6A · Step 2 — Feature-package extraction (report)

Extracts the Scenarios roleplay domain out of the standalone shell into two
in-repo workspace packages, leaving a thin shell that boots via them. Zero
user-visible behaviour change; all four green gates pass.

## What was created

- **`@heybray/scenarios-server`** (`packages/scenarios-server`, private `0.0.1`,
  `type: module`, `exports`/`main` → `.ts` source). Owns the roleplay schema,
  routes, controllers, services, `roleplay/` LLM boundary, `gamification.ts`,
  `media-usage.ts`, cheat-mode config, taxonomy classifications lib, and seed
  helpers. Public surface:
  - `scenariosModule = { schema, migrationsDir, registerRoutes, gamification, managePermission, reconcileProjection, seedDemo, seedClassifications }`
  - named re-exports: `registerRoutes`, `reconcileGamificationProjection`,
    `roleplayMediaUsage`, `scenariosSchema`, `seedDemo`, `seedClassifications`,
    `assertDatabaseConnection`, `categoryLabelToSlug`, `scenarioClassifications`,
    `isCheatModeEnabled`, and the gamification constants.
  - subpath exports: `./schema/*`, `./seed/*`, `./config/*`, and the three LLM
    boundary modules (`./roleplay/grading`, `./roleplay/model-factory`,
    `./services/agent-model-catalog.service`) used by the test harness.
- **`@heybray/scenarios-client`** (`packages/scenarios-client`, private `0.0.1`,
  `type: module`, `exports`/`main` → `.tsx` source). Owns the pages, components,
  hooks, client lib, admin panels, and branding assets. Public surface:
  - `scenariosApp = { routes, registerAdminPanels, contentPath }`
  - subpath export: `./assets/*` (logo + login hero, consumed by the shell).

## What remained in the shell

- **Server**: `index.ts` (boot), `app.ts` (generic middleware + health/about +
  auth/users/features routers; delegates the whole domain to
  `scenariosModule.registerRoutes(app)`), `db.ts` (composes the full Drizzle
  schema from platform schemas + `scenariosSchema`, sets the media usage hook),
  `drizzle/` (hand-authored SQL migrations — still the single migration source;
  `scenariosModule.migrationsDir` is `null` with a comment), `init-db/` (migration
  runner + `init-db.ts` + `seed-roleplays.ts` CLI + a thin `seed-demo.ts` CLI
  wrapper), and `test/` (unchanged except the sanctioned mock-path edits below).
- **Client**: `main.tsx`, `index.css`, `vite-env.d.ts`, and a thin `App.tsx`
  that renders the platform auth/provider chrome and maps `scenariosApp.routes`.
- **Re-export shims** at historical paths so the rest of the suite needs zero
  edits: `shared/schemas/roleplay-core.ts`, `shared/schemas/roleplay-transfer.ts`,
  `shared/schemas/agent/roleplay-app-config.ts`, `server/config/cheat-mode.ts`,
  `server/init-db/seed-demo.ts`, `server/init-db/demo-data/users.ts`.

## Test edits (import paths only — owner-ratified Option A)

Path-based `vi.mock` cannot intercept a module the SUT imports from a different
specifier, so the three LLM-boundary mock specifiers had to move with the code.
Mock bodies and assertions are byte-identical; only specifier strings changed.

- `server/test/mocks/setup-mocks.ts`: `../../roleplay/model-factory.ts` →
  `@heybray/scenarios-server/roleplay/model-factory`; `../../roleplay/grading.ts`
  → `@heybray/scenarios-server/roleplay/grading`;
  `../../services/agent-model-catalog.service.ts` →
  `@heybray/scenarios-server/services/agent-model-catalog.service` (plus the
  matching `typeof import()` type args and the `GradingContext` type import).
- `server/test/api/gamification-regrade.test.ts`: `gradeTranscript` /
  `GradingContext` imports switched to the identical
  `@heybray/scenarios-server/roleplay/grading` specifier so they share the mocked
  module identity.

Every other test file kept its original imports (resolved via the shims).

## Green gates

| Gate | Result |
|---|---|
| `npm run typecheck` (4 workspaces) | ✅ pass |
| `npm run build --workspace=client` | ✅ 2004 modules, assets bundled from package |
| Migrations apply to fresh Postgres | ✅ (via `npm test` bootstrap) |
| `npm test` | ✅ 140 passed, 6 skipped (15 files), ~21s, no LLM/API-key hangs |

The suite completing in ~21s with `gamification-regrade`, `roleplays`, and
`roleplay-config` all fast confirms the mocks intercept the package's internal
LLM calls (no real network / missing-key stalls). The `gamification-golden`
test seeds demo data with cover images, confirming the package's
repo-root `examples/` resolution still works from its new location.

## Friction log

| ID | Category | Note |
|---|---|---|
| FL-6A2-001 | **[boilerplate/template]** | Path-based `vi.mock` couples the test harness to the pre-extraction file layout: mocking `../../roleplay/grading.ts` stops intercepting once the SUT imports the module via its package specifier, forcing test-file edits during an otherwise shim-only extraction. A package-specifier (or DI-based) mocking convention in the template would let feature code move without touching the harness. |
