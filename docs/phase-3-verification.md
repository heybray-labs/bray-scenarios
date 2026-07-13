# Phase 3 Verification — EntitlementProvider gate

Manual verification for `docs/phase-3-implementation.md` Step 10, run against the
`docker-compose.yml` `app` + `db` services (rebuilt image containing all of Phase 3's
commits, seeded demo data, logged in as `admin@demo.local`).

## 1. `DISABLED_FEATURES` unset (default)

`GET /api/features?keys=leaderboard`:

```json
{"leaderboard":true}
```

`GET /api/points/leaderboard`:

```
HTTP 200
```

UI: the homepage leaderboard panel renders normally (the `FeatureGate` wrapping
`LeaderboardPanel` in `client/src/pages/HomePage.tsx` resolves `leaderboard: true` and
renders its children).

## 2. `DISABLED_FEATURES=leaderboard`

Started a second `app` container from the same image with `DISABLED_FEATURES=leaderboard`
injected (`docker compose run --rm -e DISABLED_FEATURES=leaderboard ...`), same DB.

`GET /api/features?keys=leaderboard`:

```json
{"leaderboard":false}
```

`GET /api/points/leaderboard`:

```
HTTP 403
{"message":"Feature \"leaderboard\" is disabled"}
```

Confirmed unrelated routes are unaffected on the same instance — no crash, no error
boundary anywhere else on the page:

```
GET /api/about            -> HTTP 200
GET /api/roleplays        -> HTTP 200
GET /                      -> HTTP 200 (SPA shell still serves)
```

UI: `FeatureGate featureKey="leaderboard"` resolves `leaderboard: false` and renders
`null` for that one panel — the rest of the homepage (progress, mastery, recent stars,
points history) is unaffected, with no error boundary triggered.

## 3. `DISABLED_FEATURES` unset again

Removed the temporary container; the original `app` container (no `DISABLED_FEATURES`
set) was re-checked and behaves exactly as in step 1:

```json
{"leaderboard":true}
```

```
GET /api/points/leaderboard -> HTTP 200
```

Leaderboard fully restored, no state left over from the disabled run (the entitlement
check is per-request/env, not cached across restarts).

## Conclusion

The `EntitlementProvider` gate (`requireFeature("leaderboard")` server-side,
`FeatureGate` client-side) works end-to-end with the OSS `EnvEntitlements` default:
disabling a feature via env var returns a clean 403 from the API and a clean no-render
from the UI, with zero impact on the rest of the app. This is the acceptance evidence
for the Phase 3 "Done when" criterion in `docs/platform-architecture.md` §7.
