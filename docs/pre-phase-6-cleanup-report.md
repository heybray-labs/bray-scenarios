# Pre-Phase-6 Cleanup Report — Wire Vocabulary, Legacy Drop, CI Publish, Template

**Date:** 2026-07-17  
**Status:** Complete (Parts A–F)  
**Brief:** [`docs/pre-phase-6-cleanup.md`](./pre-phase-6-cleanup.md)  
**Prerequisites:** [`docs/phase-5-implementation-report.md`](./phase-5-implementation-report.md), [`bray-platform/docs/app-shape-decision.md`](https://github.com/heybray-labs/bray-platform/blob/main/docs/app-shape-decision.md)  
**Architecture:** [`docs/platform-architecture.md`](./platform-architecture.md) §6 (versioning), §7 (roadmap)

This report is a handoff summary for the architect agent: what was done across four repos, what was verified, what was decided, and the final 1.0.0 pin state.

---

## 1. Executive summary

The pre-Phase-6 cleanup closes residual debt from Phases 2–5 so the template repo and a future `1.0.0` release are not built on legacy gamification schema, broken CI publish, or Scenarios-shaped wire vocabulary.

**Outcome:** CI publish with provenance is restored and validated by real `0.3.x` and `1.0.0` releases. Scenarios migration `0010` drops legacy tables/columns. The platform publishes neutral star-map contracts and drops `reward_tiers.legacy_id`. Flashcards and Scenarios adopt `0.3.x` then `1.0.0`; Flashcards closes the Phase 5 grep deviation. **`heybray-labs/bray-app-template`** ships as the ratified standalone-app starter. **Part F closed:** owner ratified the §6 API-stability commitment; all 10 `@heybray/*` packages published at **1.0.0** with provenance; Scenarios, Flashcards, and Template green on `^1.0.0`.

---

## 2. Objectives vs results

| Objective | Result |
|---|---|
| Fix CI npm publish; no manual publishes in this brief | ✅ Parts C/D release landed via CI; provenance on `0.3.1` |
| Scenarios migration 0010 before platform `legacy_id` drop | ✅ Order honored; parity exact after Part D |
| Wire-path neutralization before template extraction | ✅ Platform `0.3.0` + apps adopt neutral paths first |
| Template repo per ratified ADR | ✅ `bray-app-template` pushed; local green |
| Flashcards grep clean (`src/` + `server/`) | ✅ Zero matches |
| Platform grep gate (deprecated aliases only) | ✅ `// DEPRECATED:` lines only in package source |
| 1.0.0 prepared + ratified | ✅ | Part F — PR #8 merged; published with provenance |
| Human checkpoints paused on | ✅ | NPM token, template repo, 1.0.0 ratification |

---

## 3. Why the order mattered (validated)

The brief's dependency chain was followed strictly:

1. **Part A (CI publish)** — fixed before any new releases so Parts C–D prove the pipeline, not another manual workaround.
2. **Part B (Scenarios 0010)** — physical `legacy_id` column dropped before the published Drizzle def removed it (parity test would fail otherwise).
3. **Part C (platform neutralization)** — star-map contract neutralized before template extraction (template is a multiplier).
4. **Part E (template)** — built from post-Part-D flashcards chassis.
5. **Part F (1.0.0)** — deliberately last; policy lock only after vocabulary cleanup.

**Context used:** zero production installs (owner-confirmed) — legacy drops shipped immediately without multi-release staging.

---

## 4. Part A — CI publish fix (`bray-platform`)

### Problem (carried from Phase 4/5)

Automated `changeset publish` from GitHub Actions failed with misleading **E404** (npm masking auth failure). Phase 5 relied on manual publish as `brayg`. Provenance was disabled in `release.yml` during debugging.

### Fixes (one concern per commit)

| Commit | Summary |
|---|---|
| `b117378` | Release workflow auth — `registry-url` + `NODE_AUTH_TOKEN` on publish step |
| `abcc5af` | Re-enable npm publish provenance attestations |
| `d9c9c67` | Verify step checks `NODE_AUTH_TOKEN` not `NPM_TOKEN` |

### Human checkpoint

Owner regenerated `NPM_TOKEN` as an npm **Automation** token (2FA bypass, `@heybray` scope) and updated the repo secret. Owner later made `heybray-labs/bray-platform` **public** to unblock provenance attestation (private-repo E422).

### Verification

Part C's `0.3.0` release published **via CI** with provenance. Follow-up `0.3.1` also CI-published.

```bash
npm view @heybray/gamification dist.attestations
# → provenance predicate present on 0.3.1
```

**No manual publishes** were performed during Parts B–E of this cleanup.

---

## 5. Part B — Scenarios migration 0010 (`bray-scenarios`)

### Delivered

| Item | Detail |
|---|---|
| Migration | `server/drizzle/0010_drop_legacy_gamification.sql` + journal entry |
| Drops | `scenario_reward_tiers`, `user_scenario_tier_rewards`, `roleplay_classification_links` |
| Column drops | `point_transactions.roleplay_id`, `point_transactions.attempt_id`, `reward_tiers.legacy_id` |
| Code | Deleted `server/legacy-schema/`; removed registrations from `server/db.ts` |
| Tests | `schema-parity.test.ts` — `point_transactions` flipped to **exact equality** immediately |

### Commit

| Commit | Summary |
|---|---|
| `399fd46` | Drop legacy gamification tables and columns (migration 0010) |

### Temporary test state (expected)

`reward_tiers` exact parity failed against published schema still carrying `legacy_id` until Part D pin bump — brief allowed `.todo`/skip; assertion was restored without weakening once `0.3.0` landed.

### Verification

- Migrations `0000`–`0009` untouched
- Fresh DB migrate `0000`→`0010` clean
- Full suite green (140 tests at execution time)
- Golden gamification tests untouched

**Remote:** commit local only at report time — push before 1.0.0 ratification baseline.

---

## 6. Part C — Platform release (`bray-platform`)

### Changeset scope (one PR)

| Change | Packages | Version bump |
|---|---|---|
| Drop `reward_tiers.legacy_id` from schema (FL-005) | `@heybray/gamification` | 0.2.x → **0.3.0** |
| Wire-path neutralization (FL-014 completion) | `@heybray/gamification`, `@heybray/gamification-react` | **0.3.0** |
| `examples/basic-app` neutral paths + pins | examples | — |

### Wire-path neutralization

| Surface | Neutral form | Legacy (deprecated) |
|---|---|---|
| Member history route | `.../content-history` | `.../scenario-history` |
| Attempt drill-in | `.../contents/:contentId/attempts` | `.../roleplays/:contentId/attempts` |
| Response key | `contents` | `scenarios` (alias in gamification-react only) |
| Drawer style key | `contentRow` | `scenarioRow` |

Exported route-path constants in `@heybray/gamification` and `@heybray/gamification-react` (`star-map-paths` subpath).

**Grep gate:** `grep -rn 'scenario\|roleplay' packages/*/src` returns only lines with `// DEPRECATED:`.

### Commits

| Commit | Summary |
|---|---|
| `6e2c57d` | Wire-path neutralization + `legacy_id` drop |
| `ead0d5d` | Version packages — gamification + gamification-react 0.3.0 |
| `de382b7` | Ship `star-map-paths` subpath exports (0.3.1 follow-up) |

### Follow-up publish (0.3.1)

`0.3.0` omitted tsup build entries for `star-map-paths` subpath imports. Apps used inline path strings until `0.3.1` fixed the export. Non-blocking for app adoption (`^0.3.0` resolves to `0.3.1`).

### Verification

- Platform CI green including `examples/basic-app` integration
- CI publish with provenance — **Part A proof satisfied**

---

## 7. Part D — App adoption

### Scenarios (`bray-scenarios`)

| Item | Detail |
|---|---|
| Pins | `@heybray/gamification@^0.3.0`, `@heybray/gamification-react@^0.3.0`; others `^0.1.x` / `^0.1.2` |
| Star-map routes | Neutral routes mounted **alongside** thin legacy `scenario-history` alias |
| Client | `ScenarioListRow` uses `/contents/:id/attempts`; gamification-react defaults pick up neutral paths |
| Parity | `reward_tiers` exact-match restored (no skips) |
| Hoist | Root `package.json` hoists `@heybray/gamification` for shared schema resolution |

| Commit | Summary |
|---|---|
| `67e4ef1` | Adopt `@heybray/*` 0.3.0 and neutral star-map routes (Part D) |

**Intentional residual:** Scenarios domain vocabulary (`roleplay`, `scenario`) remains in app code and legacy route alias — app-specific, not platform leakage.

**Remote:** commit local only at report time.

### Flashcards (`bray-flashcards`)

| Item | Detail |
|---|---|
| Pins | `@heybray/gamification@^0.3.0`, `@heybray/gamification-react@^0.3.0` |
| Migration | `drizzle/0002_drop_legacy_id.sql` |
| Routes | Legacy team routes **deleted**; neutral `content-history` / `contents/:id/attempts` only |
| Client | `DeckListRow` neutral fetch paths; `ContentListRowComponent` pattern |
| Grep | `grep -ri 'roleplay\|scenario' src/ server/` → **zero** (closes Phase 5 deviation) |

| Commit | Summary |
|---|---|
| `2b770d0` | Adopt `@heybray/*` 0.3.0 and neutral star-map paths (Part D) |

**Remote:** commit local only at report time.

### Verification

| App | typecheck | build | tests |
|---|---|---|---|
| Scenarios | ✅ | ✅ | ✅ 140 |
| Flashcards | ✅ | ✅ | ✅ 36 |

---

## 8. Part E — Template extraction (`bray-app-template`)

### Human checkpoint

Owner created empty repo: `https://github.com/heybray-labs/bray-app-template`

### Delivered

Built from post-Part-D flashcards **minus deck domain**, per ratified ADR single-package shape:

| Layer | Contents |
|---|---|
| Placeholder domain | `items` table + `item_attempts`; CRUD, publish, attempt recording |
| Chassis | `server/app.ts`, `db.ts`, `index.ts`, `drizzle-packages-schema.ts`, `media-usage.ts`, seed patterns |
| Client | `ItemsPage`, `ItemListRow`, `TeamStarMapPage`, admin panels, whitelabel CSS |
| Infra | Test harness (25 API tests), Dockerfile, GitHub Actions CI, `AGENTS.md`, `.env.example` |
| Customization | `TEMPLATE.md` checklist; **22** greppable `TEMPLATE-TODO:` markers |

### Ports (collision avoidance)

| Service | Port |
|---|---|
| API | 3103 |
| Vite dev | 5176 |
| Test Postgres | 5436 |

### Commit

| Commit | Summary |
|---|---|
| `76b5647` | Initial template — items placeholder, harness, TEMPLATE.md |

### Verification

| Check | Status |
|---|---|
| `npm run typecheck` | ✅ |
| `npm run build` | ✅ |
| `npm test` | ✅ 25/25 |
| `docker build` | ✅ |
| Remote CI | Pushed; Actions status unconfirmed at report time (GH API 503/404 during check) |

### Friction log → template mapping

`TEMPLATE.md` derives checklist from flashcards `[boilerplate]` entries: FL-001, FL-002, FL-007, FL-008, FL-009, FL-010, FL-013, FL-015, FL-018, FL-020.

Closes [bray-platform#7](https://github.com/heybray-labs/bray-platform/issues/7) extraction scope.

---

## 9. Published package inventory (npm, post-cleanup)

| Package | Version | Changed in cleanup? |
|---|---|---|
| `@heybray/gamification` | **0.3.1** | Yes — schema + star-map |
| `@heybray/gamification-react` | **0.3.1** | Yes — defaults + paths |
| `@heybray/server-kit` | 0.1.2 | No |
| `@heybray/identity` | 0.1.1 | No |
| `@heybray/media` | 0.1.1 | No |
| `@heybray/taxonomy` | 0.1.2 | No |
| `@heybray/react` | 0.1.2 | No |
| `@heybray/ui` | 0.1.1 | No |
| `@heybray/llm` | 0.1.1 | No |
| `@heybray/dev-config` | 0.1.1 | No |

All consumer apps pin `^0.3.0` for gamification packages (resolves to `0.3.1` on install).

---

## 10. Repo sync state (at report time)

| Repo | `main` vs `origin` | Cleanup commits on remote? |
|---|---|---|
| `heybray-labs/bray-platform` | In sync | ✅ |
| `heybray-labs/bray-app-template` | In sync | ✅ `76b5647` |
| `heybray-labs/bray-scenarios` | **Ahead 2** | ❌ `399fd46`, `67e4ef1` local |
| `heybray-labs/bray-flashcards` | **Ahead 1** | ❌ `2b770d0` local |

**Recommendation:** Push Scenarios and Flashcards before Part F so the ratified 1.0.0 baseline includes full cleanup on remote.

---

## 11. Acceptance checklist (brief §154–163)

| Criterion | Status | Notes |
|---|---|---|
| CI-published release with provenance | ✅ | `0.3.0` / `0.3.1`; no manual publishes in brief |
| Legacy gone; parity exact | ✅ | 0010 + platform schema; tests exact |
| Platform grep gate | ✅ | Deprecated aliases only |
| Flashcards grep clean | ✅ | Phase 5 deviation closed |
| `bray-app-template` exists + checklist | ✅ | 22 `TEMPLATE-TODO:` markers |
| 1.0.0 prepared + ratified | ✅ | Part F complete |
| All human checkpoints paused on | ✅ | NPM token, template repo, 1.0.0 ratification |

---

## 12. Phase 5 open items — resolution

| Phase 5 open item | Resolution |
|---|---|
| Merge bray-platform#6 + regenerate NPM_TOKEN | ✅ Done in Part A |
| Extract `bray-app-template` (issue #7) | ✅ Part E |
| FL-005: drop `legacy_id` | ✅ Scenarios 0010 + platform 0.3.0 |
| FL-014: star-map neutral paths | ✅ Platform 0.3.0; Flashcards fully neutral; Scenarios dual-mount |
| CI publish before Phase 6 | ✅ CI publish restored |
| Flashcards grep deviation | ✅ Zero in `src/` + `server/` |

---

## 13. Intentional residuals (not blockers for 1.0.0)

| Item | Rationale |
|---|---|
| Scenarios `scenario-history` route alias | Part D spec — stale-client window; thin alias only |
| Scenarios domain `roleplay`/`scenario` vocabulary | App-specific content type; not platform API |
| Platform `// DEPRECATED:` path/style aliases | Grep gate; removable in future major |
| Apps use inline star-map paths | Works; `@heybray/gamification/star-map-paths` available since 0.3.1 |
| Scenarios/Flashcards unpushed commits | Operational; push before ratification |
| `@heybray/llm` at 1.0.0 without second LLM consumer | Architect may note lightly exercised; ships with platform bundle |

---

## 14. Part F — 1.0.0 *(complete)*

Owner ratified the §6 API-stability commitment **2026-07-17**. Part F executed in sequence:

### F1 — Push outstanding app commits

- `bray-scenarios`: `399fd46` (migration 0010), `67e4ef1` (adopt `^0.3.0`) → `origin/main`
- `bray-flashcards`: `2b770d0` (adopt `^0.3.0`) → `origin/main`

### F2 — Platform pre-1.0.0 fixes

- Neutral `detachedCount` on media delete (`detachedFromScenarios` deprecated alias retained)
- Case-insensitive vocabulary gate in `bin/check-scenarios-vocabulary.sh` + CI
- Changesets for media/react + 1.0.0 policy-lock bundle

### F3 — Template hygiene

- `server/test/env.ts`: neutral test DB/media names; port `5176`
- Grep `deck|flashcard` in `src/` + `server/` → zero

### F4 — Publish 1.0.0

- Changesets Version Packages PR [#8](https://github.com/heybray-labs/bray-platform/pull/8) merged
- CI published all 10 `@heybray/*` packages at **1.0.0** with npm provenance (`dist.attestations` non-null)

### F5 — Consumer pin bumps

| Repo | Pin | Local verification |
|---|---|---|
| `bray-scenarios` | `^1.0.0` all `@heybray/*` | typecheck ✅, build ✅, **140 tests** ✅ |
| `bray-flashcards` | `^1.0.0` all `@heybray/*` | typecheck ✅, build ✅, **36 tests** ✅ |
| `bray-app-template` | `^1.0.0` all `@heybray/*` | typecheck ✅, build ✅, **25 tests** ✅ |

**Scenarios dedupe fix:** stale lockfile entries left nested `@heybray/gamification@0.3.0` copies under `client/` and `server/` workspaces, so `setDatabase` bound one `@heybray/server-kit` instance while `GamificationService` read `db` from another (`syncContent` → `Cannot read properties of undefined (reading 'insert')`). Resolved by regenerating `package-lock.json` and adding root `overrides` for all `@heybray/*` at `^1.0.0`, plus hoisting `@heybray/gamification`, `@heybray/identity`, and `@heybray/media` as root devDependencies for `shared/` schema resolution.

### Published package inventory (npm, post-1.0.0)

| Package | Version |
|---|---|
| `@heybray/gamification` | **1.0.0** |
| `@heybray/gamification-react` | **1.0.0** |
| `@heybray/server-kit` | **1.0.0** |
| `@heybray/identity` | **1.0.0** |
| `@heybray/media` | **1.0.0** |
| `@heybray/taxonomy` | **1.0.0** |
| `@heybray/react` | **1.0.0** |
| `@heybray/ui` | **1.0.0** |
| `@heybray/llm` | **1.0.0** |
| `@heybray/dev-config` | **1.0.0** |

All consumer apps pin `^1.0.0`.

---

## 15. Recommendations for architect

1. **Push app cleanup commits** before 1.0.0 ratification — remote baseline should match local verification.
2. **Confirm template CI green** in GitHub Actions UI (local proof complete; remote unconfirmed at report time).
3. **Ratify 1.0.0 as a bundle** — brief and §6 say "across the board"; independent per-package 1.0.0 is not the stated policy.
4. **Document deprecated aliases in 1.0.0 changelog** — supported until 2.0.0 or explicit removal milestone.
5. **Optional hygiene:** bump gamification pins to `^0.3.1` explicitly before 1.0.0 jump (already resolved transitively).
6. **Do not remove Scenarios legacy route alias in Part F** — out of scope; optional later cleanup.

---

## 16. Artifact index

| Artifact | Location |
|---|---|
| Cleanup brief | `bray-scenarios/docs/pre-phase-6-cleanup.md` |
| This report | `bray-scenarios/docs/pre-phase-6-cleanup-report.md` |
| Phase 5 report | `bray-scenarios/docs/phase-5-implementation-report.md` |
| App-shape ADR | `bray-platform/docs/app-shape-decision.md` |
| Template repo | https://github.com/heybray-labs/bray-app-template |
| Template checklist | `bray-app-template/TEMPLATE.md` |
| Friction log (source) | `bray-flashcards/docs/friction-log.md` |
| Scenarios migration 0010 | `bray-scenarios/server/drizzle/0010_drop_legacy_gamification.sql` |
| Platform neutralization | `bray-platform` commits `6e2c57d` … `de382b7` |
| Published platform | `@heybray/*@1.0.0` (provenance on CI publish) |
| 1.0.0 merge PR | https://github.com/heybray-labs/bray-platform/pull/8 |

---

## 17. Conclusion

The pre-Phase-6 cleanup achieved its goal: **close structural debt before the 1.0.0 stamp and Phase 6 enterprise work.** CI publish is trustworthy again. Legacy gamification schema is gone from Scenarios and the published package. Wire vocabulary is neutral at the platform boundary. Two consumer apps and a cloneable template prove the post-cleanup platform API. The **1.0.0 policy lock** is in force.

**Parts A–F: closed.** Phase 6 may proceed.
