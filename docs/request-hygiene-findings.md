# Request Hygiene Findings

**Measured against:** `bray-premium` (Docker DB + host server with yalc’d platform packages for after).  
**Brief:** `docs/request-hygiene.md` (corrected after Step 0).  
**Batch branch:** `bray-platform` `request-hygiene` (publish checkpoint — not yet on npm).

Raw harness: `/tmp/request-hygiene-before.json`, `/tmp/request-hygiene-after.json` (local).

---

## Code facts (Step 0)

| Claim in original brief | Actual (pre-change) |
|---|---|
| `staleTime: 0` | **True** — not overridden |
| `refetchOnWindowFocus: true` | **False** — already `false` |
| `retry: 3` | **False** — already `false` |
| Idle return → 401 × 3 retries | **No retries** — parallel queries + per-call redirect |
| Global limiter 300 / 15 min | **True** |
| No `refetchInterval` | **True** |

---

## Before — observed wild session (user incident)

| Metric | Value |
|---|---|
| Logged HTTP lines | 431 |
| Status mix (logged) | 304×337, 200×92, 201×2, 403×1, **401×1**, **429×0** (429s invisible — limiter pre-log) |
| Peak second | **28** authenticated requests |
| Peak minutes | 18:14 → 138; 18:18 → 135; silence while rate-limited; 18:31 → 75 |

### Top routes (logged path suffix)

| Count | Path |
|---|---|
| 45 | `/me` |
| 33 | `/leaderboard` |
| 23 | `/recent-stars` |
| 23 | `/me/stats` |
| 14 | `/featured/manage` |

**Interpretation:** Authenticated remount/refetch storm (304s), not JWT idle-return. Budget burned → silent 429s → `/api/auth/config` fails → “Sign-in unavailable”.

---

## Before — harness Session A: normal browse (compact)

Homepage set → search → leaderboards → star-map → flashcards → start attempt → **5 artificial remount bursts**.

| Metric | Value |
|---|---|
| Total requests | **99** |
| Status mix | 200×97, 404×1, 500×1 |

### Top-5

| Count | Route |
|---|---|
| 8 | `/api/points/me` |
| 8 | `/api/roleplays` |
| 7 | `/api/roleplay-classifications` |
| 7 | `/api/points/leaderboard` |
| 6 | `/api/features` |

---

## Before — harness Session B: idle-return (expired JWT)

Homepage set × **3 parallel rounds** (harness-chosen) + login config/setup ×5.

| Metric | Value |
|---|---|
| Total | **52** |
| 401 | **42** (14 × 3 — zero retries) |
| 429 | **0** |

---

## Before — rate-limit burn

| Metric | Value |
|---|---|
| Rounds until 429 | **15** |
| Total | 210 |
| Default | 300 / 15 min |

---

## Step 1b — ×3 mount multiplier root cause

**Verdict: harness artifact — no code fix in this batch.**

The idle-return “×3 mounts” was produced by the Step 0 harness firing the homepage query set **three times on purpose**. It is not a React mount multiplier.

Real multipliers that *do* exist (and are acceptable / documented):

| Mechanism | Effect | Prod? |
|---|---|---|
| `staleTime: 0` (pre-change) | Any remount re-fetches full set | Yes — fixed by Step 1 |
| `StrictMode` in `bray-premium/src/main.tsx` | Dev-only double invoke | **No** in production Docker |
| `ProtectedRoute` `isLoading` gate | Delays first mount once | Yes — single gate |
| `AppErrorBoundary` `key={location}` | Remount on path change | Yes — once per nav |

