# Cross-Repo Development Workflow (blessed)

How changes flow between the app repos (`bray-scenarios`, `bray-flashcards`,
`bray-premium`) and `bray-platform`. This is the canonical statement of the workflow;
port the "Platform contributors" section into `bray-platform/CONTRIBUTING.md` (that was
planned in Phase 4 and never landed — the architecture doc §7 already points there).

## The invariant

**A consumer repo's `main` only ever points at published `@heybray/*` versions.**
Local bridges (yalc) are a workbench state, never a committed state. Fresh-clone CI is
the enforcement: it can only resolve what npm can resolve.

## The two loops

**Inner loop (minutes, local only)** — while platform code is in flux:

```bash
# in bray-platform, after editing a package:
npm run build --workspace=@heybray/<pkg>     # if the package has a build
yalc publish packages/<pkg>                  # or: yalc push (updates all linked consumers)

# in the consumer repo (once per machine/branch):
yalc add @heybray/<pkg> && npm install
# iterate: edit → build → yalc push → consumer picks up the copy in place
```

**Outer loop (when the change is right)**:

1. PR into `bray-platform` — **every change carries its own changeset** in the same PR.
2. Merge → changesets opens/updates the "Version Packages" PR → merging that publishes
   to npm via CI (provenance attested). No manual publishes.
3. Consumer branch: `yalc remove @heybray/<pkg> && npm install`, bump the pin to the
   published version, land the consumer PR.

Why yalc and not the alternatives:

| Option | Verdict |
|---|---|
| **yalc** | ✅ Copies built output the way npm would — same layout, no symlinks. |
| `npm link` | ❌ Symlinks can load two instances of one package; `server-kit` holds module-level singletons (db handle, seam registries) that silently split. React duplicates the same way. |
| `file:../bray-platform/...` | ❌ Rewrites package.json/lockfile with paths that must never merge. |
| Deep imports (`node_modules/@heybray/*/src/...`) | ❌ Bypasses the exports contract entirely. Already bitten once (6A Step 4). |
| Copying into `node_modules` | ❌ Obviously. Also already attempted once. |

## Guard rails (mechanical, not aspirational)

- `.yalc/` and `yalc.lock` are gitignored in every consumer repo — **but note `yalc add`
  also rewrites `package.json`** with a `file:.yalc/...` dependency, and package.json is
  tracked. Therefore every consumer's CI (and its local test script) greps `package.json`
  + lockfile for the string `.yalc` and **fails on any hit**.
- After `yalc remove`, always `npm install` to restore the lockfile before committing —
  `yalc remove` alone leaves lockfile entries and broken symlinks behind (proven in the
  6A navbar incident: a Docker build failed on lockfile `.yalc` paths days later).
- **Consumer commits that adopt an unpublished platform API never merge to `main`** —
  they wait on the adoption branch until the batch publishes, then land with the pin
  bump in one commit. Merging early breaks fresh clones even with clean manifests
  (the import target doesn't exist on npm).
- A consumer **shim duplicating an unpublished platform component** is an exception
  with a hard expiry (deleted the same day the batch publishes), never a pattern. If
  a shim is being considered, first ask whether the batch should simply publish now —
  "ship what's green" usually wins.

## Enforcement

Workflow rules above are not advisory. Each repo ships `bin/guards.sh` (repo-specific
sections appended to a shared core) and runs it:

- **Locally:** first line of `bin/test.sh` (or `npm test` on platform) — fails before
  push if a tripwire trips.
- **CI:** job **`guards`** calls the org reusable workflow
  `heybray-labs/.github/.github/workflows/guards.yml@main` (fast; no `npm ci` except
  platform changeset status). Job **`verify`** runs typecheck/build/tests and depends on
  `guards`.
- **Merge:** org branch rulesets (owner-configured) require **`guards`** and **`verify`**
  to pass on PRs to `main`. A tripwire that has never fired in CI is not done — see
  `docs/guards-verification.md`.

## Batched platform work (approved 6A-review policy)

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

## Versioning reminders (1.0.0 policy, architecture doc §6)

Breaking DB schema change or runtime API in a platform package = **major** + migration
notes. Additive = minor. Fixes = patch. Deprecated aliases survive until the next major.
Feature packages (`@heybray/scenarios-*`, `@heybray/flashcards-*`) are 0.x while the
premium composition is stabilizing — same changeset discipline, looser semver latitude.
Feature packages ship raw `.ts` source (consumable by tsx/vite apps only) — a recorded
convention, not an accident (friction log FL-6A4-007).
