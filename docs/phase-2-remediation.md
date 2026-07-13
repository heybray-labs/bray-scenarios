# Phase 2 Remediation Brief — Review Fixes Before Release

**Prerequisites:** read `AGENTS.md`, `docs/phase-2-implementation.md` (the phase this
remediates), and `docs/platform-architecture.md` §3. This is the executable work order for
the Phase 2 review findings. One fix per commit, in order. Fixes 1–3 are blockers; Fix 4's
upgrade test is the release gate.

## Rules

- Migrations `0000`–`0009` are shipped history — do NOT edit them. No new migrations are
  expected in this brief (Fix 1 is code + tests only).
- Fix 1 deliberately *restores* pre-Phase-2 behavior (manual grades counted in stats);
  everything else is zero-behavior-change.
- No dependency changes, no Phase 3/4 work, no dropping old tables (still the future 0010).

## Fix 1 — Manual re-grades must reach `activity_log` (behavioral regression)

**Problem.** `activity_log` is written exactly once, at attempt submission
(`server/controllers/roleplay-system.controller.ts` — the single `recordResult` call around
L2269–2293). Manual grading — `gradeAttempt`, around L2452–2460 — updates
`roleplay_attempts.score`/`isPassed` but never updates `activity_log`. Pre-Phase-2 code
read live `roleplay_attempts`, so manual grades showed up. Now:
- An attempt with `gradingStatus="failed"` (logged with `score_percent: null`,
  `passed: null`) that is manually passed is **excluded** from `passedCount`/`passRate` on
  `GET /api/points/me/stats` and the team star map.
- The star-map member drawer's `bestScore`
  (`packages/gamification/src/team-star-map.service.ts` `getMemberContentHistory`,
  `max(activity_log.score_percent)`) never reflects manual scores/corrections.

**Fix.**
1. Add to `GamificationService` (`packages/gamification/src/service.ts`):

```ts
/** Update the logged result for an existing activity (e.g. a manual re-grade).
 *  Does NOT award points — award eligibility is decided once, at recordResult time. */
async updateResult(input: {
  contentType: string;
  contentId: number;
  activityId: number;
  scorePercent: number | null;
  passed: boolean | null;
}): Promise<void>
// UPDATE activity_log SET score_percent, passed
// WHERE content_type = $1 AND content_id = $2 AND activity_id = $3
// No-op (do not throw) if no row matches (attempt completed before Phase 2? — no:
// backfill covered those; but stay tolerant and log a warning via the logger).
```

2. Call it from `gradeAttempt` immediately after the `roleplay_attempts` update, with the
   new score/isPassed values. Check whether `overrideCriterionScore` (around L2454) also
   changes the attempt's overall `score`/`isPassed` — if it does, call `updateResult` there
   too; if it only touches criterion rows, leave it.
3. Do NOT award points for manual grades — old behavior only awarded on `auto_graded`, and
   that stays. Only the log fields change.

**Tests (same commit).** In `server/test/api/`, add coverage that:
- submits an attempt whose auto-grading fails (mock the grader to fail — see existing
  mocks in `server/test/mocks/`), manually grades it to a passing score via the admin
  grade endpoint, then asserts `GET /api/points/me/stats` `passedCount` includes it and
  the team star-map member history shows the manual score as `bestScore`;
- manually re-grades an auto-graded attempt to a higher score and asserts the star-map
  `bestScore` reflects the new value.

## Fix 2 — Unify the `is_active` predicate (one line)

`server/gamification.ts:47` (boot `reconcile()` source list) computes
`isActive: r.status === "published" && !!r.published`. The 0008 backfill
(`is_active = (status = 'published')`), `bulkSaveRoleplay`/`syncContent`, and every
pre-Phase-2 read path use `status === 'published'` **alone**. A legacy row with
`status='published'` but `published=false` survives the migration active, then the first
boot deactivates it (vanishing from leaderboards/mastery/publishedCount) and logs spurious
drift.

**Fix:** drop the `&& !!r.published` clause so reconcile matches the migration and
syncContent. Nothing else changes.

## Fix 3 — Single source of truth for drizzle-kit (destructive-tooling landmine)

**Problem (verified empirically).** `server/drizzle.config.ts` globs both
`../shared/schemas/**/*.ts` and `../packages/*/src/schema/**/*.ts`. Two different
`pgTable("point_transactions", …)` definitions are visible (legacy
`shared/schemas/points.ts` and `packages/gamification/src/schema/tables.ts`); drizzle-kit
silently picks the package one, which omits the still-physical
`roleplay_id`/`attempt_id` columns. Any generate/push-style flow would emit destructive
column drops. (Separately: the repo's snapshot chain only covers migration 0000, so
`drizzle-kit generate` has never been a valid "no diff" check here — see Fix 3b.)

**Fix 3a — move legacy defs out of the glob.**
1. Create `server/legacy-schema/` (NOT matched by either glob entry).
2. Move the three legacy table definitions from `shared/schemas/points.ts`
   (`scenarioRewardTiers`, `userScenarioTierRewards`, and the legacy `pointTransactions`
   def) and the whole of `shared/schemas/roleplay-classification-links.ts` into it,
   e.g. `server/legacy-schema/points-legacy.ts` and
   `classification-links-legacy.ts`, each headed:
   `// Legacy tables, unread since Phase 2. Registered in db.ts only so drizzle's
   runtime schema knows they exist. Dropped in migration 0010 (future release).
   Deliberately OUTSIDE the drizzle.config.ts glob — the canonical point_transactions
   definition lives in @heybray/gamification/schema.`
