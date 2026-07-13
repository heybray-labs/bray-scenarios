# Phase 2 Implementation Brief — Gamification Decoupling

**Prerequisites:** read `AGENTS.md` and `docs/platform-architecture.md` §3 (the design this
phase implements) and §7 Phase 2. This is the executable work order. It is the highest-risk
phase of the platform rework: it reshapes live data. Work one step per commit, in order.
Do not blend steps.

## Goal

Remove every roleplay dependency from the gamification layer: polymorphic
`(content_type, content_id)` references replace roleplay FKs, a new `activity_log` replaces
all `roleplay_attempts` reads, a `gamification_content` projection replaces all
`JOIN roleplays`, and the code moves into `packages/gamification` +
`packages/gamification-react`. Also pays down all "Carried debt from Phase 1" items listed
in the architecture doc.

## Rules for this phase (different from Phase 1)

- ✅ DB migrations ARE allowed: new files `0008` and `0009` in `server/drizzle/` +
  journal entries. **Additive only** — existing tables/columns are not altered or dropped.
- ✅ API payload field renames ARE allowed (`roleplayId`→`contentId`,
  `scenarioTitle`/`roleplayTitle`→`contentTitle`) but ONLY with client + tests updated in
  the same commit.
- **The bar is feature parity, proven by golden-output tests (Step 1), not byte-parity of
  code.** Leaderboards, mastery, star map, results reveal, points history must produce
  identical data before and after.
- ❌ Out of scope: dropping old tables (`scenario_reward_tiers`,
  `user_scenario_tier_rewards`, `roleplay_classification_links`, the old
  `point_transactions.roleplay_id`/`attempt_id` columns) — that is a follow-up release
  after this one ships. ❌ No Phase 3 extension points (EntitlementProvider, AuditSink,
  AdminRegistry). ❌ No package builds/publishing, no per-package migration folders
  (Phase 4 — migrations stay in `server/drizzle/`). ❌ No dependency upgrades.

## Step 1 — Golden-output baseline (BEFORE any other change)

Create `server/test/api/gamification-golden.test.ts`. Against a fresh DB with the demo seed
(`server/init-db/seed-demo.ts` — deterministic via `demo-data/tier-progress.ts`), snapshot
the **full JSON responses** of:

- `GET /api/points/me/stats`, `/api/points/me/history` (page 1),
  `/api/points/recent-stars`
- `GET /api/points/leaderboard` — global and category scope, both periods
- `GET /api/teams/all/star-map` (as a manager user)
- One member's `/api/teams/:id/members/:userId/scenario-history` and
  `.../roleplays/:roleplayId/attempts`

Use vitest snapshots committed to the repo. Add a small normalization helper (sort arrays
deterministically, strip volatile timestamps) and a **field-mapping shim**: when Step 6
renames payload fields, update only the shim (`roleplayId→contentId`,
`scenarioTitle→contentTitle`) so the same snapshots keep validating data equality. These
tests must run green after every subsequent step.

## Step 2 — Migration `0008_gamification_generalization.sql`

Add the file + journal entry (`idx: 8`, `tag: "0008_gamification_generalization"`) in
`server/drizzle/meta/_journal.json`, matching the style of `0002_points_and_leaderboard.sql`.
Content (adjust syntax to match existing migrations exactly):

