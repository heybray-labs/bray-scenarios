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

## Ruleset merge block (owner)

Pending: org rulesets requiring **`guards`** + **`verify`** must demonstrably block merge
on one plant PR after owner configures rulesets (see `docs/guards-rollout.md` checklist).
