# Guards verification — plant-and-prove (Step 5)

Scratch PRs planted deliberate violations; each **`guards / guards`** check failed as
expected. Do not merge these PRs. Close after ruleset verification.

## Prerequisite fix (2026-07-18)

Public repos cannot call reusable workflows in a **private** `heybray-labs/.github` repo.
The org workflow repo was made **public** and reusable-workflow access set to
**organization** before these checks could run.

## Yalc manifest tripwire (all repos)

| Repo | PR | Failing `guards` check |
|------|-----|------------------------|
| bray-platform | [#10](https://github.com/heybray-labs/bray-platform/pull/10) | [job 88085509212](https://github.com/heybray-labs/bray-platform/actions/runs/29646487888/job/88085509212) |
| bray-scenarios | [#35](https://github.com/heybray-labs/bray-scenarios/pull/35) | [job 88085357317](https://github.com/heybray-labs/bray-scenarios/actions/runs/29646427880/job/88085357317) |
| bray-flashcards | [#2](https://github.com/heybray-labs/bray-flashcards/pull/2) | [job 88085513052](https://github.com/heybray-labs/bray-flashcards/actions/runs/29646489420/job/88085513052) |
| bray-premium | [#1](https://github.com/heybray-labs/bray-premium/pull/1) | [job 88085514376](https://github.com/heybray-labs/bray-premium/actions/runs/29646489917/job/88085514376) |
| bray-app-template | [#1](https://github.com/heybray-labs/bray-app-template/pull/1) | [job 88085516339](https://github.com/heybray-labs/bray-app-template/actions/runs/29646490782/job/88085516339) |

Expected log line: `GUARD FAILED: yalc reference in a committed manifest`

## Shipped migration immutability (bray-scenarios)

| Repo | PR | Failing `guards` check |
|------|-----|------------------------|
| bray-scenarios | [#36](https://github.com/heybray-labs/bray-scenarios/pull/36) | [job 88085510729](https://github.com/heybray-labs/bray-scenarios/actions/runs/29646488495/job/88085510729) |

Expected log line: `GUARD FAILED: shipped migration modified: server/drizzle/0000_initial.sql`

## Ruleset merge block (confirmed 2026-07-18)

Org branch ruleset requires check contexts **`guards / guards`** + **`verify`** on
`bray-*` default branches. Confirmed on fresh plant PRs
[#37](https://github.com/heybray-labs/bray-scenarios/pull/37) and
[#38](https://github.com/heybray-labs/bray-scenarios/pull/38) (bray-scenarios, yalc
override plant): `guards / guards` failed in ~5s, merge state **BLOCKED**, auto-merge
armed but unable to fire while the required check fails.

Configuration gotchas discovered:

- **Ruleset contexts must be the check-run names** (`guards / guards`, `verify`), not
  the PR-UI display names (`CI / guards / guards (pull_request)`). The UI prepends the
  workflow name and appends the trigger event for display only; a ruleset entry using
  the decorated name never matches and sits at "Expected — Waiting for status".
- Org-level rulesets offer **no autocomplete suggestions** for check names — type them
  exactly and click "Add".
- A **skipped** required check counts as satisfied (here `verify` skips when `guards`
  fails via `needs: guards`); the failed `guards / guards` alone blocks the merge.
- A run that fails at **0s with "workflow file issue"** is a workflow-file rejection
  (e.g. the reusable workflow couldn't be resolved while `heybray-labs/.github` was
  still private), not a guards/test failure — there are no job logs to read. Seen on
  the first `main` push runs in flashcards/premium/app-template after guards wiring.
- **Re-running a PR's failed run reuses the original context**; a fix (workflow file,
  repo visibility, etc.) only takes effect on a **new commit**, not a re-run.
- **Never add `paths-ignore`/path filters to any `ci.yml`** now that its checks are
  ruleset-required: a PR that doesn't trigger the workflow never reports the check and
  blocks forever on "Expected — Waiting for status".