```sql
CREATE TABLE reward_tiers (
  id serial PRIMARY KEY,
  content_type text NOT NULL DEFAULT 'scenario',
  content_id integer NOT NULL,
  tier_name text NOT NULL,
  min_score_percent integer NOT NULL,
  reward_points integer NOT NULL DEFAULT 0,
  order_index integer NOT NULL DEFAULT 0,
  star_level integer NOT NULL,
  color text,
  icon text,
  legacy_id integer  -- maps to scenario_reward_tiers.id; dropped when old tables drop
);
CREATE UNIQUE INDEX reward_tiers_content_star
  ON reward_tiers (content_type, content_id, star_level);

INSERT INTO reward_tiers (content_type, content_id, tier_name, min_score_percent,
    reward_points, order_index, star_level, color, icon, legacy_id)
SELECT 'scenario', roleplay_id, tier_name, min_score_percent,
    reward_points, order_index, star_level, color, icon, id
FROM scenario_reward_tiers;

CREATE TABLE user_content_tier_awards (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_type text NOT NULL DEFAULT 'scenario',
  content_id integer NOT NULL,
  highest_tier_id integer REFERENCES reward_tiers(id) ON DELETE SET NULL,
  total_points_awarded integer NOT NULL DEFAULT 0,
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX user_content_tier_awards_user_content
  ON user_content_tier_awards (user_id, content_type, content_id);

INSERT INTO user_content_tier_awards (user_id, content_type, content_id,
    highest_tier_id, total_points_awarded, updated_at)
SELECT u.user_id, 'scenario', u.roleplay_id, rt.id, u.total_points_awarded, u.updated_at
FROM user_scenario_tier_rewards u
LEFT JOIN reward_tiers rt ON rt.legacy_id = u.highest_tier_id;

ALTER TABLE point_transactions
  ADD COLUMN content_type text,
  ADD COLUMN content_id integer,
  ADD COLUMN activity_id integer;
UPDATE point_transactions
  SET content_type = 'scenario', content_id = roleplay_id, activity_id = attempt_id;

CREATE TABLE activity_log (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_type text NOT NULL,
  content_id integer NOT NULL,
  activity_id integer,
  score_percent numeric(5,2),
  passed boolean,
  occurred_at timestamp NOT NULL
);
CREATE INDEX activity_log_user_time ON activity_log (user_id, occurred_at);
CREATE INDEX activity_log_content ON activity_log (content_type, content_id);

INSERT INTO activity_log (user_id, content_type, content_id, activity_id,
    score_percent, passed, occurred_at)
SELECT user_id, 'scenario', roleplay_id, id, score, is_passed, completed_at
FROM roleplay_attempts
WHERE status = 'completed' AND completed_at IS NOT NULL;

CREATE TABLE gamification_content (
  content_type text NOT NULL,
  content_id integer NOT NULL,
  title text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  updated_at timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY (content_type, content_id)
);

INSERT INTO gamification_content (content_type, content_id, title, is_active)
SELECT 'scenario', id, title, (status = 'published') FROM roleplays;

CREATE TABLE content_classification_links (
  content_type text NOT NULL DEFAULT 'scenario',
  content_id integer NOT NULL,
  option_id integer NOT NULL REFERENCES classification_options(id) ON DELETE CASCADE,
  PRIMARY KEY (content_type, content_id, option_id)
);

INSERT INTO content_classification_links (content_type, content_id, option_id)
SELECT 'scenario', roleplay_id, option_id FROM roleplay_classification_links;
```

**In-migration assertions** — after the backfills, add `DO $$` blocks that
`RAISE EXCEPTION` on mismatch. Required checks:

```sql
DO $$
BEGIN
  IF (SELECT count(*) FROM reward_tiers) <> (SELECT count(*) FROM scenario_reward_tiers) THEN
    RAISE EXCEPTION 'reward_tiers backfill count mismatch';
  END IF;
  IF (SELECT count(*) FROM user_content_tier_awards) <> (SELECT count(*) FROM user_scenario_tier_rewards) THEN
    RAISE EXCEPTION 'user_content_tier_awards backfill count mismatch';
  END IF;
  IF (SELECT coalesce(sum(total_points_awarded),0) FROM user_content_tier_awards)
     <> (SELECT coalesce(sum(total_points_awarded),0) FROM user_scenario_tier_rewards) THEN
    RAISE EXCEPTION 'tier award points sum mismatch';
  END IF;
  IF EXISTS (SELECT 1 FROM point_transactions WHERE roleplay_id IS NOT NULL AND content_id IS NULL) THEN
    RAISE EXCEPTION 'point_transactions backfill left unmapped rows';
  END IF;
  IF EXISTS (SELECT 1 FROM user_scenario_tier_rewards u
             WHERE u.highest_tier_id IS NOT NULL AND NOT EXISTS
               (SELECT 1 FROM user_content_tier_awards n
                JOIN reward_tiers rt ON rt.id = n.highest_tier_id
                WHERE n.user_id = u.user_id AND n.content_id = u.roleplay_id
                  AND rt.legacy_id = u.highest_tier_id)) THEN
    RAISE EXCEPTION 'highest_tier_id mapping mismatch';
  END IF;
  IF (SELECT count(*) FROM activity_log)
     <> (SELECT count(*) FROM roleplay_attempts WHERE status='completed' AND completed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'activity_log backfill count mismatch';
  END IF;
  IF (SELECT count(*) FROM gamification_content) <> (SELECT count(*) FROM roleplays) THEN
    RAISE EXCEPTION 'gamification_content backfill count mismatch';
  END IF;
  IF (SELECT count(*) FROM content_classification_links)
     <> (SELECT count(*) FROM roleplay_classification_links) THEN
    RAISE EXCEPTION 'classification links backfill count mismatch';
  END IF;
END $$;
```

