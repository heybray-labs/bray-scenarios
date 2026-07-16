# Gamified Platform Architecture

**Status:** Phase 0 design — approved direction, pre-implementation.
**Scope:** the split of Scenarios into a reusable open-source platform, the repo/release strategy, the enterprise extension model, and the phased migration roadmap.

---

## 1. Overview: the three-tier model

Scenarios is the first of several planned gamified apps. All of them share the same underlying platform needs (identity, gamification, LLM access, app chassis, UI kit). Alongside the open-source apps there will eventually be a commercial premium product with enterprise features. The target architecture has three tiers:

| Tier | Visibility | License | Contents |
|---|---|---|---|
| **Core platform** | Open source | AGPL-3.0 | Shared `@heybray/*` npm packages: identity & access, gamification engine, LLM provider layer, app chassis, UI kit |
| **Standalone apps** | Open source | AGPL-3.0 | Scenarios first; future gamified apps. Each is its own repo, developed separately, consuming published platform packages. Apps are **not** integrated with each other. |
| **Enterprise layer** | Proprietary | Commercial | Private packages implementing extension points defined by the core (multi-tenancy, billing/entitlements, audit, SSO extras, S3 storage, notification center, global admin) + a closed premium app that bundles all standalone apps with the enterprise features |

**WebAppTemplate** (`~/develop/WebAppLatest/WebAppTemplate`) was the earlier attempt at a unified platform — a ~168-table multi-tenant SaaS monolith. It is **not** ported in this rework. It serves as the *reference quarry* for the enterprise layer (its FeatureGate/entitlement mechanism, tenant middleware, Stripe billing, audit middleware, and `AppExtensions.tsx` lazy-route pattern are the precedents cited in §5).

### Decisions locked in

1. **Consumption model:** the platform lives in its own repo and publishes versioned npm packages. Apps pin versions and upgrade deliberately.
2. **Enterprise model:** the OSS core defines explicit extension points; enterprise features are private npm packages implementing them; the premium app is a private repo composing OSS + enterprise packages. This rework only *designs the seams* — no enterprise code is built now.
3. **Licensing:** AGPL-3.0 for all OSS tiers, with the owner retaining copyright. A CLA is required for outside contributions so the owner can legally ship contributed code in the proprietary tier (see §6).
4. **Sequencing:** strangler extraction. Scenarios stays the source of truth and keeps shipping. It is restructured in-repo into platform-shaped packages, boundaries are proven, then the packages are lifted into the platform repo and published.
5. **Core scope:** identity & access, generalized gamification engine, LLM provider layer, and app chassis & UI kit are all core.
6. **App shape for premium bundling:** deliberately undecided. **Standalone app shape resolved in Phase 5** → template repo (see `bray-platform/docs/app-shape-decision.md`). Premium bundling shape still forced at Phase 6. See §7.

### Why strangler extraction

The platform is born from working, deployed code rather than a speculative API. Every boundary in §2 is first proven as an internal package boundary inside the Scenarios repo (workspaces, no publishing), while Scenarios continues to ship from `main` at every phase. Only after the boundaries survive real development are they lifted out and published. WebAppTemplate demonstrated the risk of the opposite approach: building the integrated platform first produced a monolith whose features now have to be quarried back out.

---

## 2. Package inventory

**npm scope: `@heybray`** (matches the `heybray-labs` GitHub org). Verified available on npmjs.com (Phase 4). Platform repo: **`heybray-labs/bray-platform`**.

Granularity philosophy: **one package per independently versionable boundary, not per module** — 8 runtime packages + 1 dev-tooling package. Too many packages creates release friction; too few destroys the boundary discipline that makes the enterprise layer possible. Server and client are separate packages because they have disjoint peer dependencies (express/drizzle vs react). Drizzle schemas ship inside their owning *server* package via a `/schema` subpath export; the client can import types from them (it already depends on `drizzle-orm` today via `@shared`).

### Server packages

#### `@heybray/server-kit` — app chassis (no internal deps)

The foundation everything else plugs into.

- `createApp(appDefinition)` — generalized from `server/app.ts` (CORS, rate limiting, request logging, health/about endpoints, static SPA serving) and the `server/index.ts` bootstrap.
- Middleware & utils: `server/middleware/request-logging.ts`, `server/middleware/rate-limit.ts`, `server/utils/logger.ts`, `server/utils/app-version.ts`, `server/utils/secret-encryption.ts`.
- DB: pool/drizzle factory extracted from `server/db.ts`; `resolve-database-url.ts`.
- Migrations runner: `runMigrations(sources)` generalized from `server/init-db/run-migrations.ts` (see *Migrations pattern* below).
- Env handling: zod-validated env loading composed from per-package schema fragments (see §6).
- The extension-point interfaces (§5) and a typed in-process event bus.

#### `@heybray/identity` — depends on `server-kit`

