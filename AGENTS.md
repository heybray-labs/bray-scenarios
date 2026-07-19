# Agent Guide — bray-scenarios

Read this before making changes. For the platform rework, also read
`docs/platform-architecture.md` (the approved design) and the current phase brief in `docs/`.
**For any work touching `bray-platform` or another app repo (`bray-flashcards`,
`bray-premium`, `bray-app-template`), `docs/dev-workflow.md` is required reading and its
"Standing rules" apply by default** — yalc-first cross-repo iteration, never auto-merge a
Version Packages/publish PR, and the CI-round-trip discipline (iterate locally, batch
small fixes, don't idle-wait on CI). These are permanent defaults, not per-task instructions.
**Implement one phase at a time — never blend phases.**

## What this repo is

Open-source (AGPL-3.0) gamified role-play training app. npm-workspaces monorepo:

- `client/` — React 18 + Vite 6 + wouter + TanStack Query + Tailwind + shadcn-style UI
- `server/` — Express, REST under `/api`, serves the built SPA in production
- `shared/schemas/` — Drizzle table definitions + zod schemas + shared types, imported by both sides (NOT a workspace)
- `@heybray/*` — published platform packages from [heybray-labs/bray-platform](https://github.com/heybray-labs/bray-platform) (identity, gamification, UI kit, etc.); pinned in `client/package.json` and `server/package.json`, resolved from npm
- `bin/` — dev/test/quickstart/upgrade shell scripts
- `server/drizzle/` — hand-authored SQL migrations
- Deploy: single Docker container (API + SPA) + Postgres via docker-compose; GHCR images

## Non-obvious conventions (breaking these breaks the build)

1. **The server has NO build step.** It runs raw TypeScript via `tsx` (`npm run dev`,
   `start:docker: tsx index.ts`). All server-side relative imports use **explicit `.ts`
   extensions** (`import { users } from "../shared/schemas/users.ts"`). Do not remove
   extensions, do not introduce a server build, do not emit JS.
2. **`@shared` alias** resolves to `shared/` in the client only — via
   `client/vite.config.ts` (`resolve.alias`) AND `client/tsconfig.json` (`paths`).
   Both must stay in sync. The server reaches `shared/` by relative path.
3. **ESM everywhere** (`"type": "module"` in every package.json).
4. **Migrations are hand-authored SQL**, numbered `server/drizzle/NNNN_name.sql`, registered
   in `server/drizzle/meta/_journal.json`. Never use `drizzle-kit push` against a real DB;
   never edit an already-shipped migration. The runner (`server/init-db/run-migrations.ts`)
   also baseline-stamps legacy databases — preserve that behavior.
5. **Schema aggregation**: `server/db.ts` imports every table and composes the Drizzle
   `schema` object explicitly. New tables must be added there.
6. **Node >= 20, npm >= 10.** npm only (lockfile is `package-lock.json`).

## Commands (run from repo root)

| Purpose | Command |
|---|---|
| Typecheck everything | `npm run typecheck` |
| Client production build | `npm run build --workspace=client` |
| Full API test suite | `npm test` (starts disposable Postgres on :5434 via `docker-compose.test.yml`, applies migrations, runs Vitest API tests, tears down) |
| Keep test DB up between runs | `npm test -- --keep-db`, or `npm run db:test:up` / `db:test:down` |
| Apply migrations | `npm run db:migrate` (needs `DATABASE_URL`) |
| Dev servers (both) | `npm run dev` (server on :3001, client on :5173) |
| Seed demo data (host) | `npm run db:demo-seed` |
| Seed demo data (Docker) | `npm run db:docker:demo-seed` |
| Remove demo data only (host) | `npm run db:demo-wipe` |
| Remove demo data only (Docker) | `npm run db:docker:demo-wipe` |
| Wipe Docker dev DB/volumes | `npm run db:docker:wipe` |

**Definition of green** (matches CI in `.github/workflows/ci.yml`): typecheck passes,
client builds, migrations apply to a fresh Postgres, `npm test` passes. Run all four
before declaring any task done.

## Platform rework guardrails (hard rules)

- The architecture decisions in `docs/platform-architecture.md` §1 ("Decisions locked in")
  are settled. Do not relitigate or "improve" them.
- **Every phase must leave the app shippable**: CI green, zero user-visible behavior change
  unless the phase brief says otherwise, DB upgradeable from any prior release.
- Phase 1 is **migration-free**: no SQL files added, no table/column changes, `drizzle/meta`
  untouched.
- Platform package migrations (Phase 2+) are **additive-only** within a major version.
- Move files with `git mv` (history-preserving moves, not delete+create). Commit in small,
  reviewable units — one package extraction per commit where possible.
- Do not add new runtime dependencies without an explicit note in the PR description.
- Do not rename DB tables, permissions strings, or API routes except where the current
  phase brief explicitly says so.