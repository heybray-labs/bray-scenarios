# Phase 6A · Step 5 — Composed verification (report)

Step 5 closes the 6A arc: publish the 0.1.1 API round (released as **0.1.2** on npm),
pin premium to registry packages, and verify the composed shell end-to-end.

## Publish outcome

| Package | npm version | Notes |
|---|---|---|
| `@heybray/scenarios-server` | **0.1.2** | `registerDomainRoutes()`, `./team-star-map` drill-ins |
| `@heybray/scenarios-client` | **0.1.2** | `PackageLayoutProvider` |
| `@heybray/flashcards-server` | **0.1.2** | Same server API pattern |
| `@heybray/flashcards-client` | **0.1.2** | `PackageLayoutProvider` |

Version **0.1.2** (not 0.1.1): package.json was manually bumped to 0.1.1 before
changesets consumed the pending changeset files; the release PR applied a second patch
bump. Semver `^0.1.1` and `^0.1.2` both resolve to 0.1.2.

Release flow: push to `main` → changesets action opened **Version Packages** PRs
(#33 scenarios, #1 flashcards) → merge triggered `changeset publish` with npm provenance.

Standalone shells now pin `^0.1.2` in `client/package.json` and `server/package.json`.

## Premium changes (Step 5 completion)

- **`package.json`**: feature packages from npm `^0.1.2` (removed local `.tgz` file links)
- **`server/test/mocks/setup-mocks.ts`**: LLM mocks for composed API tests (same pattern as scenarios harness)
- **`server/test/api/step5-composed-verification.test.ts`**: automated Step 5 checklist (ledger, leaderboards, star map, drill-ins, deletion)
- **`docs/6a-verification.md`**: checklist filled from automated run

## Green gates

| Repo | typecheck | build | tests | docker |
|---|---|---|---|---|
| `bray-scenarios` | ✓ | ✓ (client) | 140 passed | ✓ (CI) |
| `bray-flashcards` | ✓ | ✓ (client) | 36 passed | ✓ (CI) |
| `bray-premium` | ✓ | ✓ | 32 passed | ✓ local |

## Deletion cascade finding

Composed DB (no binding FKs, FL-6A4-006): `gamification.onContentDeleted()` removes
`gamification_content` only. `activity_log` and `point_transactions` remain as user history.
Documented in `bray-premium/docs/6a-verification.md` — not a regression; matches platform API.

## Remaining manual checkpoint

Browser walkthrough for dual admin settings panels and `PremiumLayout` section nav on all
routes (items marked pending in `6a-verification.md`). All server-side composed behaviour
is covered by the Step 5 API suite.

## Related docs

- Step 4 report: `docs/phase-6a-step4-report.md`
- 0.1.1 API round: `docs/phase-6a-step4-followup-report.md`
- Premium friction log: `bray-premium/docs/friction-log.md`
- Verification checklist: `bray-premium/docs/6a-verification.md`