- Schemas: `users.ts` (incl. 2FA columns), `roles.ts` (string-array permissions), `teams.ts`, `user-identities.ts`, `auth-exchange-codes.ts` → exported at `@heybray/identity/schema`.
- Server: `server/middleware/auth.ts`, `packages/identity/src/auth-config.ts` (`AUTH_PROTOCOL` = local | oidc | saml), services `oidc-auth`, `saml-auth`, `sso-exchange`, `sso-user-resolution`, auth/user/team routes, user controller, and the team-CRUD half of `team.controller.ts` (the star-map half moves to gamification).
- Teams live here deliberately: they are org structure, not gamification. Gamification *consumes* team membership.

#### `@heybray/media` — depends on `server-kit`, `identity`

- Schema: `media_assets` (`packages/media/src/schema/media-assets.ts`) → exported at `@heybray/media/schema`.
- Media service/routes behind the **StorageProvider** seam (`FilesystemStorageProvider` default). Split out as its own package (rather than folded into `server-kit`, as originally planned here) once media's ownership checks needed `identity`'s user data — see the Phase 2 carried-debt note below.

#### `@heybray/taxonomy` — depends on `server-kit`

Small but a clean, low-churn boundary that both gamification and app content rely on.

- Schemas: `classification_dimensions` and `classification_options` (already fully generic in `shared/schemas/roleplay-classifications.ts`), **plus a generalized link table**:

  ```
  content_classification_links (content_type text, content_id integer, option_id integer)
  ```

  replacing `roleplay_classification_links`. This is what lets gamification do pure-SQL leaderboard/mastery joins (§3).
- Server: classification service + generic taxonomy admin routes; `slugifyLabel`/`labelFromSlug` helpers.

#### `@heybray/gamification` — depends on `server-kit`, `identity`, `taxonomy`

- Schemas: generalized `reward_tiers`, `user_content_tier_awards`, `point_transactions`, plus new `activity_log` and `gamification_content` (§3), and the pure tier helpers from `shared/schemas/points.ts` unchanged (`CANONICAL_TIER_NAMES`, `deriveStarLevel`, `resolveRewardTierDisplay`, `normalizeRewardTiers`, `DEFAULT_REWARD_TIERS` — all already content-agnostic).
- Server: `points.controller.ts` rewritten as `GamificationService` (§3), team star-map aggregation from `team.controller.ts`, points + star-map routes.

#### `@heybray/llm` — depends on `server-kit`

- Schemas: `roleplay_app_config` → `app_llm_config`, `roleplay_provider_keys` → `llm_provider_keys` (encrypted at rest), and the persona/grader tables generalized into one `llm_allowed_models(purpose text, provider, model)` — apps define their own purposes (Scenarios: `"persona"`, `"grader"`; a future app: `"tutor"`, `"summarizer"`).
- Server: `server/roleplay/model-factory.ts` (LangChain adapters for OpenAI/Anthropic/Google, incl. the custom-temperature capability check), config service (key encryption), model catalog service, LLM admin routes.

### Client packages

#### `@heybray/ui` — presentational design system (no internal deps)

- `client/src/components/ui/*` (shadcn primitives), `components/errors`, `components/icons`, `lib/utils.ts` (`cn`).
- A **Tailwind preset** exporting the token scale as CSS variables (extracted from `client/index.css` + `client/tailwind.config.ts`). Whitelabeling = overriding the `:root` variable block (§6).

#### `@heybray/react` — app runtime plumbing, depends on `ui`, `identity`

- `AppConfigProvider` replacing the hardcoded constants in `client/src/lib/app-config.ts`.
- `lib/{queryClient,http-error,auth,user-display,media}.ts`, `ProtectedRoute`.
- `MainLayout` / `AppBrandTitle` / `SettingsModal` shells whose nav and panels are populated via the AdminRegistry (§5), `AboutPanel`.
- Auth page primitives: login, register, 2FA, OIDC/SAML callback pages as configurable components.
- Platform admin panels: users, teams, media, classifications, LLM config.
- *(If this package grows heavy, admin panels can later split to `@heybray/admin-react`; start merged to limit release surface.)*

#### `@heybray/gamification-react` — depends on `ui`, `react`

- `client/src/components/points/*` (TierStars, LeaderboardPanel, YourProgressPanel, CategoryMasteryBar/Row, RecentStarsPanel, PointsHistoryDialog, RewardTierLabel, HomeSidebarPanel).
- `client/src/components/teams/*` (star map), `lib/reward-tier-utils.ts`.
- Results-reveal animation components extracted from the roleplay results page as generic `ResultsReveal` pieces.
- Components take a `contentPath: (contentType, contentId) => string` router adapter (via `AppConfigProvider`) instead of hardcoding `/roleplays/:id` links.

#### `@heybray/dev-config` (dev-only)

Shared tsconfig bases, eslint config, SPDX license-header lint rule.

### Dependency graph (no cycles)

```
server:  server-kit ◄── identity ◄──┐
         server-kit ◄── taxonomy ◄──┼── gamification
         server-kit ◄── llm         │
         server-kit ◄───────────────┘

client:  ui ◄── react ◄── gamification-react
         ui ◄─────────────gamification-react
         identity ◄── react   (type-only imports from @heybray/identity/schema;
                               intentional — not removed in Phase 4)
```

