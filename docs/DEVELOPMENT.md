# Development workflow

How changes flow between the app repos (`bray-scenarios`, `bray-flashcards`,
`bray-premium`) and `bray-platform`. This is the canonical statement of the workflow;
mirrored copies live in each app's `docs/DEVELOPMENT.md` and in
`bray-platform/CONTRIBUTING.md` under "Cross-repo development workflow" — keep them in
sync when this file changes.

## Standing rules (default behavior — not restated per task)

These apply to every session working across these repos, not just when a specific brief
says so:

- **Default to the yalc loop for any cross-repo work.** Don't hand-edit or test across a
  repo boundary without it — see "Automated" below for the one-liners.
- **Never merge a Version Packages PR, or otherwise trigger an actual npm publish,
  without stopping and asking the owner first** — even when all checks are green and
  auto-merge would otherwise apply. This is the one PR in the whole workflow that always
  gets an explicit human go-ahead; ordinary consumer/config PRs still auto-merge as
  designed. Confirm auto-merge is not armed automatically on `changeset-release/main`
  PRs specifically — if the changesets action or any workflow step ever enables it
  there, disable it; this is a mechanical check, not just a documented intention.
- **Don't burn a CI round-trip per tiny edit.** Iterate locally — commit locally,
  don't push — until a change is complete and locally yalc-verified; push once. Every
  push to an open PR branch re-triggers `guards`+`verify`, so five WIP pushes cost five
  full CI runs for no reason.
- **Batch related small fixes into one PR** rather than opening a new PR per one-line
  change — same principle as the batched-platform-work policy below, generalized to any
  small related work, not just changeset batches.
- **Don't idle-block waiting on a CI run** if there's independent work to do — open the
  PR, arm auto-merge (except the publish PR, per above), move on, and check back when
  the next step actually depends on that PR being merged.
- **Never bypass `guards`/`verify` "because the change is small."** Yalc-polluted
  manifests and unpublished-API imports have both reached `main` on changes that felt too
  small to matter. Improve CI speed with caching or a docs-only fast path *inside* the
  job — never via `paths-ignore`, which stops the check from reporting and leaves PRs
  stuck on "Expected" forever — never by skipping the gate.

## Automated (preferred day-to-day)

From `bray-platform` after editing platform packages:

```bash
./bin/yalc-sync.sh server-kit          # rebuild server-kit + workspace dependents, publish+push
./bin/yalc-sync.sh --link premium      # once per machine (or use a path); needs .yalc-targets.local
./bin/yalc-sync.sh --status premium
./bin/yalc-sync.sh --unlink premium    # before commit — guards reject yalc in manifests
```

Feature-package repos use the same flag shape, and both may need linking into premium
at once (e.g. a `server-kit` change that `scenarios-server` also depends on):

```bash
# bray-scenarios
./bin/yalc-sync.sh scenarios-server
./bin/yalc-sync.sh --link premium

# bray-flashcards
./bin/yalc-sync.sh flashcards-server
./bin/yalc-sync.sh --link premium
```

Copy `.yalc-targets.local.example` → `.yalc-targets.local` (gitignored) so shortcuts like
`premium` resolve to your sibling-repo paths. The manual steps below are unchanged — these
scripts sequence the same operations.

## The invariant

**A consumer repo's `main` only ever points at published `@heybray/*` versions.**
Local bridges (yalc) are a workbench state, never a committed state. Fresh-clone CI is
the enforcement: it can only resolve what npm can resolve.

## The two loops

**Inner loop (minutes, local only)** — while platform or feature-package code is in flux:

```bash
# in bray-platform, after editing a package:
npm run build --workspace=@heybray/<pkg>     # if the package has a build
yalc publish packages/<pkg>                  # or: yalc push (updates all linked consumers)

# in the consumer repo (once per machine/branch):
yalc add @heybray/<pkg> && npm install
# iterate: edit → build → yalc push → consumer picks up the copy in place
```

Each consumer app's `bin/dev.sh` runs `bin/yalc-cache-bust.sh` automatically so Vite's
`optimizeDeps` cache invalidates when yalc swaps `@heybray/*` content under an unchanged
version string — without that, "picks up the copy in place" was not reliably true after
a restart.