**Wild ~500ms continuous flood:** timestamp analysis of preserved incident logs shows **periodic ~500ms full homepage-set bursts** (remount/refetch-loop signature with `staleTime: 0`), not irregular reconnect clustering. Hardened with `refetchOnReconnect: false` anyway (`@heybray/react@1.2.1`). See [Wild flood diagnosis](#wild-flood-diagnosis-phase-2) and [Original incident timestamp analysis](#original-incident-timestamp-analysis).

**Acceptance:** idle-return request count for a single mount set = **14 × 401**; multiplier documented (not fixed as a remount bug). Unit test proves **exactly one** login redirect across concurrent 401s.

---

## Changes shipped in this batch (yalc / awaiting publish)

1. `@heybray/react` (minor): `staleTime: 30_000`; single-flight 401 latch + `resetSessionExpiryLatch()` on login/register/setup/SSO; README docs. `retry` / `refetchOnWindowFocus` untouched.
2. `@heybray/server-kit` (minor): `RATE_LIMIT_MAX` default **2000**; limiter `handler` logs every 429 (`path`, `keyType`, `count`, `limit`) without reordering middleware.
3. App `.env.example` comment: `RATE_LIMIT_MAX=2000` (scenarios).
4. Focus-refetch opt-ins: **skipped** — Step 0 histogram shows those routes are already the chattiest; mutations invalidate points paths.

---

## After — harness (yalc-linked premium host server)

| Session | Before | After | Notes |
|---|---|---|---|
| Normal navigation pass | 99 (incl. 5 remount bursts) | **26** | Remount bursts omitted; staleTime would skip **+70** client refetches within 30s |
| Idle-return | 52 (42×401), N redirects | 46 (42×401 server), **1 redirect** (latch), **0×429** | Single-mount 401 set = 14; ×3 rounds still server-visible but redirects coalesce |
| Rate-limit burn | 15 rounds → 429 @ 300 | **142 rounds → 429 @ 2000** | 429 lines now logged: `WARN [rate-limit] Rate limit exceeded \| path:… keyType:auth count:…` |
| RateLimit headers | `300;w=900` | **`2000;w=900`** | Asserted in server-kit vitest + live curl |

### After top routes (normal, single pass)

| Count | Route |
|---|---|
| 3 | `/api/points/me` |
| 3 | `/api/roleplays` |
| 2 | `/api/points/leaderboard` |
| 2 | `/api/roleplay-classifications` |
| 1 | (homepage set remainder) |

### Acceptance checklist

- [x] Before/after histograms recorded
- [x] Single-flight 401 + `staleTime: 30_000` in `@heybray/react` (yalc + tarball verified; awaiting publish)
- [x] ×3 multiplier root-caused (harness artifact); wild flood as follow-up
- [x] Limiter 2000 + logged 429s in `server-kit` (headers + log asserted in test)
- [ ] Consumer pin bumps via PR + guards — **blocked on publish**
- [x] Idle-return: one redirect (unit test), zero 429s, single-mount set documented (14)

### Follow-ups (out of this batch)

1. ~~Browser-repro the wild ~500ms authenticated flood (Profiler / RQ Devtools).~~ **Done** — see [Wild flood diagnosis](#wild-flood-diagnosis-phase-2) below.
2. ~~Optional: stabilize `AuthContext` value with `useMemo` (re-render hygiene, not remount).~~ **Done** in `@heybray/react` patch (with C2).
3. Server micro-cache for `/api/points/*` only if still dominant under real load after pin bumps.
4. Consumer pin bumps + `.env.example` sync in flashcards/premium after Version Packages publish (`@heybray/react@1.2.1` pending).

---

## Wild flood diagnosis (Phase 2)

**Repro environment:** `bray-premium` Docker rebuilt on `@heybray/react@1.2.0` / `@heybray/server-kit@1.1.0`; admin `admin@demo.local` on `/scenarios`; Playwright headless idle window.

### Phase A — Reproduce

| Metric | `@heybray/react@1.2.0` (Docker) |
|---|---|
| Initial homepage load burst | ~108–113 API requests |
| Idle 60s (no input) | **0** API requests |
| Peak req/s at rest | **0** |

**Verdict:** The historical ~28 req/s storm does **not** reproduce at rest on 1.2.0. The `staleTime: 30_000` default masks remount/reconnect refetch cost — network silence does not prove the client trigger is gone.

### Phase B — Classify

| Signal tested | Result | Cause ruled in/out |
|---|---|---|
| Idle at rest (60s) | 0 fetches | No active invalidate/polling loop |
| Synthetic `online` pulse every 500ms (within stale window) | 0 idle fetches | Storm not reconnect-only while cache fresh |
| Wait 35s (past stale) + `online` pulse every 500ms × 15s | **22** API requests (pre-fix 1.2.0) | Synthetic reconnect refetch — **partial** set, not full homepage burst |
| Location `pushState` flap | 0 idle fetches (wouter path stable) | No pathname remount storm in this harness |
| Source review: `refetchInterval`, auth re-gate, hero rotate | None at ~500ms cadence | Invalidate loop / 7s carousel ruled out |
| **Original incident raw timestamps** (see below) | **Periodic ~485ms between full-set bursts** | **Dominant pattern = remount/full-set refetch loop**, not reconnect |

**Classification:** Historical storm = **`staleTime: 0` amplifier** × **periodic full homepage-set refetch** (~500ms inter-burst cadence in preserved logs). Reconnect refetch is a **plausible contributing mechanism** (confirmed in synthetic test post-stale) but **does not match the original incident's timestamp pattern** as the dominant cause. No invalidate loop (C3). No remount flap reproduced at idle on 1.2.0 (C1 deferred). Render hygiene (C4) shipped as low-risk cleanup.

### Phase C — Fix shipped

| Branch | Change | Repo |
|---|---|---|
| **C2** | `refetchOnReconnect: false` in shared `queryClient` | `bray-platform` `@heybray/react` (changeset → 1.2.1) — hardening; not claimed as dominant incident fix |
| **C4** | `useMemo` on `AuthProvider` context value | `bray-platform` `@heybray/react` |
| **C4** | Stable `PackageLayoutProvider` value; `ScenarioCarouselRow` effect deps → `childCount` | `bray-scenarios` `scenarios-client` |

C1 (`AppErrorBoundary` / location flap) and C3 (invalidate loop) not needed based on classification.

### Phase D — Verify (yalc `@heybray/react` with C2 on premium host)

| Scenario | Before C2 (1.2.0) | After C2 (yalc) |
|---|---|---|
| Idle 60s on `/scenarios` | 0 | **0** |
| Past stale + `online` pulse 500ms × 15s | **22** | **0** |

**Acceptance:** Near-zero requests at rest; reconnect no longer refetches after stale (synthetic). Original incident loop not fully reproduced on 1.2.0 — **monitor prod after 1.2.1 pin bump** (see monitoring note). Consumer pin bump to `@heybray/react@1.2.1` after platform publish.

---

## Original incident timestamp analysis

**Source:** preserved Docker compose capture (`terminals/1.txt`) from the authenticated flood window `2026-07-18T19:13:24Z` — 45 logged requests with `userId:1`, all 304s. Full 431-line session logs are no longer in the container; this window is the best raw sample.

### Raw pattern (not summarized req/s)

| Metric | Value |
|---|---|
| Events in window | 45 |
| Wall span | **0.91s** |
| Bursts detected (>200ms inter-request gap) | **2** |
| Burst sizes | **20** + **25** requests (full homepage parallel sets) |
| Within-burst gaps | 0–171ms (parallel in-flight) |
| **Inter-burst gap** | **485ms** (single measured interval) |

Example burst composition (burst #1, +0.000s): `/`, `/room-for-improvement`, `/leaderboard`, `/featured/manage`, `/me/stats`, `/recent-stars` — 7 unique paths, 20 total requests in ~28ms wall time. Burst #2 (+0.695s): 11 unique paths, 25 requests.

### Interpretation

| Pattern | Expected signature | Matches incident? |
|---|---|---|
| **Periodic remount / full-set refetch loop** | Full query set in tight parallel burst; **~400–800ms between bursts** | **Yes** — 485ms inter-burst, 20–25 req bursts |
| **Discrete reconnect events** | Irregular multi-second gaps; partial refetch of stale queries | **No** — no variable multi-second clustering; each pulse is a full parallel set |
| **Smooth continuous spacing** | Evenly spaced individual requests across whole incident | **No** — requests cluster into bursts, quiet between |

**Verdict:** Original incident timestamps show **periodic full-set bursts**, consistent with a **remount/refetch loop amplified by `staleTime: 0`**, not reconnect-refetch as the dominant mechanism. `refetchOnReconnect: false` is still shipped as defense-in-depth (symmetric with focus-refetch off; confirmed in synthetic post-stale test).

### Monitoring note (post-1.2.1)

After consumer pin bumps, watch for:

- Authenticated req/s at rest on `/scenarios` (expect ~0 with 30s staleTime)
- Reappearance of **~500ms inter-burst cadence** with full parallel path sets → investigate C1 (location/boundary remount), not reconnect
- Logged 429 lines from rate limiter (should remain rare at 2000/15min default)
