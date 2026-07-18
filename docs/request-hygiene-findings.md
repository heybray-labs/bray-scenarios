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

**Wild ~500ms continuous flood:** no polling, no invalidate loop, no auth re-gate, and no provider remount loop found in source (hero rotate is 7s). Documented as **follow-up**: reproduce with Network + React Query Devtools / Profiler in a browser session. Batch mitigations (`staleTime`, 401 latch, limiter 2000) still apply.

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

1. Browser-repro the wild ~500ms authenticated flood (Profiler / RQ Devtools).
2. Optional: stabilize `AuthContext` value with `useMemo` (re-render hygiene, not remount).
3. Server micro-cache for `/api/points/*` only if still dominant under real load after pin bumps.
4. Consumer pin bumps + `.env.example` sync in flashcards/premium after Version Packages publish.