The old tables are **left in place and become unread** after Step 5. Do not create views
over them.

## Step 3 — Migration `0009_scenario_binding.sql` (app-owned binding FKs)

Per architecture doc §3, FKs from platform tables into app tables are the app's own
migration (valid because this deployment has exactly one content type):

```sql
ALTER TABLE reward_tiers ADD CONSTRAINT reward_tiers_scenario_fk
  FOREIGN KEY (content_id) REFERENCES roleplays(id) ON DELETE CASCADE;
ALTER TABLE user_content_tier_awards ADD CONSTRAINT ucta_scenario_fk
  FOREIGN KEY (content_id) REFERENCES roleplays(id) ON DELETE CASCADE;
ALTER TABLE activity_log ADD CONSTRAINT activity_log_scenario_fk
  FOREIGN KEY (content_id) REFERENCES roleplays(id) ON DELETE CASCADE;
ALTER TABLE activity_log ADD CONSTRAINT activity_log_attempt_fk
  FOREIGN KEY (activity_id) REFERENCES roleplay_attempts(id) ON DELETE SET NULL;
ALTER TABLE content_classification_links ADD CONSTRAINT ccl_scenario_fk
  FOREIGN KEY (content_id) REFERENCES roleplays(id) ON DELETE CASCADE;
```

Journal entry `idx: 9`. After Steps 2+3: `npm test` green (migrations apply on the fresh
test DB), golden tests still green (nothing reads the new tables yet).

## Step 4 — `packages/gamification` (server package)

New workspace package `@heybray/gamification` (same package.json shape as the others:
private, 0.0.1, `main`/`exports` → `.ts` source, `"./schema"` subpath, typecheck script,
`dependencies`: `@heybray/server-kit`, `@heybray/identity`, `@heybray/taxonomy`,
drizzle-orm, express, zod — copy version ranges from server).

**`src/schema/`**: Drizzle definitions for the five new tables (matching Step 2 DDL —
`content_id` has NO `.references()` here; the binding FK is app-side), plus ALL pure
helpers moved verbatim from `shared/schemas/points.ts:68-231`: `CANONICAL_TIER_NAMES`,
`REWARD_TIER_DISPLAY_PRESETS`, `starLevelFromTierName`, `tierNameFromStarLevel`,
`resolveStarLevelFromTier`, `resolveRewardTierDisplay`, `deriveStarLevel`,
`maxRewardPoints`, `normalizeRewardTiers`, `rewardTierInputSchema`, `DEFAULT_REWARD_TIERS`.
After this step `shared/schemas/points.ts` contains only the three OLD table definitions
(kept for the unread old tables) — mark it `// Legacy tables, unread since Phase 2, dropped
in a follow-up release`.

**`src/service.ts` — `GamificationService`**, constructed with:

```ts
interface GamificationConfig {
  contentTypes: Array<{ type: string; label: string }>;
  masteryDimensionSlug: string;   // Scenarios passes "category"
  managePermission: string;
  tierDefaults?: RewardTierInput[];
}
```

Port `server/controllers/points.controller.ts` (1103 lines) method-by-method. Mapping:

| Old (points.controller.ts) | New |
|---|---|
| `getRewardTiersForRoleplay(roleplayId)` L68 | `getRewardTiers(contentType, contentId)` |
| `getRewardTiersForRoleplays(ids)` L76 | `getRewardTiersForContents(contentType, ids)` |
| `awardPointsForAttempt(attempt, title, userId, score)` L94 | `recordResult(input)` — see below |
| `getUserPointsTotal/Summary` L165/L176 | unchanged signatures |
| `getUserProgressStats` L184 | same, but published-count/streaks read `gamification_content` (is_active) + `activity_log` — **no roleplays/roleplayAttempts imports** |
| `getCategoryMasteryRankings` L271 | `getMasteryRankings(userId)` — dimension slug from config (kills hardcoded `"category"` at L292/L348) |
| `getUserPointsHistory` L410 | same; title from `gamification_content` join |
| `resolveNextTierForScore` L492 | `(contentType, contentId, userId, bestScore)` |
| `getPointsForAttempt` L630 / `getUserTierReward` L642 | `getPointsForActivity` / `getUserTierAward` |
| `getScenarioProgress` L656 | **split** — generic part becomes `getContentProgress(userId, contentType, contentId)` (tiers, best score, star level, points); criterion logic stays app-side (Step 5) |
| `getResultsContext` L539 | **split** — same treatment (maxAttempts/criterion parts stay app-side) |
| `getLeaderboard` L809 / `getRecentStarAchievements` L833 | scope becomes `"global" \| "dimension-option"`; titles/active from `gamification_content` |
| `queryLeaderboardEntries` L896 / `getCurrentUserLeaderboardEntry` L981 | **rewrite the raw rank CTEs** (L1036-1088): SQL references only `point_transactions (content_type, content_id)`, `gamification_content`, `content_classification_links`, `classification_options`, `classification_dimensions`. Zero `roleplays`/`roleplay_classification_links` table names anywhere in package SQL. |

`recordResult` semantics (**critical parity detail**): points are currently awarded ONLY
for `gradingStatus === "auto_graded"` attempts (roleplay-system.controller.ts L2234-2249),
but streaks/lastActive count ALL completed attempts. Therefore:

```ts
recordResult({ userId, contentType, contentId, activityId, scorePercent, passed,
               occurredAt, eligibleForAward }): Promise<PointsAwardResult | null>
// ALWAYS inserts an activity_log row.
// Runs tier/points award logic ONLY when eligibleForAward === true.
// Returns { pointsAwarded, tierName, totalPoints } | null exactly as before.
```

Plus: `syncContent(items)`, `onContentDeleted(contentType, contentId)`, `reconcile()`
(rebuilds `gamification_content` from a caller-supplied source list; returns a drift
report).

**Star map**: move the aggregation methods of
`server/controllers/team-star-map.controller.ts` (getLastActiveAt L102 → activity_log max;
buildMemberStats L128; getStarMap L162; getMemberProgress L267; getMemberScenarioHistory
L304 → `getMemberContentHistory`, reading `gamification_content` +
`content_classification_links` + `user_content_tier_awards`/`reward_tiers` +
`activity_log`) into the package as `TeamStarMapService` (uses identity's
`assertTeamAccess`/`assertMemberTeamAccess`/`hasManagePermission` — those stay in
identity). **`getMemberScenarioAttempts` (L473) stays app-side** — it joins
`roleplay_attempts` transcript data, which is app domain.

**`src/routes.ts`**: `createGamificationRouter(config)` producing the five `/api/points`
routes (same paths as `server/routes/points.ts`).

## Step 5 — App integration (behavior-preserving rewiring)

- `server/controllers/roleplay-system.controller.ts` `submitAttempt` L2234-2249: replace
  `pointsController.awardPointsForAttempt(...)` with `gamification.recordResult({...,
  eligibleForAward: gradingStatus === "auto_graded"})`. Response shape
  (`pointsAwarded/tierName/totalPoints`) unchanged. **Note:** recordResult must be called
  for every completion (not only auto_graded) so activity_log matches old streak behavior —
  call it once at completion with the flag.
