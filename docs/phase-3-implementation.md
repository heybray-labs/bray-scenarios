# Phase 3 Implementation Brief — Extension Seams

**Prerequisites:** read `AGENTS.md` and `docs/platform-architecture.md` §5 (the seam catalog
this phase implements). This is the lowest-risk phase of the rework: every seam ships with
an OSS default that reproduces current behavior exactly, so nothing changes for Scenarios
users. **No database migrations are needed or expected in this phase** — every default is
in-memory, env-driven, or log-based.

## Goal

Implement the eight extension points from the architecture doc: `EntitlementProvider`,
`AuditSink`, `AdminRegistry`, `TenantResolver`, `NotificationTransport`,
`StorageProvider`, `AuthProviderRegistry`, and a typed event bus — each with an OSS default,
wired into existing code where a real call site exists. Enterprise implementations are
**not** built now (that's Phase 6); this phase only proves the seams work by having OSS
code go through them.

## Rules

- ❌ No SQL migrations, no new tables — everything is in-memory/log/filesystem/env-based.
- ❌ No dependency version changes; new interfaces don't require new packages beyond what's
  listed below.
- ❌ No Phase 4 work (builds, publishing, changesets) and no enterprise implementations.
- ❌ No `tenant_id` columns, no real S3/SES/Stripe integrations — those are Phase 6.
- One step per commit. Every step except Step 4 and Step 6 is invisible to users (adds a
  seam with zero behavior change); Steps 4 and 6 add small, real, permanent usages of the
  seams they introduce — call those out explicitly in commit messages.
- The bar for "done" per the architecture doc is that OSS itself exercises each seam it can
  (AdminRegistry and EntitlementProvider get real permanent usages; TenantResolver,
  NotificationTransport, StorageProvider, AuthProviderRegistry get real call-site rewiring
  of existing behavior; AuditSink gets real emission sites).

## Two deliberate scope reductions (read before starting)

1. **`AuthProviderRegistry`** unifies protocol *discovery* (label/icon/configured-state used
   by `/api/auth/config` and `/api/about`) into one registry. It does **not** split the
   existing single-file route handler
   (`packages/identity/src/routes/authentication.ts`, 415 lines covering local/OIDC/SAML)
   into per-provider route modules — that's real but low-value churn for a phase whose
   goal is low risk. Route-level pluggability (LDAP, multi-IdP) is deferred to whenever an
   enterprise package actually needs it.
2. **`AdminRegistry`** ships a real, used client-side registry (`registerAdminPanel`) since
   Scenarios already has 7 concrete panels to convert. The **server-side** module registry
   (`registerAdminModule`) ships as a defined-but-unused interface + light in-memory class —
   nothing in the app currently needs to add routes dynamically, so forcing the 8 existing
   static `app.use(...)` mounts through a registry would be risk for no present benefit.
   Flag both reductions in the Step 11 doc update; they're intentional, not gaps.

## Step 1 — Request context + `TenantResolver` (server-kit)

New `packages/server-kit/src/extensions/request-context.ts`:
```ts
export interface TenantContext { tenantId: string }
export interface TenantResolver { resolve(req: Request): Promise<TenantContext | null> }
export class NullTenantResolver implements TenantResolver {
  async resolve(): Promise<null> { return null; }
}
// AsyncLocalStorage<TenantContext | null>, get/run helpers, setTenantResolver()
export function tenantContextMiddleware(): RequestHandler; // resolves + runs downstream in ALS context
```
Wire `tenantContextMiddleware()` into `server/app.ts` early (after the CORS block, before
route mounting) — one line. Default resolver always returns `null`; zero behavior change.
Export from `packages/server-kit/src/index.ts`.

## Step 2 — Event bus (server-kit)

New `packages/server-kit/src/extensions/event-bus.ts`:
```ts
export interface PlatformEvents {
  "auth.login.succeeded": { userId: number };
  "auth.login.failed": { email?: string; reason: string };
  "user.password.changed": { userId: number };
  "user.role.changed": { actorId: number; targetUserId: number; previousRole: string; newRole: string };
  "llm.provider.key.changed": { actorId: number; provider: string; action: "upserted" | "removed" };
  "llm.allowlist.changed": { actorId: number };
  "content.published": { contentType: string; contentId: number; actorId?: number };
  "content.unpublished": { contentType: string; contentId: number; actorId?: number };
  "content.deleted": { contentType: string; contentId: number; actorId?: number };
  "activity.recorded": { userId: number; contentType: string; contentId: number };
  "points.awarded": { userId: number; contentType: string; contentId: number; points: number; tierName: string };
}
export const eventBus: TypedEventEmitter<PlatformEvents>; // thin wrapper over node:events
```
No emission call sites yet — this step is pure infrastructure. Export from server-kit index.

## Step 3 — `AuditSink` + built-in audit listener (server-kit)

New `packages/server-kit/src/extensions/audit.ts`:
```ts
export interface AuditEvent {
  actorId?: number; action: string; resourceType?: string; resourceId?: string | number;
  outcome: "success" | "failure"; metadata?: Record<string, unknown>; at: Date;
}
export interface AuditSink { record(event: AuditEvent): void | Promise<void> }
export class LogAuditSink implements AuditSink {
  record(event) { logger.info("audit", event); } // reuse createLogger from server-kit
}
export function setAuditSink(sink: AuditSink): void;
export function wireAuditLogging(): void; // subscribes eventBus to every PlatformEvents key
                                            // listed below, forwards to the current sink
```
`wireAuditLogging()` subscribes to: `auth.login.succeeded`, `auth.login.failed`,
`user.password.changed`, `user.role.changed`, `llm.provider.key.changed`,
`llm.allowlist.changed`, `content.published`, `content.unpublished`, `content.deleted` —
mapping each to an `AuditEvent` (action = the event name, outcome derived from payload
where relevant e.g. `auth.login.failed` → `"failure"`). Call `wireAuditLogging()` once in
`server/index.ts` bootstrap, before `app.listen`. Still no emitters populated — Step 4 adds
those.

## Step 4 — Wire real audit-emission sites (real, permanent usage)

Convert/add `eventBus.emit(...)` calls at these exact existing sites (current line numbers
as of `main`; re-check before editing since earlier steps don't touch these files):

| Event | File:Line | Notes |
|---|---|---|
| `auth.login.succeeded` | `packages/identity/src/routes/authentication.ts:160-164` | already has a `log.info` — add the emit alongside it (don't remove the existing log call) |
| `auth.login.failed` | `packages/identity/src/routes/authentication.ts:125-129, 134-139, 144-149` | three failure branches — emit at each with a distinct `reason` |
| `user.password.changed` | `packages/identity/src/routes/authentication.ts:263` | |
| `user.role.changed` | `packages/identity/src/routes/users.ts:86-143` (log at 125-130) | `previousRole`/`newRole` already computed in-handler (`currentRole` at L106) |
| `llm.provider.key.changed` | `server/services/roleplay-config.service.ts:313-346` (`upsertProviderKeys`) and `:384-397` (`removeProviderKeys`) | **no logging exists today at either site** — these functions need an `actorId` parameter threaded in from their callers (`server/routes/roleplay-config.ts:65-89`, which have `req.user.id`) |
| `llm.allowlist.changed` | `server/services/roleplay-config.service.ts:348-382, 418-446` | same actor-threading requirement, callers at `server/routes/roleplay-config.ts:91-102` |
| `content.published` | `server/controllers/roleplay-system.controller.ts:1140-1169` (emit near the `syncContent` call at L1158) | `publishRoleplay(roleplayId)` doesn't currently take `userId` — add an optional `actorId?: number` param; thread `req.user!.id` from `server/routes/roleplays.ts:485-495` |
| `content.unpublished` | same file `:1170-1189` (near L1177) | same actor-threading, route `roleplays.ts:497-507` |
| `content.deleted` | same file `:619-627` (near the `onContentDeleted` call at L625) | same actor-threading, route `roleplays.ts:452-462` |
| `activity.recorded` | `packages/gamification/src/service.ts`, inside `recordResult`, at the unconditional `activity_log` insert | gamification already depends on `@heybray/server-kit` — import `eventBus` directly, no new package dependency |
| `points.awarded` | same file, inside `recordResult`'s award-eligible branch (only when a tier/points award actually happens) | |

Do **not** touch `bulkSaveRoleplay`'s tier-diff logic or add fine-grained tier-change
auditing — that's out of scope for this phase (noted as a future item in Step 11).

**Test:** add `server/test/api/audit-events.test.ts`. Swap in a test `AuditSink` via
`setAuditSink()` that pushes to an array; exercise login success/failure, a role change, an
LLM key upsert, and a publish/unpublish/delete; assert each produces the expected
`AuditEvent` with correct `actorId`/`action`/`outcome`. Follow the existing
`helpers/auth.ts`/`helpers/request.ts` pattern used by `users.test.ts`/`roleplays.test.ts`.

## Step 5 — `EntitlementProvider` (server-kit)

New `packages/server-kit/src/extensions/entitlements.ts`:
```ts
export interface RequestContext { userId?: number; tenantId?: string }
export interface EntitlementProvider {
  isEnabled(featureKey: string, ctx: RequestContext): Promise<boolean>;
}
export class EnvEntitlements implements EntitlementProvider {
  // reads process.env.DISABLED_FEATURES (comma-separated, case-insensitive) at call time;
  // isEnabled returns false only if featureKey is in that list. Empty/unset => all enabled.
}
export function setEntitlementProvider(p: EntitlementProvider): void;
export function requireFeature(key: string): RequestHandler; // 403 { message } if disabled
```
Add `GET /api/features` to `server/app.ts` (server-kit can export a small router factory
`createFeaturesRouter()`): accepts `?keys=a,b,c`, resolves each via the current provider,
returns `{ [key]: boolean }`. Mount it authenticated (reuse `authenticateToken`).

Document `DISABLED_FEATURES` in `.env.example` (default empty/commented).

**Test:** `server/test/api/features.test.ts` — default provider returns all-true for
arbitrary keys; setting `DISABLED_FEATURES=foo` (via test env override) makes
`GET /api/features?keys=foo,bar` return `{foo: false, bar: true}`.

## Step 6 — `AdminRegistry` (client, `@heybray/react`) — real, permanent conversion

New `packages/react/src/extensions/admin-registry.ts`:
```ts
export function registerAdminPanel(panel: SettingsPanel): void;
export function getAdminPanels(): SettingsPanel[]; // sorted by registration order
export function clearAdminPanels(): void; // test-only reset
```
Extend `SettingsPanel` (`packages/react/src/components/SettingsModal.tsx:15-25`) with an
optional `requiredFeature?: string`. In `SettingsModal`, alongside the existing
`requiresManage` filter (L46), add: when `panel.requiredFeature` is set, additionally check
`useFeature(panel.requiredFeature)` (new hook from Step 5's client half — see below) and
hide the tab if disabled. With the default `EnvEntitlements` (nothing in `DISABLED_FEATURES`
by default), this is invisible.

Client half of Step 5 — new `packages/react/src/extensions/use-feature.ts`:
```ts
export function useFeature(key?: string): boolean; // true if key is undefined (no gate);
  // otherwise a TanStack Query against GET /api/features?keys=<key>, default true while loading
export function FeatureGate({ featureKey, children, fallback }: {...}): ReactNode;
```

**Convert** `client/src/components/AppLayout.tsx`'s static `appSettingsPanels` array
(L115-159, 7 panels) into 7 `registerAdminPanel(...)` calls, run once at module load (new
file `client/src/admin-panels.ts`, imported once from `client/src/App.tsx` before render —
follow the existing pattern of module-level side-effecting registration already used
elsewhere in the codebase, e.g. how `server/db.ts` calls `setClassificationLinks`/
`setMediaUsageHook` at import time). `AppLayout.tsx` then calls `getAdminPanels()` instead
of referencing the local array. **Zero UI change** — same 7 panels, same order, same
gating.

**Real permanent EntitlementProvider usage (fulfills the architecture doc's Phase 3
acceptance bar without a throwaway toy):** add `requiredFeature: "leaderboard"` to the
existing `LeaderboardPanel`'s registration point (wrap its render in `<FeatureGate
featureKey="leaderboard">` where it's rendered — likely `client/src/pages/HomePage.tsx` or
wherever `HomeSidebarPanel`/`LeaderboardPanel` mounts; check current call sites), and add
`requireFeature("leaderboard")` to the `GET /api/points/leaderboard` route registration in
`server/app.ts`'s gamification router mount. With `DISABLED_FEATURES` unset this changes
nothing. **Verification** (manual, not a code change — see Verification section) proves the
seam end-to-end and the gate stays in the codebase permanently as a working example, rather
than being added and reverted.

## Step 7 — `AuthProviderRegistry` (identity)

New `packages/identity/src/auth-providers.ts`:
```ts
export interface AuthProviderDescriptor {
  name: "local" | "oidc" | "saml";
  label: string;
  icon?: string;
  isConfigured(): boolean;
}
export function getAuthProviders(): AuthProviderDescriptor[]; // built-in registry, seeded
  // with local/oidc/saml using the EXISTING isOidcConfigured/isSamlConfigured/
  // getOidcProviderName/getSamlProviderName helpers already in auth-config.ts
export function getActiveAuthProvider(): AuthProviderDescriptor;
```
Replace `server/app.ts`'s `getAuthProtocolLabel()` helper (L32-41) and the equivalent
branch logic inside `getPublicAuthConfig()` (`packages/identity/src/auth-config.ts:138-161`)
with calls into this registry. **Parity requirement:** `GET /api/about` and
`GET /api/auth/config` responses must be byte-identical before and after this step — add
an explicit assertion (or extend an existing test in `server/test/api/auth.test.ts`)
comparing the response shape.

## Step 8 — `StorageProvider` (media)

New `packages/media/src/storage.ts`:
```ts
export interface StorageProvider {
  put(key: string, data: Buffer): Promise<void>;
  getStream(key: string): NodeJS.ReadableStream;
  getBuffer(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}
export class FilesystemStorageProvider implements StorageProvider { /* wraps the exact
  current fs.* calls in media.service.ts — see below */ }
export function setStorageProvider(p: StorageProvider): void; // mirrors the existing
  // setMediaUsageHook(...) pattern already in this file (L225-227)
```
Refactor `packages/media/src/media.service.ts` so `createFromBuffer` (L134-168),
`resolvePath`/`openReadStream` (L170-180), `readFile` (L182-189), and `delete` (L191-211)
call through the current provider instead of `fs`/`fs/promises` directly. **Preserve
exactly**: the DB-insert-then-file-write ordering and rollback-on-DB-failure in
`createFromBuffer`, and the best-effort (non-throwing) unlink-on-delete behavior. Default
provider is keyed the same way as today (`path.join(getMediaDir(), storageKey)`).

**Verification:** `server/test/api/media.test.ts` must pass **unmodified** — this proves
the refactor is behavior-preserving (no new tests required, but do not touch that file).

## Step 9 — `NotificationTransport` (server-kit)

New `packages/server-kit/src/extensions/notifications.ts`:
```ts
export interface NotificationTransport {
  send(input: { to: string; channel: "email"; template: string; data: Record<string, unknown> }): Promise<void>;
}
export class LogNotificationTransport implements NotificationTransport {
  async send(input) { logger.info("notification (not sent — no transport configured)", input); }
}
export function setNotificationTransport(t: NotificationTransport): void;
```
No call sites — the inventory confirmed the app sends no email today (no invites,
password-reset, or 2FA delivery exist). This step ships the seam only, ready for a Phase 6
SES transport. Note this explicitly in Step 11's doc update — it's not a gap Phase 3
created, it's a pre-existing gap the seam is ready for.

## Step 10 — Manual verification of the EntitlementProvider gate

Not a commit. After Step 6 lands:
1. Start the dev server with `DISABLED_FEATURES` unset — confirm the leaderboard renders
   and `GET /api/points/leaderboard` returns 200 as always.
2. Set `DISABLED_FEATURES=leaderboard` in `.env`, restart — confirm
   `GET /api/points/leaderboard` returns 403 and the client hides the leaderboard panel
   (via `FeatureGate`) without an error boundary or crash elsewhere on the page.
3. Unset `DISABLED_FEATURES`, restart — confirm the leaderboard is fully restored.
4. Record the three observations in `docs/phase-3-verification.md` (curl output + a
   one-line note on the UI state at each step). This is the acceptance evidence the
   architecture doc's Phase 3 "Done when" criterion asks for.

## Step 11 — Documentation cleanup

- `AGENTS.md:4` references `docs/phase-1-implementation.md` by name as "the current phase
  brief" — update to a generic pointer ("the current phase brief in `docs/`") so it doesn't
  need editing every phase.
- `docs/platform-architecture.md` §2: the `server-kit` package description still says media
  is folded inside it ("Media: `media_assets` schema... folding it here avoids a micro-
  package") — this is stale since the Phase 2 media extraction. Correct it to reference
  `@heybray/media`.
- Same doc's Appendix table: the "Auth protocol switch" row still points at
  `server/config/auth-config.ts` — update to `packages/identity/src/auth-config.ts`.
- Mark §7 Phase 3 done; list explicitly deferred items for later phases: AuthProviderRegistry
  route-splitting (Step 7's scope reduction), AdminRegistry server-side module registration
  (unused-but-defined), real StorageProvider S3 implementation, real NotificationTransport
  SES implementation, real AuditSink DB-persisted implementation + UI, real
  EntitlementProvider Stripe-backed implementation, real TenantResolver — all Phase 6.
- Add `docs/phase-3-verification.md` per Step 10 (create it there, don't fold into this
  brief).

## Verification (all must pass)

```bash
npm install                       # no lockfile changes beyond nothing
npm run typecheck
npm run build --workspace=client
npm test                          # incl. new audit-events.test.ts, features.test.ts;
                                   # media.test.ts and auth.test.ts unmodified and green
```
Plus Step 10's manual procedure, recorded in `docs/phase-3-verification.md`.

## Acceptance checklist

- [ ] Zero new migrations; `server/drizzle/` untouched
- [ ] All eight seams defined with OSS defaults; each exported from its package's index
- [ ] Real emission sites wired for all events listed in Step 4's table, with actor
      plumbing added where noted
- [ ] `AdminRegistry` is the sole source of the 7 settings panels (static array deleted)
- [ ] Leaderboard is the one permanent `requireFeature`/`FeatureGate` usage; verified per
      Step 10 with results recorded
- [ ] `media.test.ts` and the `/api/about`+`/api/auth/config` response shapes are byte-
      identical to pre-Phase-3 (parity, not just "tests still pass")
- [ ] `docs/platform-architecture.md` and `AGENTS.md` updated per Step 11
- [ ] One step per commit
```