An app (Scenarios) depends on all of them plus its own domain code (roleplay schemas, grading pipeline, roleplay pages).

### Migrations pattern (schemas + SQL shipped inside packages)

Each server package ships its own `migrations/` folder (SQL files + `meta/_journal.json`, exactly the current `server/drizzle/` format) in its published dist, alongside its `/schema` export.

- **Per-package history tables.** Drizzle's `migrate()` accepts a `migrationsTable` option; each package tracks its own applied set: `drizzle.__migrations_identity`, `__migrations_taxonomy`, `__migrations_gamification`, `__migrations_llm`. The app keeps `drizzle.__drizzle_migrations` for its own migrations.
- **The app composes an ordered plan.** `@heybray/server-kit` exports `runMigrations(sources: MigrationSource[])` where each source is `{ name, folder, migrationsTable }`, run in dependency order: `server-kit → identity → taxonomy → gamification → llm → app`. Cross-package FKs (e.g. `point_transactions.user_id → users.id`) are safe because ordering is fixed and identity always precedes gamification.
- **Takeover of existing deployed tables.** When a package assumes ownership of tables originally created by app migrations `0000`–`0007`, the runner stamps the package's baseline migration as applied if the table already exists — the exact mechanism already proven by `stampBaselineIfLegacyDatabase()` in `server/init-db/run-migrations.ts:61`. Package baseline SQL additionally uses `CREATE TABLE IF NOT EXISTS` as belt-and-braces.
- **App-owned binding migrations.** FKs *from* platform tables *into* app tables (see §3) are added by app migrations, never package migrations.
- **Compatibility rule:** platform package migrations are additive-only within a major version. Destructive changes require a major bump with documented expand/contract steps.
- Packages resolve their own migration folder via `import.meta.url` *within the package*, so resolution survives the move from tsx-run source to built dist (risk R4, §8).

---

## 3. Gamification generalization (the key refactor)

### Current coupling (verified)

- `shared/schemas/points.ts` imports `roleplays`/`roleplayAttempts` and FKs into them: `scenario_reward_tiers.roleplay_id`, `user_scenario_tier_rewards.roleplay_id`, `point_transactions.{roleplay_id, attempt_id}`.
- `server/controllers/points.controller.ts` joins roleplay tables throughout and hardcodes the classification dimension slug `"category"` (lines 295, 351, 943, 1028 — including raw-SQL rank CTEs that reference `roleplays` and `roleplay_classification_links` by name).
- `server/controllers/team.controller.ts` hardcodes the permission string `"roleplay:manage"` (line 80) and derives lastActive/passRate/weekly-activity from `roleplay_attempts`.
- Award flow is domain-typed: `awardPointsForAttempt(attempt: RoleplayAttempt, roleplayTitle, …)`.

### The abstraction

Replace `(roleplayId, attemptId)` with a **polymorphic content reference** `(content_type text, content_id integer)` plus a nullable `activity_id`, with **no FKs from platform tables into app tables**. The app registers its content types at startup (Scenarios registers `"scenario"`). Deployments are single-app, so `content_type` is mostly a constant column — cheap insurance, not speculative multi-tenancy.

Two commitments keep this pragmatic rather than callback-soup:

**(a) SQL-composable data stays in platform tables.** The leaderboard rank CTEs and mastery aggregations are relational SQL; app callbacks would force them into memory. Instead:

- Taxonomy links generalize to `content_classification_links` (owned by `@heybray/taxonomy`) — a rename + add-column migration of `roleplay_classification_links`.
- A small **content projection table**, owned by gamification:

  ```
  gamification_content (content_type, content_id, title, is_active, updated_at,
                        PRIMARY KEY (content_type, content_id))
  ```

  kept in sync by the app (upsert on create/publish/rename, deactivate on unpublish/delete — can ride the event bus). It replaces every `JOIN roleplays` for title and `status = 'published'` filtering in leaderboards, recent achievements, progress stats, and the team star map. A `reconcile()` API rebuilds it from app data; a boot-time/CI drift check guards against desync.

**(b) The award flow inverts: the app calls the platform.**

```ts
const result = await gamification.recordResult({
  userId,
  contentType: "scenario",
  contentId,
  activityId: attemptId,
  scorePercent,
  passed,
  occurredAt,
});
// -> { pointsAwarded, tierName, starLevel, totalPoints } | null
```

`recordResult` always appends to a new `activity_log` table and conditionally awards tiers/points. `activity_log` replaces every remaining `roleplay_attempts` dependency in the generic layer: weekly streaks (`getUserProgressStats`), lastActive/passRate/weekly-active in the team star map, and passed-counts.

### Table mapping

