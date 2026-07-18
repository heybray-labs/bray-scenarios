# Guards Rollout — Mechanical Tripwires for Workflow Rules

**Context:** two workflow-rule violations reached `main` silently (premium navbar
regression; yalc-polluted manifests + unpublished-API imports in both app repos). Both
rules existed in `docs/dev-workflow.md`; neither had blocking enforcement. This brief
wires every grep-able rule into a fast `guards` check across all repos, defined once at
the org level, and pairs with branch rulesets (owner-clicked — see the checklist at the
end) that make checks blocking.

Repos in scope: `bray-platform`, `bray-scenarios`, `bray-flashcards`, `bray-premium`,
`bray-app-template`, plus a new `heybray-labs/.github`.

## Rules

- One commit per concern, per repo. Guards must be fast (< 10s, no `npm ci` except the
  platform changeset check). Use POSIX-portable grep flags — CI is GNU grep.
- Standardize CI job names across ALL repos in this pass: the guard job is named
  **`guards`**, the main build/test job (or its aggregating final job) is named
  **`verify`**. Org-level rulesets require checks *by name* — one ruleset can then cover
  every repo. Rename existing jobs as needed (this is cosmetic; do not restructure jobs).
- Nothing in this brief changes runtime behavior anywhere.

## Step 1 — `heybray-labs/.github` repo (human checkpoint: owner creates it, empty)

Add `.github/workflows/guards.yml` as a **reusable workflow** (`on: workflow_call`):

```yaml
name: guards
on:
  workflow_call:
    inputs:
      changesets:
        type: boolean
        default: false
jobs:
  guards:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }   # merge-base needed for migration guard
      - name: Run repo guards
        run: |
          test -x bin/guards.sh || { echo "bin/guards.sh missing or not executable"; exit 1; }
          ./bin/guards.sh
      - if: ${{ inputs.changesets }}
        uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - if: ${{ inputs.changesets }}
        run: npm ci
      - if: ${{ inputs.changesets }}
        name: Changeset present for source changes
        run: npx changeset status --since=origin/main
```

Each repo's `ci.yml` then adds one job:

```yaml
  guards:
    uses: heybray-labs/.github/.github/workflows/guards.yml@main
    with: { changesets: false }   # true only in bray-platform
```

## Step 2 — `bin/guards.sh` in every repo

Common core (identical everywhere — the reusable workflow runs whatever the repo ships,
so keep the core in sync; the template copy is the reference):

```bash
#!/usr/bin/env bash
set -euo pipefail
fail() { echo "GUARD FAILED: $1" >&2; exit 1; }

# 1. yalc must never reach committed manifests (package.json AND lockfile)
if grep -rn --include='package.json' --include='package-lock.json' \
     -e '\.yalc' . --exclude-dir=node_modules --exclude-dir=.yalc -l >/dev/null 2>&1; then
  fail "yalc reference in a committed manifest — run: yalc remove --all && npm install"
fi

# 2. no deep imports bypassing package exports
if grep -rn --include='*.ts' --include='*.tsx' 'node_modules/@heybray' \
     --exclude-dir=node_modules . >/dev/null 2>&1; then
  fail "deep import into node_modules/@heybray — use the package's public exports"
fi
```

Repo-specific sections appended after the core:

- **`bray-platform`**: the case-insensitive vocabulary gate from `CONTRIBUTING.md`
  (`grep -rni 'scenario\|roleplay' packages/*/src` with the documented allowlist:
  `DEPRECATED` lines, `legacy*` identifiers in the named files, doc-comments) and the
  package-boundary gate (no `@shared`/app-path imports inside `packages/*/src`).
  `ci.yml` passes `changesets: true`.
- **`bray-scenarios`, `bray-flashcards`, `bray-premium`, `bray-app-template`** —
  shipped-migration immutability:

```bash
# 3. shipped migrations are immutable (new files fine; edits to pre-existing ones fail)
BASE_REF="origin/${GITHUB_BASE_REF:-main}"
git fetch -q origin "${GITHUB_BASE_REF:-main}" 2>/dev/null || true
BASE=$(git merge-base HEAD "$BASE_REF" 2>/dev/null || echo "")
if [ -n "$BASE" ]; then
  for dir in server/drizzle drizzle; do
    [ -d "$dir" ] || continue
    while IFS= read -r f; do
      [ -z "$f" ] && continue
      if git cat-file -e "$BASE:$f" 2>/dev/null; then
        fail "shipped migration modified: $f (migrations are append-only)"
      fi
    done < <(git diff --name-only --diff-filter=M "$BASE" -- "$dir"/*.sql 2>/dev/null)
  done
fi
```

  Plus, in the two app repos: the packages-must-not-import-shell boundary grep
  (`packages/*/src` importing `server/`, `src/`, `client/`, or `@shared`).

## Step 3 — Local wiring (agents hit guards before pushing)

In every repo: run `./bin/guards.sh` as the first line of `bin/test.sh` (or a `pretest`
npm script where there's no test.sh). Guards failing locally must fail `npm test` — this
is the pre-push tripwire that doesn't depend on remembering anything.

## Step 4 — Template

`bray-app-template` gets: `bin/guards.sh` (core + migration guard + boundary grep), the
`guards` job in its CI calling the reusable workflow, and the `bin/test.sh` wiring —
so every future app is born enforced. Add a line to `TEMPLATE.md`: guards are not
optional; extend `bin/guards.sh`, don't delete it.

## Step 5 — Prove every tripwire fires (per repo, on a branch)

For each repo: plant a `file:.yalc/x` entry in `package.json` on a scratch branch, open
a PR, confirm the `guards` check fails, then close/revert. For one app repo, also edit a
shipped migration on a branch and confirm guard #3 fires. Record the failing-check links
in `docs/guards-verification.md` (this repo). A tripwire that has never fired is a hope.

## Step 6 — Docs

- `docs/dev-workflow.md`: add a "Enforcement" paragraph pointing at `bin/guards.sh`, the
  reusable workflow, and the ruleset requirement below.
- `bray-platform/CONTRIBUTING.md`: note that the vocabulary/boundary gates now run in CI
  (not just as documented commands).

## Owner checklist (rulesets — GitHub settings, not doable by the agent)

1. Create empty `heybray-labs/.github` repo (Step 1 needs it).
2. Org → Settings → Repository → Rulesets → New branch ruleset:
   - Target: all repos matching `bray-*`; branch: default.
   - Require a pull request before merging (0 approvals is fine solo).
   - Require status checks to pass: **`guards / guards`** and **`verify`** — these are
     the check-run names GitHub records. The PR UI decorates them as
     `CI / guards / guards (pull_request)` / `CI / verify (pull_request)` (workflow-name
     prefix + trigger suffix), but rulesets match the undecorated names. The org-level
     "Add checks" box offers no suggestions; type the names and click "Add".
     Require branches up to date: off (solo; merge conflicts self-police).
   - Bypass list: empty (or owner-only, for emergencies).
3. Per repo → Settings → General: enable **Allow auto-merge** (agents open PRs and set
   auto-merge; lands when green).
4. After Step 5's verification: confirm a red `guards` check actually blocks the merge
   button on one of the plant PRs before closing it.

## Acceptance checklist

- [ ] `heybray-labs/.github` reusable workflow live; all five repos call it
- [ ] CI job names standardized: `guards` + `verify` everywhere
- [ ] `bin/guards.sh` in all five repos + template, wired into local test path
- [ ] Platform guards include vocabulary + boundary gates + changeset status
- [ ] App/premium/template guards include migration immutability
- [ ] Every tripwire proven to fire (links recorded in `docs/guards-verification.md`)
- [ ] Docs updated (`dev-workflow.md` enforcement section, platform CONTRIBUTING)
- [ ] Owner rulesets active; a red check demonstrably blocks a merge