**Yalc doesn't understand transitive dependencies** — if a change to `server-kit`
matters to `gamification`, and `gamification` is what `scenarios-server` depends on, the
consumer needs `server-kit` **and** `gamification` **and** `scenarios-server` all
yalc-linked together, not just the outermost one.

**Outer loop (when the change is right)**:

1. PR into `bray-platform` (or the relevant feature-package repo) — **every change
   carries its own changeset** in the same PR.
2. Merge → changesets opens/updates the "Version Packages" PR → merging that publishes
   to npm via CI (provenance attested). No manual publishes.
3. Consumer branch: `yalc remove @heybray/<pkg> && npm install` for every linked
   package, bump the pins to the published versions, land the consumer PR.

Why yalc and not the alternatives:

| Option | Verdict |
|---|---|
| **yalc** | ✅ Copies built output the way npm would — same layout, no symlinks. |
| `npm link` | ❌ Symlinks can load two instances of one package; `server-kit` holds module-level singletons (db handle, seam registries) that silently split. React duplicates the same way. |
| `file:../bray-platform/...` / sibling `tsconfig` paths | ❌ Rewrites package.json/lockfile with paths that must never merge, or silently bypasses yalc/npm resolution entirely under `tsx`. |
| Deep imports (`node_modules/@heybray/*/src/...`) | ❌ Bypasses the package exports contract. |
| Copying into `node_modules` | ❌ Bypasses npm resolution entirely. |

## Guard rails (mechanical, not aspirational)

- `.yalc/` and `yalc.lock` are gitignored in every consumer repo — **but note `yalc add`
  also rewrites `package.json`** with a `file:.yalc/...` dependency, and package.json is
  tracked. Therefore every consumer's CI (and its local test script) greps `package.json`
  + lockfile for the string `.yalc` and **fails on any hit**.