| New table (owned by `@heybray/gamification`) | From | Change |
|---|---|---|
| `reward_tiers` | `scenario_reward_tiers` | `roleplay_id` → `(content_type, content_id)`; unique `(content_type, content_id, star_level)` |
| `user_content_tier_awards` | `user_scenario_tier_rewards` | same substitution; unique `(user_id, content_type, content_id)` |
| `point_transactions` | `point_transactions` | `roleplay_id` → `(content_type, content_id)`, `attempt_id` → `activity_id`; keeps denormalized `tier_name`, `description` |
| `activity_log` | new; backfilled from completed `roleplay_attempts` | generic completion events |
| `gamification_content` | new; backfilled from `roleplays` | title/active projection |

`user_id` keeps a real FK to `users` (same package family, fixed migration order). For cascade semantics against app content, **the app adds binding FKs in its own migration**, e.g.:

```sql
ALTER TABLE reward_tiers
  ADD CONSTRAINT reward_tiers_roleplay_fk
  FOREIGN KEY (content_id) REFERENCES roleplays(id) ON DELETE CASCADE;
```

(valid because a single-app deployment has exactly one content type). Apps that skip binding FKs must call `gamification.onContentDeleted(contentType, contentId)`.

### App-facing interface

```ts
// registered at startup via createApp()
interface GamificationConfig {
  contentTypes: Array<{ type: string; label: string }>;   // [{ type: "scenario", label: "Scenario" }]
  masteryDimensionSlug: string;   // replaces hardcoded "category"
  managePermission: string;       // replaces hardcoded "roleplay:manage"
  tierDefaults?: RewardTierInput[];  // DEFAULT_REWARD_TIERS remains the default
}

interface GamificationService {
  recordResult(input: ActivityResult): Promise<PointsAwardResult | null>;
  syncContent(items: ContentProjection[]): Promise<void>;
  onContentDeleted(contentType: string, contentId: number): Promise<void>;
  reconcile(): Promise<ReconcileReport>;

  getUserSummary(userId): …;
  getProgressStats(userId): …;          // streaks, totals — from activity_log
  getPointsHistory(userId): …;
  getLeaderboard(opts: { scope: "global" | "dimension-option"; optionSlug?: string; period: … }): …;
  getRecentAchievements(opts): …;
  getContentProgress(userId, contentType, contentId): …;
  getTeamStarMap(teamId: number | "all"): …;
  getRewardTiers / setRewardTiers(contentType, contentId, tiers): …;
}
```

**What stays in the app:** everything roleplay-specific in today's `getScenarioProgress`/`getResultsContext` — `roleplaySettings.maxAttempts`/attempts-remaining, `criterionBests`, `topImprovement` from `roleplayCriterionScores`. The app's results route composes `gamification.getContentProgress()` with its own criterion queries into the payload the client already expects. `getTopImprovementFromScores` moves to the app.

**Tier/star semantics** (3-star Bronze/Silver/Gold model and all pure helpers in `shared/schemas/points.ts:68-218`) move to `@heybray/gamification`'s shared module unchanged.

**Client:** `TierStars` is nearly generic already. Points panels change only payload field names (`roleplayId` → `contentId`, `scenarioTitle` → `contentTitle`) and receive `contentPath` for links.

---

## 4. What stays app-specific (Scenarios)

- Domain schemas: `roleplay-core.ts` (roleplays, settings, personas, criteria, attempts, messages, criterion scores, `homepage_featured_scenarios`), `roleplay-transfer.ts`.
- `server/roleplay/*`: persona prompting, grading, coaching, roleplay events (the model factory moves to `@heybray/llm`; its *use* stays here).
- Roleplay routes/controllers/pages: intro, taking, results composition, attempts, browse/search, scenario detail, transcript components.
- Seed/demo data (`server/init-db/seed-*.ts`, `demo-data/`).
- Binding migrations (cascade FKs onto `roleplays`), `gamification_content` sync calls, and the app definition passed to `createApp()` (content types, `masteryDimensionSlug: "category"`, `managePermission: "roleplay:manage"`, LLM purposes `"persona"`/`"grader"`).

---

## 5. Extension point catalog (enterprise seams)

Designed now, implemented with OSS defaults now, enterprise implementations later. Server interfaces live in `@heybray/server-kit` (`src/extensions/`); client registries in `@heybray/react`. WebAppTemplate precedents are noted — they are evidence each seam is load-bearing in a real enterprise product.

1. **`EntitlementProvider`** — `isEnabled(featureKey, ctx): Promise<boolean>`, a `requireFeature(key)` Express middleware, and `GET /api/features`. OSS default: allow-all. Client: `FeatureGate` component + `useFeature(key)` fed by that endpoint. Platform packages *tag* premium-able routes with keys but never gate them in OSS. *(Precedent: WebAppTemplate `FeatureGate`/`FeatureContext` + `stripe_features`/`stripe_product_features`.)*

2. **`AuditSink`** — `record(event: AuditEvent)` with `{ actorId, action, resourceType, resourceId, outcome, metadata, ip, at }`. OSS default: structured-log sink through the existing logger. Platform packages emit at fixed points: login success/failure, 2FA changes, role/permission changes, LLM key changes, tier config changes. Enterprise later ships a DB-persisting sink + audit UI. *(Precedent: WebAppTemplate audit middleware/schemas/UI.)*