- Content sync calls: `bulkSaveRoleplay` L398 (insert + title updates), `publishRoleplay`
  L1111, `unpublishRoleplay` L1131, `duplicateRoleplay` L601 → `gamification.syncContent`;
  `deleteRoleplay` L593 → rely on the Step 3 CASCADE (no call needed) but keep
  `onContentDeleted` documented for apps without binding FKs.
- Boot: after migrations in `server/index.ts`, run `gamification.reconcile()` with the
  roleplays list; log a warning on drift (do not crash).
- `server/app.ts`: `createGamificationRouter({ contentTypes: [{type:"scenario",
  label:"Scenario"}], masteryDimensionSlug: "category", managePermission:
  MANAGE_PERMISSION })` mounted at `/api/points`; star-map routes call the package's
  `TeamStarMapService`; the member-attempts route stays app-side in
  `server/routes/team-star-map.ts`.
- `server/db.ts`: register `gamificationSchema`; the OLD points tables stay registered
  (they still exist) — mark legacy.
- New app-side `server/controllers/scenario-results.controller.ts`: the criterion halves of
  old `getScenarioProgress`/`getResultsContext` (roleplaySettings.maxAttempts,
  roleplayCriteria, roleplayCriterionScores, `getTopImprovementFromScores` moves here),
  composing `gamification.getContentProgress()` into the exact payloads the client gets
  today. Delete `server/controllers/points.controller.ts` when nothing imports it.
- `server/init-db/seed-demo.ts` L444: `awardPointsForAttempt` → `recordResult`
  (eligibleForAward: true); extend the backdating (L456+) to also backdate
  `activity_log.occurred_at`.
- **Taxonomy carried debt (this is the moment)**: delete
  `packages/taxonomy/src/schema/links-registry.ts` and the `setClassificationLinks` call in
  `server/db.ts:51` — taxonomy now owns the `content_classification_links` drizzle def
  outright. Rewrite `packages/taxonomy/src/service.ts` to be dimension-driven: query links
  generically and return `Record<dimensionSlug, OptionRef | OptionRef[]>` (multi-valued
  when the dimension allows multiple); a small app-side adapter in the roleplay controllers
  reshapes to the existing `{category, audienceLevel, duration, tags}` API payload so
  client responses are unchanged. Delete `shared/schemas/roleplay-classification-links.ts`
  drizzle usage from live code (schema file stays only if the legacy table remains
  registered; mark legacy). Remove the PHASE-2 markers in taxonomy.
- Golden tests + full suite green before moving on.

## Step 6 — `packages/gamification-react` (client package)

New package (deps: `@heybray/ui`, `@heybray/react`; peers: react, react-dom,
@tanstack/react-query, wouter, lucide-react; typecheck script). `git mv`:

- `client/src/components/points/*` (all 9 files)
- `client/src/components/teams/{StarMapTable,StarMapSummaryCards,TeamStarMapComponents,
  star-map-types,star-map-utils,drawer-pink-styles}.*`
- `client/src/lib/reward-tier-utils.ts`
- Generic reveal pieces: `client/src/components/roleplays/results/{stages.ts,
  reveal-hooks.ts,StagePanel.tsx,FieldBlock.tsx}` → `gamification-react/src/reveal/`.
  **`ResultsRevealHero.tsx` stays app-side** (typed by scenario-progress types).

Changes while moving:
- Components take `contentPath: (contentType: string, contentId: number) => string` — add
  it to `AppConfig.routes` in `@heybray/react/config` and pass
  `(_, id) => \`/roleplays/${id}\`` from `client/src/App.tsx`. Replaces the hardcoded links
  in `PointsHistoryDialog.tsx:112` and `RecentStarsPanel.tsx:148`.
- Tier helper imports switch from `@shared/schemas/points` to
  `@heybray/gamification/schema` (update ALL client importers, including the ones staying
  app-side: RoleplayBuilderDialog, ScenarioNextTierStrip, ScenarioRewardsLadder,
  ResultsRevealHero, StarMapSummaryCards).