- **No sibling-repo `tsconfig.json` path aliases for `@heybray/*` packages** — resolution
  must go through `node_modules` (npm pin or yalc copy). Sibling-path aliases silently
  bypass yalc under `tsx` and can load a second copy of module singletons (e.g.
  `@heybray/server-kit`'s database handle).
- After `yalc remove`, always `npm install` to restore the lockfile before committing —
  `yalc remove` alone leaves lockfile entries and broken symlinks behind.
- **Consumer commits that adopt an unpublished platform or feature-package API never
  merge to `main`** — they wait on the adoption branch until the batch publishes, then
  land with the pin bump in one commit. Merging early breaks fresh clones even with
  clean manifests (the import target doesn't exist on npm).
- A consumer **shim duplicating an unpublished platform component** is an exception
  with a hard expiry (deleted the same day the batch publishes), never a pattern. If
  a shim is being considered, first ask whether the batch should simply publish now —
  "ship what's green" usually wins.

## Enforcement

Workflow rules above are not advisory. Each repo ships `bin/guards.sh` (repo-specific
sections appended to a shared core) and runs it locally and in CI.

### What `bin/guards.sh` checks

**Core (every repo):**

1. **Yalc manifest tripwire** — no `.yalc` references in committed `package.json` or
   `package-lock.json`.
2. **Deep-import tripwire** — no imports of `node_modules/@heybray/...` paths in
   application or package source; use each package's public `exports`.
3. **Sibling tsconfig paths** — no `../bray-*` (or similar sibling-repo) path aliases in
   any `tsconfig*.json`; `@heybray/*` must resolve through `node_modules`.

**App repos** (`bray-scenarios`, `bray-flashcards`, `bray-premium`, `bray-app-template`)
also check:

4. **Migration immutability** — edits to SQL migration files that already existed on
   `main` fail; new migration files are allowed (append-only).
5. **Package boundary** (repos with `packages/*/src`) — feature-package source must not
   import app-shell paths (`server/`, `src/`, `client/`, `@shared`).

**`bray-platform` only** also runs the Scenarios vocabulary gate and package-boundary
grep from `CONTRIBUTING.md`, and (in CI only) `npx changeset status --since=origin/main`
when the reusable workflow is invoked with `changesets: true`.

### Local and CI wiring

- **Locally:** `./bin/guards.sh` runs as the first step of `bin/test.sh` (or `npm test`
  on `bray-platform`) — fails before tests if a tripwire trips.
- **CI:** job **`guards`** calls the org reusable workflow
  `heybray-labs/.github/.github/workflows/guards.yml@main` (fast; no full `npm ci` except
  the platform changeset check). Job **`verify`** runs typecheck/build/tests and depends on
  `guards`.
- **Merge:** org branch rulesets require check contexts **`guards / guards`** and
  **`verify`** to pass on PRs to `main`. These are **check-run names** — not the decorated
  names the PR UI shows (e.g. `CI / guards / guards (pull_request)`).

### Ruleset and workflow gotchas

- Ruleset "required checks" must list **`guards / guards`** and **`verify`** exactly — the
  PR UI's decorated workflow names do not match; mistyped names sit at "Expected — Waiting
  for status" forever.
- Org-level rulesets offer no autocomplete for check names — type them manually.
- When `guards` fails, `verify` is skipped (`needs: guards`) and counts as satisfied; the
  failed **`guards / guards`** alone blocks merge.
- Re-running a failed workflow run does **not** pick up a fixed workflow file — push a new
  commit.
- **Never add `paths-ignore` or path filters to `ci.yml`** for jobs that rulesets require:
  a PR that never triggers the workflow never reports the check and blocks forever.

## Batched platform work

When a review pass produces several related platform changes (e.g. client UI dedupe),
don't publish per tweak:

- Accumulate on a short-lived `bray-platform` feature branch. **Each item still lands
  with its own changeset file** — changesets accumulate and the eventual merge produces
  ONE Version Packages PR / one publish with an itemized changelog. Never replace
  per-change changesets with a single hand-written batch changeset.
- Consumers ride yalc against the batch branch during the batch.
- **Scope bound**: a batch covers one concern class (e.g. client-side UI dedupe only —
  nothing touching server packages/APIs in the same batch). **Time bound**: ~a week; if
  it's still open, publish what's green and start a new batch.
- **Final verification before publish is against packed tarballs** (`npm pack` install
  or an RC), not yalc — yalc green is necessary, not sufficient.
- Batch ends with coordinated consumer pin bumps landing promptly in all three apps.

## Versioning (platform packages)

Breaking DB schema change or runtime API in a platform package = **major** + migration
notes. Additive = minor. Fixes = patch. Deprecated aliases survive until the next major.
Feature packages (`@heybray/scenarios-*`, `@heybray/flashcards-*`) are 0.x while the
premium composition is stabilizing — same changeset discipline, looser semver latitude.
Feature packages ship raw `.ts` source (consumable by tsx/vite shells only).

---

## This repo (bray-scenarios)

Open-source (AGPL-3.0) gamified role-play training app. npm-workspaces monorepo:

- `client/` — React 18 + Vite 6 + wouter + TanStack Query + Tailwind + shadcn-style UI
- `server/` — Express, REST under `/api`, serves the built SPA in production
- `shared/schemas/` — Drizzle table definitions + zod schemas + shared types, imported by both sides (NOT a workspace)
- `@heybray/*` — published platform packages from [heybray-labs/bray-platform](https://github.com/heybray-labs/bray-platform) (identity, gamification, UI kit, etc.); pinned in `client/package.json` and `server/package.json`, resolved from npm
- `bin/` — dev/test/quickstart/upgrade shell scripts
- `server/drizzle/` — hand-authored SQL migrations
- Deploy: single Docker container (API + SPA) + Postgres via docker-compose; GHCR images

**Platform rework:** implement one phase at a time — never blend phases.

### Non-obvious conventions (breaking these breaks the build)

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

### Commands (run from repo root)

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

### Definition of green

Matches CI in `.github/workflows/ci.yml`: typecheck passes, client builds, migrations apply
to a fresh Postgres, `npm test` passes. Run all four before declaring any task done.

### Platform rework guardrails (hard rules)

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