3. **`AdminRegistry`** — server: `registerAdminModule({ id, routes, requiredPermission })`; client: `registerAdminPanel({ id, label, icon, order, element, requiredPermission, requiredFeature })`, consumed by the generalized `SettingsModal`/`MainLayout` nav. Crucially, *apps* use this same registry for their own panels (roleplay config, featured scenarios), so the seam is exercised by OSS from day one — the strongest guarantee it works when enterprise needs it. *(Precedent: WebAppTemplate `AppExtensions.tsx` lazy-route registration.)*

4. **`TenantResolver`** — `resolve(req): Promise<TenantContext | null>`, run early in the middleware chain, result stored in a per-request `RequestContext` (AsyncLocalStorage) established by server-kit. OSS default resolves `null`. Deliberate restraint: **no `tenant_id` columns now**. The reserved seam is (a) the request context every service can read and (b) the rule that all platform DB access goes through service classes so enterprise can wrap/extend them. Full tenancy is a Phase-6+ major version.

5. **`NotificationTransport`** — `send({ to, channel, template, data })`. OSS default: log-only. Consumers: identity (2FA email codes, invites, password reset). Enterprise: SES transport + notification center.

6. **`StorageProvider`** — `put(key, buf, meta)` / `getStream(key)` / `delete(key)` / `publicUrl?(key)`. OSS default wraps current media storage. Enterprise: S3 with per-object permissions.

7. **`AuthProviderRegistry`** — formalizes what `AUTH_PROTOCOL` switches today: `registerAuthProvider(name, { routes, verify, label, icon })`, so local/oidc/saml become three registrations and enterprise can add LDAP/multi-IdP without touching identity internals.

8. **Event bus** — typed in-process emitter in server-kit: `user.created`, `auth.login`, `activity.recorded`, `points.awarded`, `content.published`, …. OSS uses it lightly (audit emission; `gamification_content` sync can ride it); enterprise packages subscribe without needing new seams.

---

## 6. Repo, release, licensing, and config strategy

### Repos

| Repo | Visibility | Contents |
|---|---|---|
| `heybray-labs/bray-scenarios` | public, AGPL-3.0 | Scenarios app (source of truth through Phase 3) |
| `heybray-labs/bray-platform` | public, AGPL-3.0 | platform monorepo: all `@heybray/*` packages + `examples/basic-app` (created Phase 4) |
| `heybray-labs/bray-<app2>` | public, AGPL-3.0 | second gamified app (Phase 5) |
| `heybray-labs/bray-enterprise` | private | enterprise packages implementing the §5 extension points (Phase 6) |
| `heybray-labs/bray-premium` | private | premium app composing OSS apps + enterprise packages (Phase 6) |

### Tooling & versioning

- npm workspaces (already in use) + **Changesets** for versioning/publishing + **Turborepo** in the platform repo for build/test caching. No Nx/Lerna.
- Packages build to ESM `dist/` + `.d.ts` with tsup (or plain tsc). Required because published consumers cannot rely on tsx source-running (Scenarios currently runs raw `.ts` via tsx). During in-repo phases, workspace symlinks + tsx keep the current no-build dev loop.
- Independent semver per package; everything `0.x` until Phase 5 proves the API with app #2, then `1.0.0` across the board. Breaking DB change = major + documented expand/contract; runtime API break = major + migration notes in the changelog.

### Publishing & CI

- OSS → public npm registry with `--provenance`. Enterprise (later) → GitHub Packages under the same scope with repo-scoped tokens.
- Platform-repo CI mirrors the proven Scenarios `ci.yml` shape at package level: typecheck+build per package, then an integration job that boots `examples/basic-app` (chassis + all packages + a trivial content type) **against built dist**, runs the composed migration plan on a fresh Postgres service container, and smoke-tests the API. That example app is the regression net for the migration-composition machinery.
- App upgrade flow: bump `@heybray/*` versions, `npm install`, restart — `runMigrations` applies new package migrations on boot (preserving the current single-container upgrade behavior and `bin/upgrade-backup.sh` / `upgrade-verify.sh` flow). Renovate/Dependabot grouping "heybray platform" recommended.

### Licensing & CLA

- AGPL-3.0 `LICENSE` in every public repo; `"license": "AGPL-3.0-only"` in every published `package.json`.
- SPDX headers (`// SPDX-License-Identifier: AGPL-3.0-only` + copyright line) enforced by an eslint rule in `@heybray/dev-config`, applied in one sweep commit.
- **CLA** via the `contributor-assistant/github-action` (config lives in-repo, no external service), granting the owner the right to relicense contributions. `CONTRIBUTING.md` states the policy plainly: the maintainer ships commercial licenses/proprietary extensions; the CLA is what makes accepting contributions compatible with that.
- Gate: CLA + headers must be live on `bray-platform` **before** it goes public (Phase 4); retrofit to `bray-scenarios` earlier is cheap and recommended.

