# Local Dev Automation — DB Bootstrap + Cross-Repo Yalc Sync

**Context:** the manual yalc loop (`docs/dev-workflow.md`) and per-repo Postgres setup
for `npm run dev` are both real, recurring, error-prone manual sequences — two incidents
already came from the yalc half. This brief automates both without changing the
underlying mechanics documented in `dev-workflow.md` (which stays the source of truth
for *what* happens; this brief is *how it gets triggered*).

Repos in scope: `bray-platform`, `bray-scenarios`, `bray-flashcards`, `bray-premium`,
`bray-app-template`.

## Rules

- Nothing here changes CI/test infrastructure (`docker-compose.test.yml`, `bin/test.sh`,
  guards) — this is dev-loop only.
- Nothing auto-commits. Scripts operate on the working tree and local Docker state only.
- Machine-specific config (sibling repo paths) is **gitignored**, never committed —
  paths differ per developer machine.
- Audit before building: each repo may already have partial `bin/dev.sh` bootstrap
  logic (bray-scenarios has both a `dev` script and a separate `launch:local` →
  `bin/dev.sh`) — standardize and extend what exists rather than duplicating it.
- One commit per concern, per repo.

## Part A — DB auto-bootstrap for `npm run dev`

### Step A1 — Audit current state

Read each repo's `bin/dev.sh` (or equivalent), root `package.json` `dev`/`launch:local`
scripts, `docker-compose.yml`, and `.env`/`.env.example` for the dev Postgres port.
Report: which repos already auto-start/migrate the db, which don't, and — critically —
**whether any two repos' dev-mode Postgres ports collide** (test ports are already known
staggered: scenarios 5434, flashcards 5435, template 5436, premium 5437 — confirm the
equivalent for each repo's *dev* port, since running two repos' dev servers/dbs
simultaneously is now a normal cross-repo-testing scenario). Assign non-colliding dev
ports where they currently collide, updating `.env.example` and `docker-compose.yml`
defaults; leave already-distinct ports alone.

### Step A2 — Standardize `bin/dev.sh` in every repo

Each repo's `bin/dev.sh` becomes the one entrypoint (`npm run dev` calls it) and does,
idempotently:

1. `docker compose up -d db --wait` (via the repo's existing compose-env wrapper if it
   has one, e.g. bray-scenarios' `bin/compose-env.sh` pattern) — no-ops cleanly if the
   container is already up and healthy.
2. Run the repo's existing migration script (`db:migrate`/`db:init`, whatever it already
   calls) — this must be safe to run every single time `npm run dev` starts (it already
   is, per the existing idempotent migration runner design — just sequence it here).
3. Exec the existing concurrently-based server+client dev processes (unchanged).

No new migration logic — this step only *sequences* what already exists. If a repo's
migration runner isn't idempotent-safe to call unconditionally, fix that as a separate,
clearly labeled commit (not folded into the sequencing change).

### Step A3 — Verify

`npm run dev` from a machine with **no** containers running successfully brings up db +
migrates + starts both processes, in every repo, from a single command. Re-running it
with everything already up is fast (no needless rebuild/re-migrate work, just a health
check + skip).

## Part B — Cross-repo yalc sync

### Step B1 — `bin/yalc-sync.sh` in `bray-platform`

```
Usage:
  bin/yalc-sync.sh                 # build + publish + push ALL platform packages
  bin/yalc-sync.sh <pkg> [<pkg>…]  # only the named packages (e.g. server-kit gamification)
  bin/yalc-sync.sh --link <path>   # first-time setup: yalc add the default package set
                                    # into the consumer repo at <path>, then npm install
  bin/yalc-sync.sh --unlink <path> # yalc remove --all && npm install in <path>
  bin/yalc-sync.sh --status <path> # report which @heybray/* packages <path> currently
                                    # has yalc-linked (reuse guards.sh's detection logic
                                    # in reporting mode, not failing mode)
```