- **Payload renames in the same commit as the server rename**: `roleplayId`→`contentId`,
  `scenarioTitle`/`roleplayTitle`→`contentTitle` in
  `/api/points/me/history`, `/api/points/recent-stars`, and team scenario-history
  responses. Update `server/test/api/points.test.ts` assertions and the golden-test
  field-mapping shim. Tailwind `content` globs: add
  `../packages/gamification-react/src/**/*.{ts,tsx}`. Dockerfile: add the new packages to
  the COPY lists (same pattern as existing packages).

## Step 7 — Remaining carried debt (small items)

1. **Admin panel adapters**: `MediaManagementPanel` and `ClassificationManagementPanel`
   (in `@heybray/react`) take `{ contentNoun: string, contentInvalidateKey: string,
   taxonomyEndpoint: string }` props supplied by the app (`AppLayout.tsx`) with the current
   values ("scenario", "/api/roleplays", "/api/roleplay-classifications"). Rendered output
   identical. Remove their PHASE-2 markers.
2. **LLM error copy injection**: `createModelFactory` gains optional
   `describeTemperatureFallback?: (providerLabel, model) => string`; app supplies the
   current "Roleplay will omit…" string from `server/roleplay/model-factory.ts`. Package
   default is app-neutral. Remove the marker at `packages/llm/src/model-factory.ts:165`.
3. **Resolve the server-kit ↔ identity cycle**: extract `packages/media`
   (`@heybray/media`, deps: server-kit + identity) containing
   `packages/server-kit/src/{schema/media-assets.ts,media/*}`. server-kit drops its
   `@heybray/identity` dependency. Update `server/db.ts`, `server/app.ts` imports,
   Dockerfile COPYs. Verify the dependency graph is acyclic again
   (`server-kit ← identity ← media`, `server-kit ← media`).

## Step 8 — Documentation

Update `docs/platform-architecture.md`: mark the "Carried debt from Phase 1" items done,
and add a "Deferred to a follow-up release" note listing the old-table drop (future
migration `0010`: drop `scenario_reward_tiers`, `user_scenario_tier_rewards`,
`roleplay_classification_links`, `point_transactions.roleplay_id`/`attempt_id`,
`reward_tiers.legacy_id`) — **not in this phase**.

## Verification (all must pass)

```bash
npm install                       # lockfile: workspace additions only
npm run typecheck                 # includes the two new packages
npm run build --workspace=client
npm test                          # fresh DB runs 0000→0009; full suite + golden tests
```

> **Superseded (Fix 3b):** the old `npm run db:generate` "produces nothing" gate
> was never valid here — the drizzle snapshot chain only covers migration 0000, so
> `drizzle-kit generate` always emits spurious diffs. Schema drift is now caught by
> `server/test/schema-parity.test.ts` (part of `npm test`), which compares each
> canonical drizzle table definition against the migrated DB's
> `information_schema.columns`.

Plus the upgrade path (the critical one):
1. Check out the last release tag, `docker compose up`, seed demo data, note leaderboard/
   star-map/history values.
2. Switch to this branch, rebuild, restart — migrations 0008/0009 apply on boot with all
   assertions passing.
3. `bin/upgrade-verify.sh` green; manually confirm leaderboards, category mastery, team
   star map, a results page, and points history show identical data to step 1.

Behavioral spot-checks on a dev server: complete an attempt → points awarded identically
(auto_graded) and activity logged; publish/rename/unpublish a scenario → leaderboard
title/visibility follows; delete a scenario → its tiers/awards/activity cascade.

## Acceptance checklist

- [ ] All verification commands + upgrade path green; golden snapshots unchanged (modulo
      the documented field mapping)
- [ ] Zero `roleplays`, `roleplay_attempts`, or `roleplay_classification_links` references
      (imports OR raw-SQL table names) inside `packages/gamification/**` — enforce by grep
- [ ] Zero hardcoded `"category"` inside packages — comes from GamificationConfig
- [ ] `recordResult` called on every attempt completion; award only when auto_graded
- [ ] Old tables untouched after their 0008 backfill; no view/trigger hacks
- [ ] links-registry deleted; taxonomy owns `content_classification_links`; dependency
      graph acyclic after the media extraction
- [ ] One step per commit; commit messages reference step numbers from this brief
```