### Config & whitelabel

- **Server:** `createApp(appDefinition)` where `appDefinition = { name, version, modules, auth, gamification, llm, extensions }`. Each package exports a zod env-schema fragment (identity: `AUTH_PROTOCOL`, `JWT_SECRET`, OIDC/SAML vars; llm: encryption key; core: `DATABASE_URL`, `APP_URL`, `CORS_ORIGINS`, `TRUST_PROXY`); server-kit merges and validates at boot with actionable errors. Platform vars stay unprefixed (deployment-level, as today); app-specific vars get an app prefix.
- **Client:** `<AppConfigProvider config={{ displayName, tagline, urls: { repo, docs, issues, releases }, logo?, routes: { contentPath } }}>` at the top of `App.tsx` replaces the hardcoded constants in `client/src/lib/app-config.ts` (`APPLICATION_DISPLAY_NAME = "Scenarios"` etc.). The ~6 consuming files switch to `useAppConfig()`.
- **Theming:** `@heybray/ui`'s Tailwind preset is CSS-variable driven (the codebase is already shadcn-style CSS-var theming); an app whitelabels by overriding the `:root` variable block and extending the preset — no component changes.
- `GET /api/about` additionally returns `appName` so shared platform pages (e.g. login) can render server-driven branding; build-time config remains primary.

---

## 7. Phased roadmap

Every phase ends with Scenarios shippable: CI green, Docker image releasable, DB upgradeable from any prior release.

### Phase 0 — Architecture doc *(this document)*
**Done when:** committed; owner sign-off on npm scope/package names and the §3 gamification table design.

### Phase 1 — In-repo package restructure (no DB changes)
- Add `packages/` to root workspaces; create `server-kit`, `identity`, `taxonomy`, `llm`, `ui`, `react`, `dev-config` as workspace-consumed packages (private, v0.0.x, source-consumed via tsx/vite alias — no build step yet).
- Move the clearly generic files per §2. Dissolve `shared/`: platform schemas move into package `/schema` exports; app-only schemas (`roleplay-core`, the classification *link* table until Phase 2, `roleplay-transfer`, `agent/roleplay-app-config` until the llm rename) move to an app-shared location — or a `packages/scenarios-shared` if trivially cheap (the low-cost "keep the app-shape door open" move).
- `server/db.ts` becomes composition: `{ ...identitySchema, ...taxonomySchema, ...llmSchema, ...appSchema }`.
- Introduce `AppConfigProvider`; delete hardcoded branding constants.
- LLM table renames are deferred to Phase 2 migrations so this phase stays migration-free.
- **Risks:** import-churn regressions (mitigated by strict typecheck + existing API smoke tests); vite/tsx resolution of workspace TS (keep alias-style resolution until packages build).
- **Done when:** CI green, zero behavior change, git history shows moves not rewrites.

### Phase 2 — Gamification decoupling *(complete)*
- Migrations `0008+`: create `reward_tiers`, `user_content_tier_awards`; add `content_type`/`content_id`/`activity_id` to `point_transactions`; create `activity_log` (backfill from completed `roleplay_attempts`) and `gamification_content` (backfill from `roleplays`); rename `roleplay_classification_links` → `content_classification_links` + `content_type` column. Backfills are pure SQL with count/sum assertions in-migration; old tables kept (unread) for one release, dropped later.
- App binding migration adds cascade FKs onto `roleplays`.
- Rewrite `points.controller.ts` → `GamificationService` in `packages/gamification`; split `team.controller.ts` (CRUD → identity, star map → gamification); config-inject `masteryDimensionSlug` and `managePermission`; grading pipeline calls `recordResult`; roleplay controllers upsert `gamification_content` on publish/rename/delete.
- Extract `packages/gamification` + `packages/gamification-react`; app results route composes gamification progress + criterion details.
- **Risks:** live-data backfill correctness (assertions + `bin/upgrade-verify.sh` extension); leaderboard rank CTE parity (golden-output tests against a seeded DB before/after).
- **Done when:** feature parity on leaderboards/mastery/star map/results reveal/points history against seeded demo data; upgrade from v1.1.x tested via docker-compose.

#### Carried debt from Phase 1 — resolved in Phase 2
These were deliberately left roleplay-shaped in Phase 1; each carried a `// PHASE-2:` marker until this phase closed them:
- ✅ `packages/taxonomy/src/schema/links-registry.ts` deleted — taxonomy now owns `content_classification_links` outright.
- ✅ `packages/taxonomy/src/service.ts` rewritten dimension-driven; the roleplay app adapter reshapes to the existing `{category, audienceLevel, duration, tags}` API payload.
- ✅ `packages/react/src/admin/{MediaManagementPanel,ClassificationManagementPanel}.tsx` take `{ contentNoun, contentInvalidateKey, taxonomyEndpoint }` props from the app (`AppLayout.tsx`).
- ✅ `packages/llm/src/model-factory.ts` — app supplies temperature-error copy via `createModelFactory({ describeTemperatureFallback })`.
- ✅ `packages/server-kit` ↔ `packages/identity` cycle broken — media extracted to `@heybray/media` (`server-kit ← identity ← media`, `server-kit ← media`).

