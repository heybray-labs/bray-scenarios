# Phase 6A Implementation Brief — Feature-Package Extraction + Premium Shell

**Prerequisites:** read `docs/phase-6-design.md` (ratified decisions) and `AGENTS.md`.
Three repos are touched (`bray-scenarios`, `bray-flashcards`, `bray-platform`) and one is
created (`bray-premium`, private — human checkpoint). The strangler discipline from
Phase 1 applies throughout: extract in-repo first, prove behavior identical, then publish.

## Goal

Each app's substance becomes two published packages (`-server`, `-client`); each standalone
repo becomes a thin shell consuming its own packages; a new private `bray-premium` app
mounts BOTH apps under one shell, one login, one database, one gamification ledger —
single-tenant, apps-as-sections nav (Spaces comes in 6C).

## Rules

- Zero behavior change in the standalone apps — their suites are the regression net and
  must pass unmodified (except import paths).
- Platform changes only via `bray-platform` changesets. One is pre-planned (Step 1);
  expect a small number of others — friction-log them as in Phase 5.
- App feature packages are AGPL, published to public npm under `@heybray/`. The premium
  repo is proprietary — no OSS code is *copied* into it, only imported.
- One step per commit per repo. Human checkpoints: premium repo creation, each publish.

## Step 1 — Platform changeset: multi-dimension mastery

In `bray-platform`: `GamificationConfig.contentTypes` entries gain
`masteryDimensionSlug` (the top-level field stays as a deprecated fallback for
single-type apps). `getMasteryRankings`, leaderboard scoping, and the star-map category
axis become per-content-type. `gamification-react` panels accept dimension config
per content type. Full back-compat: existing single-type apps unchanged without edits.
Changeset (minor), CI publish. Both apps bump pins in their next commits.

## Step 2 — Extract Scenarios into feature packages (in-repo first)

In `bray-scenarios`, mirror the Phase 1 playbook: create `packages/scenarios-server` and
`packages/scenarios-client` as workspaces. Move INTO them: all roleplay domain schema
(`shared/schemas/*`), server routes/controllers/services (roleplay, grading, LLM config,
star-map app-side pieces, seed logic as exported fixtures), client pages/components, and
the app's admin panels — exported as a mountable module:

```ts
// @heybray/scenarios-server
export const scenariosModule = {
  schema, migrationsDir,               // app tables only
  registerRoutes(app, deps),           // mounts /api/roleplays etc.
  gamification: { contentTypes: [{ type: "scenario", label: "Scenario",
                  masteryDimensionSlug: "category" }] },
  managePermission: "roleplay:manage",
  bindContent(db),                     // binding-FK migration source
};
// @heybray/scenarios-client
export const scenariosApp = { routes, adminPanels, navSection, contentPath };
```

The shell that remains: boot files calling `registerRoutes`/`mountApp`, env, Docker, CI,
demo seed invocation. Suites green with zero test edits before proceeding. Then the same
for `bray-flashcards` (smaller; the single-package repo grows a `packages/` dir the same
way).

## Step 3 — Publish + shells consume

Add changesets to both app repos (same release pattern as bray-platform; public npm,
provenance). Publish `0.1.0` of all four packages (0.x — their API will move during 6A).
Each shell swaps workspace refs for published pins. Fresh-clone CI green in both repos.

## Step 4 — `bray-premium` (human checkpoint: owner creates private repo)

Start from `bray-app-template`'s chassis (single-package; revisit only if the composed
app forces it). Compose: platform packages + `scenarios-{server,client}` +
`flashcards-{server,client}`. One `GamificationConfig` registering BOTH content types
with their dimensions. One migration 0000 (generated, covers platform + both apps'
tables) + binding-FK migrations for both content types. Nav: top-level sections
(Scenarios | Flashcards | Leaderboards | Teams), one settings modal aggregating both
apps' admin panels via `AdminRegistry`, one `AppConfigProvider` with a premium brand and
a `contentPath` that routes per content type. Proprietary LICENSE, private repo, no
publishing — this repo deploys, it doesn't publish.

## Step 5 — Verification

- Both standalone repos: full suites green on published packages, Docker builds, zero
  behavior change (goldens unchanged).
- Premium: boot → one admin → author + publish content in BOTH apps → complete a
  scenario attempt AND a deck session as one learner → single points ledger shows both,
  combined leaderboard scopes by `category` and `topic` correctly, team star map shows
  stars from both apps on one row. Record the walkthrough in `docs/6a-verification.md`.
- Friction log maintained in `bray-premium` (Phase 5 pattern) — it feeds the 6B brief.

## Acceptance checklist

- [ ] Four feature packages on npm; both shells under ~500 lines of app-owned code
- [ ] Standalone suites pass without test modifications
- [ ] Premium: one login, both apps functional, one ledger, cross-app star map proven
- [ ] Multi-dimension mastery shipped with back-compat (template/app pins unaffected until bumped)
- [ ] No OSS source copied into bray-premium (imports only) — grep-audit recorded
- [ ] Friction log + verification doc committed; human checkpoints paused on