3. Grep and repoint every importer (expected: `server/db.ts`; plus the demo-data files —
   but those move to the package import in Fix 5, do Fix 5 first if easier). Delete the
   emptied files from `shared/schemas/`.
4. Note the residual, accepted gap: the canonical `point_transactions` def will not list
   `roleplay_id`/`attempt_id` even though they physically exist until 0010 drops them.
   That is what Fix 3b's test pins down.

**Fix 3b — replace the broken `db:generate` gate with a schema-parity test.**
Add `server/test/schema-parity.test.ts` (runs in the normal vitest suite against the
migrated test DB):
- For `reward_tiers`, `user_content_tier_awards`, `activity_log`, `gamification_content`,
  `content_classification_links`: assert the column set (name + data type + nullability)
  from `information_schema.columns` **exactly equals** the drizzle definition's columns.
- For `point_transactions`: assert the drizzle definition's columns are a **subset** of
  the physical columns, and that the physical extras are exactly
  `{roleplay_id, attempt_id}` — with a comment that this assertion flips to exact
  equality when migration 0010 lands.
- Remove/adjust the "db:generate produces nothing" line in
  `docs/phase-2-implementation.md`'s verification section (mark it superseded by this
  test, with a one-line explanation that the snapshot chain predates hand-authored
  migrations).

## Fix 4 — Repair the parity net and run the upgrade-path test (release gate)

**4a — fix the golden-test shim.** `server/test/api/gamification-golden.test.ts:39-42`
has `FIELD_SHIM = { attemptId: "activityId" }` — mapping a key the server no longer emits
(the snapshots were regenerated with canonical names in Step 6, so this entry is dead and
backwards). Delete the dead entry (and the shim mechanism itself if nothing uses it), and
add a comment recording honestly that the snapshots were re-baselined during Step 6's
rename, so data-parity for the renamed fields rests on the upgrade-path test below.

**4b — run the upgrade-path test.** This is now the primary before/after parity evidence.
Procedure (document the results in the PR description):
1. Check out the last release tag (the one currently deployed / latest `v*` tag), start
   it with `npm run docker:up` (or the quickstart compose), run `npm run db:seed-demo`
   against it, and record: the global + category leaderboards, one user's
   `/api/points/me/stats`, the team star map, and one member's scenario history
   (curl the endpoints, save the JSON).
2. Check out current `main`, rebuild the image, restart the same compose stack (same DB
   volume — this is an in-place upgrade). Migrations 0008/0009 must apply on boot with
   every assertion passing, and boot `reconcile()` must report zero drift.
3. Run `bin/upgrade-verify.sh` — must pass.
4. Re-curl the same endpoints and diff against step 1: identical data modulo the
   documented field renames (`roleplayId→contentId`, `scenarioTitle→contentTitle`,
   `attemptId→activityId`).
5. Spot-check the UI: leaderboards, category mastery, star map, a results page, points
   history.

## Fix 5 — Finish the `shared/schemas/points.ts` reduction

Three server files still import tier helpers through the legacy shim:
`server/init-db/demo-data/scenarios.ts:4` (`DEFAULT_REWARD_TIERS`),
`server/init-db/demo-data/types.ts:1` and `scenario-briefs.ts:1` (`RewardTierInput`).
Repoint all three at `@heybray/gamification/schema` and delete the re-export block from
the legacy points schema file (which, after Fix 3a, lives in `server/legacy-schema/` and
contains table definitions only).

## Explicitly NOT in scope (accepted, documented)

- The literal `"category"` wire token in `packages/gamification/src/routes.ts:68` and
  `LeaderboardPanel.tsx` — it is the public query-string contract, and the mastery
  dimension itself is config-driven. Revisit when Phase 4 publishes the package (derive
  the wire token from config with a back-compat alias). Add a one-line note to the
  architecture doc's pre-Phase-4 list.
- The tautological assertion in `0008` (unmapped point_transactions check) — shipped
  migration, harmless, leave it.
- Migration 0010 (drop old tables + legacy columns + `legacy_id`) — next release, not now.

## Verification (all must pass)

```bash
npm install                       # no lockfile changes expected beyond nothing
npm run typecheck
npm run build --workspace=client
npm test                          # incl. new Fix-1 tests and schema-parity test
```

Plus the Fix 4b upgrade-path procedure, with its endpoint diffs recorded in the PR.

## Acceptance checklist

- [ ] Manual re-grade flows through to stats/star-map (new tests prove it); no points
      awarded for manual grades
- [ ] `reconcile()`/`syncContent`/0008 all derive `is_active` from `status` only
- [ ] Exactly one `pgTable` definition per physical table inside the drizzle glob
      (`grep -rn 'pgTable(' shared/schemas packages/*/src/schema | sort` shows no
      duplicate table names); legacy defs live in `server/legacy-schema/`
- [ ] schema-parity test green; `db:generate` gate removed from the Phase 2 doc
- [ ] Dead `FIELD_SHIM` entry gone; re-baselining honestly documented in the golden test
- [ ] Upgrade-path test executed and results recorded in the PR description
- [ ] `shared/schemas/points.ts` gone (or empty); demo-data imports point at
      `@heybray/gamification/schema`
- [ ] One fix per commit, messages referencing fix numbers from this brief
```