- Default sync path (no args): `npx turbo run build` (whole graph, correct order via
  turbo's own dependency resolution — no manual ordering needed), then for every package
  with a `dist` output, `(cd packages/<pkg> && yalc publish --push)`. Packages with no
  build step (e.g. `dev-config`) are skipped for build but still nothing to publish
  either — exclude them from the loop.
- Named-package sync: `npx turbo run build --filter=...@heybray/<pkg>` (turbo's leading
  `...` prefix selects the package **and every workspace package that depends on it** — so a
  `server-kit` change correctly rebuilds `gamification`/`identity`/etc. too; the trailing
  `...` suffix selects dependencies instead, which is not what we want here) — then
  publish+push each package turbo reports as rebuilt, not just the one named.
- `--link`: default package set per consumer is: everything (`server-kit`, `identity`,
  `taxonomy`, `media`, `gamification`, `llm`, `ui`, `react`, `gamification-react`). Simpler
  to over-link than to require the developer to know exactly which packages a given
  change touches.
- Sibling repo paths for a bare `--link`/`--unlink` shortcut name (e.g.
  `bin/yalc-sync.sh --link scenarios`) come from a **gitignored** `.yalc-targets.local`
  file at the repo root, one `name=path` per line, e.g.:
  ```
  scenarios=/Users/garethshercliff/opensource/scenarios/bray-scenarios
  flashcards=/Users/garethshercliff/opensource/scenarios/bray-flashcards
  premium=/Users/garethshercliff/opensource/scenarios/bray-premium
  template=/Users/garethshercliff/opensource/scenarios/bray-app-template
  ```
  Ship `.yalc-targets.local.example` (committed) as the template; add
  `.yalc-targets.local` to `.gitignore`.

### Step B2 — Equivalent script for feature-package repos

`bray-scenarios` and `bray-flashcards` each get a matching, smaller
`bin/yalc-sync.sh` covering only their own feature packages
(`scenarios-{server,client}` / `flashcards-{server,client}`), same flag shape, same
gitignored targets-file convention (their realistic target is just `premium=<path>`).

### Step B3 — Safety rail

Before `yalc publish --push` in either script, run the same yalc-detection grep guards.sh
uses (informational here, not failing) and print a one-line reminder: "remember to
`--unlink` every target before committing — guards will reject a push with yalc residue."

### Step B4 — Docs

Update `docs/dev-workflow.md`: keep the manual step-by-step explanation (it's the correct
mental model), add a short "Automated" subsection showing the one-liners
(`bin/yalc-sync.sh`, `bin/yalc-sync.sh --link premium`, `bin/yalc-sync.sh --unlink premium`)
as the normal way to invoke it day-to-day.

## Verification

- Part A: fresh-machine simulation (stop all containers, `docker system prune` the
  relevant volumes if safe to, or just stop containers) → `npm run dev` in each repo
  reaches a working app with zero manual db steps.
- Part B: reproduce the worked example from `dev-workflow.md` (`server-kit` change →
  `gamification` → `scenarios-server` → `bray-premium`) using only
  `bin/yalc-sync.sh server-kit` (platform) + `bin/yalc-sync.sh --link premium` (once) +
  confirm premium's dev server picks up the change — then `--unlink` and confirm guards
  pass clean.

## Acceptance checklist

- [x] Dev Postgres port audit complete; any collisions resolved
- [x] `npm run dev` self-bootstraps (db up + migrate + start) in all five repos
- [x] `bin/yalc-sync.sh` in `bray-platform`, `bray-scenarios`, `bray-flashcards` per spec
- [x] `.yalc-targets.local` gitignored everywhere it's introduced; `.example` committed
- [x] Transitive rebuild verified: a leaf-package (`server-kit`) change correctly
      triggers rebuild+republish of everything depending on it via one command
      (`--filter=...@heybray/<pkg>` — turbo's leading `...`, not trailing)
- [x] `dev-workflow.md` updated with the automated command forms
- [x] Full worked-example walkthrough completed once, end to end (13 packages linked,
      both `reconcileProjection` calls pass, `--unlink` + guards clean)

**Status:** brief complete (Jul 2026).

## Findings

### Premium local dev diverged from npm/CI for `@heybray/scenarios-server` (Jul 2026)

**What happened.** `bray-premium/tsconfig.json` contained `compilerOptions.paths` entries
that aliased `@heybray/scenarios-server` to `../bray-scenarios/packages/scenarios-server/...`
(the sibling monorepo checkout). `tsx` honors those mappings at runtime, so plain
`npm run dev` loaded scenarios-server from the sibling repo instead of the npm pin in
`node_modules`. Docker/CI (no tsconfig path override) exercised the published package.

**When introduced.** Commit `39f376a` (*Add Premium demo seed/wipe Docker tooling*, 18 Jul
2026) — added while temporarily vendoring `scenarios-server@0.1.3` before npm publish. A
follow-up commit in the same PR switched to `@heybray/scenarios-server@^0.1.4` on npm and
removed the vendor tarball, but **left the tsconfig paths in place**. Not a sanctioned
long-term mechanism; a tarball-workaround leftover that contradicts
`docs/dev-workflow.md` (same anti-pattern class as `file:../` sibling references and
`npm link`: bypasses the package boundary and splits module singletons).

**What it caused.**

- **Standing local/CI gap:** from 18 Jul until fix, premium local dev never exercised the
  npm-pinned scenarios-server; only Docker/CI did.
- **Part B walkthrough blocker:** with platform packages yalc-linked correctly, tsx still
  executed scenarios-server from the sibling checkout. `@heybray/server-kit` resolved to
  `bray-scenarios/node_modules/@heybray/server-kit` (a second physical copy) while
  premium's `setDatabase()` ran on the yalc-linked copy → `db` undefined in
  `reconcileGamificationProjection` (`TypeError: Cannot read properties of undefined
  (reading 'select')`). Initial misdiagnoses (pin mismatch, yalc symlink mode,
  incomplete platform linking) were ruled out with inode/resolution evidence.

**Fix.** `bray-premium@92fb633` — removed the sibling `paths` entries; resolution goes
through `node_modules` (npm pin normally, yalc copy during the dev loop).

**Verification (before / after).**

| Check | Before fix | After fix |
|-------|------------|-----------|
| tsx resolves `@heybray/scenarios-server` | Sibling `../bray-scenarios/packages/...` | `node_modules/@heybray/scenarios-server/...` |
| Plain npm init + both reconciles | Seed warning; reconcile threw on `db.select` under yalc | Pass |
| Full yalc walkthrough (13 packages) | Boot failed at reconcile | Boot OK past both reconciles; guards clean after `--unlink` |

**Prevention.** Guard #3 in `bin/guards.sh` (all five repos):
`bin/check-no-sibling-tsconfig-paths.sh` rejects `../bray-*` in any `tsconfig*.json` and
`"../*` path aliases in root `tsconfig.json`.
