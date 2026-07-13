# Phase 2 Remediation — Status

Tracks execution of `docs/phase-2-remediation.md`. One fix per commit.

## Completed

| Fix | Commit | Summary |
|-----|--------|---------|
| 1 — Manual re-grades reach `activity_log` | `de466ce` | `GamificationService.updateResult()` added; called from the manual-grade override path. Updates `activity_log.score_percent`/`passed` only — never awards points. New API test `gamification-regrade.test.ts` proves manual grades land in `/api/points/me/stats` and star-map `bestScore`. |
| 2 — Unify `is_active` predicate | `326c213` | Dropped `&& !!r.published` from boot `reconcile()`; `is_active` now derives from `status === "published"` alone, matching 0008 + `syncContent`. |
| 3a — Legacy defs out of the drizzle glob | `8c85152` | Moved legacy `point_transactions`/`scenario_reward_tiers`/`user_scenario_tier_rewards` and `roleplay_classification_links` into `server/legacy-schema/` (outside `drizzle.config.ts` globs). Exactly one `pgTable` per physical table is now visible to drizzle-kit. |
| 3b — Schema-parity test replaces `db:generate` gate | `43d8ea0` | `server/test/schema-parity.test.ts` compares each canonical drizzle table against `information_schema.columns` (exact match; subset match for `point_transactions` with the accepted `{roleplay_id, attempt_id}` extras). `db:generate` gate marked superseded in `docs/phase-2-implementation.md`. |
| 4a — Remove dead `FIELD_SHIM` | `31fda05` | Deleted the backwards `{ attemptId: "activityId" }` shim (the server emits canonical names since Step 6, so it never fired) and simplified `normalize()`. Documented that the golden snapshots prove structural stability from Step 6 onward; pre/post-rename data parity rests on Fix 4b. |
| 5 — Finish `shared/schemas/points.ts` reduction | `3e92db9` | Deleted the re-export shim; repointed all importers (demo-data `types`/`scenario-briefs`/`scenarios` and `shared/schemas/roleplay-transfer.ts`) at `@heybray/gamification/schema`. |

Green after Fix 5: `npm run typecheck` ✅, `npm run build --workspace=client` ✅.

## Pending

### Fix 4b — Upgrade-path test (release gate) — **NOT YET RUN**

Deferred to a manual run (per decision on 2026-07-13). Docker is available, but the
literal brief step ("check out the latest `v*` tag") does **not** work as written — see
the caveat below. Adjust before running.

#### Caveat: the latest release tag predates gamification

- Latest tag `v1.1.1` ships only migrations `0000`–`0001` — it is **pre-gamification**.
  The points/leaderboard/teams feature (`0002`–`0007`) merged *after* v1.1.1 (PR #31),
  and Phase 2 (`0008`/`0009`) is still unreleased.
- Diffing gamification endpoints against v1.1.1 is therefore moot: those endpoints/data
  don't exist there.
- The true "last pre-Phase-2 state" that has the full gamification schema **and** seedable
  data is the untagged commit **`2e111b3`** (parent of `ba45365 "Phase 2 Step 1"`), which
  has migrations `0000`–`0007`. Use that as the "old" side to actually exercise the
  `0008`/`0009` data migration.

#### Recommended procedure (data-parity variant)

Run from a scratch checkout; use a dedicated `APP_INSTANCE_PREFIX` so the compose project
+ volumes are isolated. The DB volume MUST be shared across the two boots (in-place
upgrade) — do **not** `down -v` between steps 1 and 2.

```bash
# 0. From the repo, prepare an isolated env (edit .env: set APP_INSTANCE_PREFIX=upgradetest)

# 1. OLD side — pre-Phase-2 with gamification data
git checkout 2e111b3
npm run docker:up                 # builds + starts db(0000-0007) + app on the shared volume
npm run db:seed-demo:docker       # seed demo gamification data
# capture baselines (admin + a learner token via /api/auth/login):
curl -s "http://localhost:${PORT:-3001}/api/points/leaderboard?scope=global&period=all_time"  > /tmp/old-lb-global.json
curl -s "http://localhost:${PORT:-3001}/api/points/leaderboard?scope=category&category=<slug>&period=all_time" > /tmp/old-lb-cat.json
curl -s "http://localhost:${PORT:-3001}/api/points/me/stats"                                    > /tmp/old-stats.json      # learner auth
curl -s "http://localhost:${PORT:-3001}/api/teams/all/star-map"                                 > /tmp/old-starmap.json    # admin auth
curl -s "http://localhost:${PORT:-3001}/api/teams/all/members/<id>/scenario-history"            > /tmp/old-history.json    # admin auth
npm run docker:down               # stop containers; KEEP the volume

# 2. NEW side — main, in-place upgrade on the SAME volume
git checkout main
npm run docker:up                 # rebuild; 0008/0009 must apply on boot, reconcile() zero drift
#   -> confirm in logs: "Applied migration 0008..."/"0009...", and no drift warnings

# 3. Upgrade verification gate
npm run upgrade:verify            # bin/upgrade-verify.sh must print "Upgrade verified."

# 4. Re-curl the same endpoints and diff — identical modulo the documented field renames:
#    roleplayId -> contentId, scenarioTitle/roleplayTitle -> contentTitle, attemptId -> activityId
curl -s ".../api/points/leaderboard?scope=global&period=all_time"  > /tmp/new-lb-global.json
# ... (repeat for each) ...
diff <(jq -S . /tmp/old-lb-global.json) <(jq -S . /tmp/new-lb-global.json)   # expect no diff
diff <(jq -S . /tmp/old-stats.json)     <(jq -S . /tmp/new-stats.json)       # expect no diff
# history/star-map: expect only the renamed keys to differ

# 5. UI spot-check: leaderboards, category mastery, team star map, a results page, points history.
```

Acceptance for Fix 4b: migrations `0008`/`0009` apply on the in-place upgrade, boot
`reconcile()` reports zero drift, `upgrade-verify` passes, and every endpoint diff is
empty except the three documented field renames. Record the diffs in the PR description.

> Optional second run (fresh-install path): repeat step 1 from tag `v1.1.1` instead of
> `2e111b3` to confirm a full `0002`→`0009` migration applies cleanly on a from-scratch
> upgrade. This exercises migration application but carries no gamification data to diff.