#### Deferred to a follow-up release *(not Phase 2)*
- Migration `0010`: drop legacy tables/columns after one release on the new schema — `scenario_reward_tiers`, `user_scenario_tier_rewards`, `roleplay_classification_links`, `point_transactions.roleplay_id`/`attempt_id`, `reward_tiers.legacy_id`. Old tables remain registered in `server/db.ts` (unread) until then.

### Phase 3 — Extension seams *(complete)*
- Implement the §5 interfaces with OSS defaults; convert SettingsModal panels and app admin panels to the AdminRegistry; route the three auth protocols through AuthProviderRegistry; emit audit events; wire no-op `requireFeature` tags on premium-candidate routes.
- **Risks:** low; purely additive.
- **Done when:** Scenarios runs entirely through the registries; a toy "disable leaderboard" EntitlementProvider proves the gate end-to-end, then is removed. ✅ Verified manually per `docs/phase-3-implementation.md` Step 10; results recorded in `docs/phase-3-verification.md`. The toy gate (`requireFeature("leaderboard")` / `FeatureGate`) was kept as the one permanent seam usage rather than removed, since it's the cheapest possible proof that the seam stays exercised going forward.

#### Deferred to a follow-up release *(not Phase 3)*
These are the OSS defaults' real, enterprise-grade implementations — all Phase 6, not gaps in Phase 3:
- `AuthProviderRegistry` route-splitting: `packages/identity/src/routes/authentication.ts` stays one file covering local/OIDC/SAML; per-provider route modules (needed for LDAP/multi-IdP) are deferred until an enterprise package actually needs them (Step 7's scope reduction).
- `AdminRegistry` server-side module registration (`registerAdminModule`): ships defined-but-unused; nothing in Scenarios currently needs dynamic route mounting.
- Real `StorageProvider` S3 implementation (default remains `FilesystemStorageProvider`).
- Real `NotificationTransport` SES implementation (default remains `LogNotificationTransport`; Scenarios sends no email today).
- Real `AuditSink` DB-persisted implementation + admin UI (default remains `LogAuditSink`).
- Real `EntitlementProvider` Stripe-backed implementation (default remains `EnvEntitlements`/`DISABLED_FEATURES`).
- Real `TenantResolver` (default remains `NullTenantResolver`; no `tenant_id` columns exist yet).

### Phase 4 — Lift to `bray-platform` + publish + consume *(complete)*
- `git filter-repo` (history-preserving) `packages/` into the new monorepo; add tsup builds, changesets, turbo, `examples/basic-app`, CLA action, license headers; publish `0.x` to npm.
- Scenarios: replace workspace deps with published versions; delete `packages/`. Cross-repo dev friction handled with `npm pack` verification and `npm link`/yalc for active work (documented in platform CONTRIBUTING).
- **Risks:** dual-repo iteration slowdown (mitigated: the strangler ordering means the API is already stable); source-vs-dist differences (mitigated: `examples/basic-app` consumes built dist in CI).
- **Done when:** Scenarios `main` depends only on published `@heybray/*`; a platform-only bugfix reaches Scenarios via a version-bump PR. ✅ Verified: initial `0.1.0` publish + `server-kit@0.1.2` getAppVersion() fix consumed via `npm install` with full test suite green.

### Phase 5 — App #2 validation *(complete — ADR pending ratification)*
- Built [`heybray-labs/bray-flashcards`](https://github.com/heybray-labs/bray-flashcards): flashcard/quiz trainer on published `@heybray/*` only — content type `deck`, mastery dimension `topic`, permission `deck:manage`, whitelabel UI.
- **Standalone app-shape decision:** [**template repo**](https://github.com/heybray-labs/bray-platform/blob/main/docs/app-shape-decision.md) (evolve `examples/basic-app` → `bray-app-template`). Single-package layout (`server/` + `src/`, one `package.json`) — not Scenarios' workspace split. `create-bray-app` generator deferred; feature-package bundling remains a Phase 6 question.
- Platform round-trip: **2 changesets / 4 package publishes** (`@heybray/gamification@0.2.0`, `@heybray/gamification-react@0.2.0`, `@heybray/react@0.1.2`, `@heybray/taxonomy@0.1.2`). One gap deferred (`legacy_id`, FL-005). Effort **well under** the ~1-week platform budget; dominant cost was chassis boilerplate (~39% of app source files near-verbatim from Scenarios).
- **Done when:** app #2 green suite + friction log + ADR written. ✅ Verified per `bray-flashcards/docs/phase-5-verification.md`. **Owner ratification of ADR still open** before treating the decision as locked.

### Phase 6 — Enterprise packages + premium app *(forces the premium bundling decision)*
- Mine WebAppTemplate: tenancy (TenantResolver + scoping wrappers), Stripe entitlements (EntitlementProvider + FeatureGate), audit DB sink + UI, SES NotificationTransport, S3 StorageProvider, API keys/rate-limit tiers, global admin console — each a private package implementing a Phase-3 seam.
- Premium app composes OSS apps + enterprise packages. **Decision forced at phase start:** apps as importable feature packages (premium imports `@heybray/scenarios-server` + `-client`) vs a fork-compose repo. Recommendation on current evidence: **feature packages** — after Phase 3, an "app" is already just `{ serverModule, clientRoutes, adminPanels, migrations }` thanks to the registries.

**Where the deferred app-shape decision bites:** Phase 1 (cheap optional prep: `packages/scenarios-shared`), ~~Phase 5 (standalone shape)~~ **resolved — template repo**, Phase 6 (premium bundling shape — hard deadline).

---

## 8. Risks & open questions

### Risks

| # | Risk | Mitigation |
|---|---|---|
| R1 | Phase-2 backfill on live deployments (three reshaped tables + two derived tables) | SQL-only backfills with in-migration count/sum assertions; existing `upgrade-backup.sh`/`upgrade-verify.sh` flow; old tables retained one release |
| R2 | Lost DB-level cascades when roleplay FKs leave platform tables | app-owned binding-FK migrations documented as the default pattern; `onContentDeleted` fallback |
| R3 | `gamification_content` projection drift (title/status desync) | event-bus sync + `reconcile()` + boot-time/CI drift check |
| R4 | tsx-source vs built-dist duality (`.ts` extension imports; `import.meta.url` migration-folder resolution changes under dist) | packages resolve migration folders via their own `import.meta.url`; `examples/basic-app` CI consumes built output |
| R5 | Release-train overhead | 8 runtime packages is the deliberate ceiling; resist further splits until app #2 demands them |
| R6 | AGPL inheritance for `@heybray/ui` consumers limits third-party adoption of the UI kit | accepted per licensing decision; state it plainly in the README |
| R7 | Raw-SQL leaderboard rank CTEs reference table names as strings — silent breakage on rename | golden-output tests against seeded data before/after Phase 2 |

### Open questions

1. ~~`@heybray` npm scope availability~~ — resolved in Phase 4 (`@heybray/*` published on npmjs.com).
2. Do `teams` stay in identity long-term, or become their own package when enterprise adds org hierarchies? (Start in identity.)
3. Should `activity_log` eventually get materialized per-user weekly rollups for scale, or is row-scan fine at OSS deployment sizes? (Defer; the service interface hides it.)
4. Leaderboard display-name policy: currently `firstName || email`, which exposes email addresses to all users. The generalization is the natural moment to add a display-name/opt-out policy hook.
5. `homepage_featured_scenarios` stays app-specific — but is "featured content" worth a platform slot later?
6. `roleplay-transfer.ts` import/export is app-specific — a platform "content transfer" envelope could generalize it later.
7. WebAppTemplate's richer gamification (levels, seasons, currency, inventory, store) — should `activity_log`/`point_transactions` reserve a nullable `season_id`-shaped column now? **Recommend no**; the schema design admits additive columns later.
8. Does the premium app need SSR or multi-domain serving beyond the current static-SPA chassis? (Affects Phase-6 chassis work only.)

---

## Appendix: key current-code reference points

| Concern | Where it is today |
|---|---|
| Gamification service | `@heybray/gamification` on npm (`GamificationService`, `TeamStarMapService`, `createGamificationRouter`) |
| Gamification client UI | `@heybray/gamification-react` on npm (points panels, star map, reveal pieces) |
| Legacy gamification tables (unread) | `server/legacy-schema/points-legacy.ts` — registered in `server/db.ts` until migration `0010` |
| Mastery dimension config | `server/gamification.ts` (`MASTERY_DIMENSION_SLUG`) |
| Scenario results composition | `server/controllers/scenario-results.controller.ts` |
| Media package | `@heybray/media` on npm (`MediaService`, `createMediaRouter`, `mediaSchema`) |
| Schema aggregation | `server/db.ts` (`identitySchema`, `taxonomySchema`, `gamificationSchema`, `mediaSchema`, `appSchema`) |
| Migration runner + baseline stamping | `server/init-db/run-migrations.ts` (`stampBaselineIfLegacyDatabase`, line 61) |
| Drizzle-kit package schemas | `server/drizzle-packages-schema.ts` (re-exports published `@heybray/*/schema` tables) |
| Whitelabel constants | `client/src/lib/app-config.ts` (via `@heybray/react/config` `AppConfigProvider`) |
| Auth protocol switch | `@heybray/identity` (`AUTH_PROTOCOL` env) |
| Platform source repo | `heybray-labs/bray-platform` (development home for all `@heybray/*` packages) |
| Enterprise precedents | WebAppTemplate: `client/src/AppExtensions.tsx`, `client/src/components/FeatureGate.tsx`, `shared/schemas/stripe-features.ts`, `server/middleware/{tenant,audit}.ts` |