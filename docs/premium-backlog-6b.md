# Premium backlog — deferred to Phase 6B+

Items triaged from [`premium-changes.md`](./premium-changes.md) during 6A closeout (2026-07-19). Do not implement until 6B planning unless promoted explicitly.

## Bulk assign AIs across activities

**Problem:** Admins must configure persona/grader models per scenario in the builder; no bulk endpoint or UI to apply allowlisted models across many roleplays.

**Repos:** `@heybray/scenarios-server` (API), `@heybray/scenarios-client` (admin UI), optionally `@heybray/react` settings panels.

**Size:** Large.

## User deactivate/suspend + score retention

**Problem:** `users.isActive` / `isSuspended` exist and auth blocks inactive logins, but there is no admin API or UI to deactivate users. Points and activity history already persist in `point_transactions` / `activity_log`; optional leaderboard exclusion is not implemented.

**Repos:** `@heybray/identity`, `@heybray/react` (`UsersManagementPanel`), `@heybray/gamification` (leaderboard queries).

**Size:** Medium.

## Pro media settings/browser

**Problem:** Shared `MediaManagementPanel` is a basic upload/grid/delete surface; Premium expects richer browsing, filtering, and usage context.

**Repos:** `@heybray/react`, `@heybray/media`; Premium may compose a premium-only panel via `AdminRegistry`.

**Size:** Medium–large.

## Scenario safety warnings / participant flagging

**Problem:** No domain support for flagging dangerous scenario outcomes or routing warnings back to participants after grading.

**Repos:** `@heybray/scenarios-server`, `@heybray/scenarios-client`, possibly `@heybray/gamification` activity metadata.

**Size:** Large (product design pass required).

## Admin attempt management / practice without points

**Problem:** `maxAttempts` is a hard block at `startAttempt`; no admin path to reset, grant, or extend attempts; no “continue for practice, no points” mode.

**Repos:** `@heybray/scenarios-server`, `@heybray/scenarios-client`, Premium team-star-map admin surfaces.

**Size:** Large.

## Assign activities to users

**Problem:** Teams assign users to teams only; no model for assigning specific scenarios/decks to individuals or cohorts beyond team membership.

**Repos:** New schema + API in Premium or `@heybray/identity`; client assignment UI.

**Size:** Large.

## Points dialog visual redesign (“pro look”)

**Problem:** Shared `PointsHistoryDialog` is functional but not visually differentiated for Premium (filtering, badges, layout). 6A closeout fixes deep links only.

**Repos:** `@heybray/gamification-react`, optional Premium wrapper.

**Size:** Medium (design pass).

## Rate-limit IP allowlist

**Problem:** Rate limits are env-only (`RATE_LIMIT_MAX`, etc.); VPN users may hit auth/API limits during demos. No allowlist or admin override.

**Repos:** `@heybray/server-kit` (`rate-limit.ts`), deployment docs.

**Size:** Small (env allowlist) / Medium (admin UI).

## Scenario home headers / drawer prominence

**Problem:** Team star map drawer UX may not give scenario home headers enough visual weight (noted during manual walkthrough).

**Repos:** `@heybray/gamification-react`, `@heybray/scenarios-client`.

**Size:** Small polish — revisit after 6B UX pass.
