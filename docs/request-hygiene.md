# Request Hygiene Brief — Query Defaults, Rate Limiter, 429/401 Behavior

**Context (CORRECTED after Step 0 — see `docs/request-hygiene-findings.md`):** the
original diagnosis was wrong on two counts: shipped `@heybray/react` already sets
`refetchOnWindowFocus: false` and `retry: false`. Measured reality: (1) the idle-return
burst is **14 queries × 3 component mounts = 42 × 401, zero retries** — a mount
multiplier, not a retry storm; (2) the 401 redirect fires **per `apiRequest` call**, not
single-flight — that's the actual storm; (3) `staleTime` is unset (0), so every remount
re-fetches the full homepage set, matching the wild incident (~28 req/s of authenticated
304 bursts); (4) the limiter default 300/15min is confirmed too tight (429 after ~15
homepage remount rounds); (5) 429s are invisible in request logs because the limiter is
mounted before `requestLogging`. No polling exists anywhere.

This is one small platform batch (touches `@heybray/react` + `@heybray/server-kit`) run
under `docs/dev-workflow.md` discipline: yalc inner loop, per-change changesets, one
publish, tarball verification, PR + guards.

## Step 0 — Measure first (no tuning until this is recorded)

Capture two sessions against `bray-premium` (dev, seeded), using the request log
(`requestLogging` logs every request with path) or the browser network export:

1. **Normal session (15 min):** log in, browse both apps, complete one activity, visit
   leaderboards/star map. Produce a per-route count histogram + total.
2. **Idle-return session:** with a short-lived token (set a small JWT expiry locally, or
   doctor an expired token), leave the window idle past expiry, return/focus. Record the
   burst: total requests, 401 count, retry pattern, whether 429s fire.

Record both in `docs/request-hygiene-findings.md` (this repo) as the before-baseline,
including the top-5 chattiest routes. If the findings contradict the diagnosis above,
STOP and report before changing anything.

## Step 1 — Platform changeset A: `@heybray/react`

- **Single-flight 401 latch** (the incident fix): on the first 401, clear the session
  and redirect to login exactly once — a module-level latch in the shared
  `apiRequest`/auth layer, reset on successful login. Concurrent in-flight 401s must
  coalesce into that one redirect (they will all resolve after the latch is set).
- `staleTime: 30_000` default (per-query overrides where freshness matters; mutations
  already invalidate the "my points changed" paths).
- `retry: false` and `refetchOnWindowFocus: false` stay exactly as shipped — no change,
  they were never the problem.
- **429 handling:** never auto-retry; existing per-panel error states render.

Changeset: minor. Document the staleTime default and the latch behavior in the package
docs.

## Step 1b — Root-cause the ×3 mount multiplier (investigate, don't scope-creep)

The idle-return burst was 14 queries × **3 mounts**. `staleTime` masks this; it doesn't
explain it. Identify why the homepage panel set mounts three times on that path (StrictMode
double-mount? provider/layout remount on auth-state flap? route re-render?). If the fix
is trivial (e.g. a provider placement), do it in this batch; otherwise record the cause
and a follow-up note in `docs/request-hygiene-findings.md` and move on.

## Step 2 — Platform changeset B: `server-kit` limiter

- `RATE_LIMIT_MAX` default: 300 → **2000** per 15-min window per key (abuse-guard
  sizing; per-token keying and the strict `AUTH_RATE_LIMIT_MAX=20` stay as-is).
- **Make 429s visible**: keep the limiter mounted first (cheapest possible rejection),
  but add a `handler` to the limiter that logs the rejection through the platform
  logger (path, key type, count) before responding — don't reorder middleware to get
  logging.
- Changeset: patch/minor. Update `.env.example` comments in the apps if they document
  the old default.

Tests: a 429 response carries the standard `RateLimit-*` headers AND produces a log
line; the env override parses correctly.

## Step 3 — Publish + consumer bumps

Per dev-workflow: yalc-verify across scenarios/flashcards/premium during development;
tarball-verify before publish; one Version Packages PR; then pin bumps in all three apps
+ template via auto-merge PRs. Add per-query focus-refetch opt-ins where Step 0's
histogram says they're warranted (expect: points summary; possibly leaderboard page).

## Step 4 — Verify with the same measurements

Re-run both Step 0 sessions on the bumped premium build. Acceptance:

- Idle-return: no 429s; exactly one redirect to login; zero 401 retry multiplication.
- Normal session: total requests visibly reduced (expect the navigation-burst pattern —
  bursts on route change, near-zero at rest); no user-visible staleness complaints in
  the walkthrough (points update after completing an activity, via invalidation).
- Record after-numbers next to the before-baseline in
  `docs/request-hygiene-findings.md`.

## Explicitly out of scope

- Server-side caching of hot aggregates (leaderboard micro-cache) — only when a
  measured route earns it under real load; note candidates in the findings doc.
- Any polling/websocket work, offline handling, or request batching/aggregation
  endpoints.
- 429 retry-with-backoff UX — revisit if 429s still occur post-change.

## Acceptance checklist

- [ ] Before/after histograms recorded in `docs/request-hygiene-findings.md`
- [ ] Single-flight 401 latch + `staleTime: 30_000` shipped in `@heybray/react`
      (retry/focus-refetch untouched — already correct as shipped)
- [ ] ×3 mount multiplier root-caused; fixed if trivial, else recorded with follow-up
- [ ] Limiter default 2000/15min + logged 429s shipped in `server-kit`; headers and
      log line asserted in a test
- [ ] All consumers bumped via PR + guards; staleTime opt-outs applied per evidence
- [ ] Idle-return scenario: exactly one login redirect, zero 429s, and the request
      count reflects a single mount set (not ×3) or the multiplier is documented
