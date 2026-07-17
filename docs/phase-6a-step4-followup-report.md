# Phase 6A · Step 4 follow-up — 0.1.1 package API (report)

Addresses architect conditions before Step 5 verification. Replaces deep `node_modules/.../src/routes/` imports and dual star-map router ordering with public package API and premium-owned star-map routes.

## Server packages (`0.1.1`)

Both `-server` packages export:

- **`registerDomainRoutes(app, deps)`** — domain routers only (`/api/roleplays`, `/api/roleplay-config` or `/api/decks`). Standalone shells unchanged: `registerRoutes()` calls `registerDomainRoutes()` then mounts platform surfaces.
- **Star-map drill-in handlers** via `@heybray/*-server/team-star-map`:
  - Scenarios: `getScenarioStarMap`, `getScenarioMemberProgress`, `getScenarioMemberContentHistory`, `getScenarioMemberContentAttempts`
  - Flashcards: `getDeckStarMap`, `getDeckMemberProgress`, `getDeckMemberContentHistory`, `getDeckMemberContentAttempts`

## Client packages (`0.1.1`)

Both `-client` packages export:

- **`PackageLayoutProvider`** / **`usePackageLayoutEnabled`** — when `usePackageLayout={false}`, in-package `AppLayout` renders children only. Premium wraps all routes in `PremiumLayout` with section nav.

Subpath: `@heybray/*-client/layout`

## Premium changes

- `registerPremiumRoutes()` uses `registerDomainRoutes()` from both server packages (no deep imports).
- **`server/routes/premium-team-star-map.ts`** — single star-map surface:
  - Grid: merge scenario + deck `getStarMap` category columns and member mastery
  - Content history: merge both enriched histories (each content item tagged with `contentType`)
  - Attempts: resolve `contentId → content_type` via `gamification_content`; dispatch to scenario or deck handler; optional `?contentType=` for id collisions
- **`App.tsx`** — all protected routes wrapped with `PackageLayoutProvider` + `PremiumLayout`
- Pins bumped to `^0.1.1`; friction log updated (FL-6A4-007 raw `.ts` convention)
- **`docs/6a-verification.md`** — Step 5 checklist including deletion cascade + cross-app drill-ins

## Green gates (local, packed `0.1.1` tarballs)

| Repo | Result |
|---|---|
| `bray-scenarios` typecheck + `npm test` | ✅ 140 passed |
| `bray-flashcards` typecheck + `npm test` | ✅ 36 passed |
| `bray-premium` typecheck + build + test | ✅ 25 passed |

## Checkpoint

**Publish `0.1.1`** of all four feature packages to npm, then run `docs/6a-verification.md` walkthrough.
