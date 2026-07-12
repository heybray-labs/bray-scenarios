# Phase 1 Implementation Brief — In-Repo Package Restructure

**Prerequisites:** read `AGENTS.md` and `docs/platform-architecture.md` (especially §2
Package inventory and §7 Phase 1). This brief is the executable work order for Phase 1 only.

## Goal

Restructure this repo into platform-shaped workspace packages under `packages/`, proving the
package boundaries from the architecture doc — **with zero behavior change and zero DB
change**. The packages stay private (`0.0.x`, not published) and are consumed as raw
TypeScript source, preserving the current tsx/vite no-build dev loop.

## Out of scope (do NOT do any of this in Phase 1)

- ❌ No SQL migrations, table renames, or column changes. `server/drizzle/` and its
  `meta/` directory must be byte-identical at the end of this phase.
- ❌ No gamification extraction. `points.ts` schema, `points.controller.ts`,
  `team.controller.ts`, `client/src/components/points/`, `client/src/components/teams/`,
  and `client/src/lib/reward-tier-utils.ts` **stay where they are** (Phase 2).
- ❌ No LLM table/schema renames. `shared/schemas/agent/roleplay-app-config.ts` and
  `roleplay-config.service.ts` stay app-side (Phase 2).
- ❌ No extension points (EntitlementProvider, AuditSink, AdminRegistry, etc. — Phase 3).
  Exception: the two minimal injection seams listed in Steps 6–7, which are required just
  to break imports that would otherwise point from a package into app code.
- ❌ No package builds (tsup/tsc dist), no publishing, no changesets (Phase 4).
- ❌ No renaming of DB tables, API routes, or permission strings.
- ❌ No behavior changes, no UI changes, no dependency upgrades.

## Target layout

```
packages/
  dev-config/          # shared tsconfig base (eslint config optional this phase)
  server-kit/          # chassis: app factory pieces, middleware, logger, db pool, migrations runner, media
  identity/            # users/roles/teams schemas, auth middleware+services, user/team CRUD
  taxonomy/            # classification dimensions/options + display helpers + service/routes
  llm/                 # model factory (with injected key resolver) — minimal this phase
  ui/                  # design-system React components + Tailwind tokens + cn()
  react/               # app runtime plumbing: AppConfigProvider, auth pages, layout shells, admin panels
```

Each package:
- `package.json`: `"name": "@heybray/<name>"`, `"version": "0.0.1"`, `"private": true`,
  `"type": "module"`, `"main": "./src/index.ts"` and `"exports"` mapping to `.ts` source
  (temporary until Phase 4 adds builds). Server packages export schemas at
  `"./schema": "./src/schema/index.ts"`.
- `tsconfig.json` extending `packages/dev-config/tsconfig.base.json`.
- Root `package.json` workspaces becomes `["client", "server", "packages/*"]`.

Consumption: server imports packages by name (tsx resolves the workspace symlink and runs
the TS source). Client imports `@heybray/ui` / `@heybray/react` by name; add the packages
to `client/tsconfig.json` paths if the editor needs help, and verify Vite resolves the
symlinked TS source (it does by default for workspace deps; if dep pre-bundling complains,
add the `@heybray/*` packages to `optimizeDeps.exclude`).

## Ordered steps

Work top to bottom; commit after each step; run `npm run typecheck` after each step and the
full verification (below) after steps 5, 9, and 11.

### Step 1 — Scaffolding
Create `packages/dev-config` (tsconfig base extracted from the common compiler options of
`client/tsconfig.json` / `server/tsconfig.json`) and the six empty packages with the
package.json shape above. Add `packages/*` to root workspaces. `npm install` to wire
symlinks. Nothing imports them yet; CI must still be green.

### Step 2 — `@heybray/server-kit` (part 1: pure utilities)
`git mv` these into `packages/server-kit/src/` and update importers:

| Source | Destination |
|---|---|
| `server/utils/logger.ts` | `server-kit/src/logger.ts` |
| `server/utils/app-version.ts` | `server-kit/src/app-version.ts` |
| `server/utils/secret-encryption.ts` | `server-kit/src/secret-encryption.ts` |
| `server/middleware/request-logging.ts` | `server-kit/src/middleware/request-logging.ts` |
| `server/middleware/rate-limit.ts` | `server-kit/src/middleware/rate-limit.ts` |
| `server/init-db/resolve-database-url.ts` | `server-kit/src/db/resolve-database-url.ts` |

Also extract from `server/db.ts` a `createDb(schema)` factory (pool creation + drizzle
init) into `server-kit/src/db/create-db.ts`; `server/db.ts` keeps the schema composition
and calls the factory. Do NOT move `server/app.ts` wholesale — the `createApp()`
generalization is richer than Phase 1 needs; move only what has no app imports.

`server/utils/cookies.ts` → identity (Step 3), it is auth-flavored.

### Step 3 — `@heybray/identity`
Schemas (`git mv` into `packages/identity/src/schema/`):
`shared/schemas/users.ts`, `roles.ts`, `teams.ts`, `user-identities.ts`,
`auth-exchange-codes.ts`, and `shared/schemas/types.ts` (auth/user API types — SafeUser,
UserWithRole, credentials types) as `identity/src/schema/types.ts`.

Server code into `packages/identity/src/`:

| Source | Destination |
|---|---|
| `server/middleware/auth.ts` | `identity/src/middleware/auth.ts` |
| `server/config/auth-config.ts` | `identity/src/auth-config.ts` |
| `server/utils/cookies.ts` | `identity/src/cookies.ts` |
| `server/utils/{saml-idp-metadata,saml-post-body,saml-sp-cert,google-saml-account-chooser}.ts` | `identity/src/saml/` |
| `server/services/{oidc-auth,saml-auth,sso-exchange,sso-user-resolution}.service.ts` | `identity/src/services/` |
| `server/routes/{authentication,users,teams}.ts` | `identity/src/routes/` |
| `server/controllers/user.controller.ts` | `identity/src/controllers/user.controller.ts` |

**`team.controller.ts` split:** move only the team-CRUD functions (create/update/delete/
list/membership) into `identity/src/controllers/team.controller.ts`. The star-map/stats
functions (everything touching `pointsController`, `roleplays`, `roleplayAttempts`,
`classificationDimensions` — roughly lines 300+) stay in a slimmed
`server/controllers/team-star-map.controller.ts`. Split `server/routes/teams.ts`
accordingly (CRUD routes → identity; star-map route stays app-side).

Client-side: `shared/schemas/types.ts` consumers (`use-auth.ts`, `auth.ts`, LoginPage,
Users/Teams panels) switch to importing from `@heybray/identity/schema`.

### Step 4 — `@heybray/taxonomy`
**Split `shared/schemas/roleplay-classifications.ts`:** `classificationDimensions`,
`classificationOptions` (+ their zod schemas/types) → `taxonomy/src/schema/`.
`roleplayClassificationLinks` (+ its types) stays app-side — move it to
`shared/schemas/roleplay-classification-links.ts` (it renames/generalizes in Phase 2, not
now). Update all importers of the split file.

| Source | Destination |
|---|---|
| `shared/schemas/classification-display.ts` | `taxonomy/src/schema/display.ts` |
| `server/services/classification.service.ts` | `taxonomy/src/service.ts` (its `roleplayClassificationLinks` usages, if any, must be parameterized or stay app-side — check imports first) |
| `server/routes/roleplay-classifications.ts` | `taxonomy/src/routes.ts` (route paths unchanged) |

Client: `client/src/lib/classification-display.ts` and the generic pieces of
`client/src/components/classifications/` (ClassificationChip, ClassificationOptionLabel,
ClassificationOptionList, ClassificationMultiSelect, FilterMultiSelect,
OptionDisplayFields) → `@heybray/react` in Step 9 (keep them with the other client moves).
`DifficultyPill.tsx`: inspect it — if it hardcodes roleplay difficulty semantics it stays
app-side.

### Step 5 — Recompose `server/db.ts`
```ts
import { identitySchema } from "@heybray/identity/schema";
import { taxonomySchema } from "@heybray/taxonomy/schema";
// app schemas (roleplay-core, links, points, media until moved, agent config)
const schema = { ...identitySchema, ...taxonomySchema, ...appSchema };
```
Table set must be IDENTICAL to before (same 21 tables). Run full verification now.

### Step 6 — Media into `server-kit` (with usage-hook seam)
`shared/schemas/media-assets.ts` → `server-kit/src/schema/media-assets.ts`;
`server/services/media.service.ts` → `server-kit/src/media/media.service.ts`;
`server/routes/media.ts` → `server-kit/src/media/routes.ts`.

**Coupling to break:** `media.service.ts` currently imports `roleplays` to (a) count cover
usage (`leftJoin` on `roleplays.coverImageMediaId`) and (b) detach covers on delete. Define
in server-kit:

```ts
export interface MediaUsageHook {
  countUsages(mediaIds: number[]): Promise<Map<number, number>>;
  onMediaDeleted(mediaId: number): Promise<void>; // detach references
}
```

The service takes an optional `MediaUsageHook` (default: no usages). The app registers a
roleplay-backed implementation (new file `server/media-usage.ts` containing the moved
queries). Behavior must be identical.

### Step 7 — `@heybray/llm` (minimal)
Move `server/roleplay/model-factory.ts` → `llm/src/model-factory.ts`. **Coupling to
break:** it currently calls `roleplayConfigService.getDecryptedApiKeyForProvider`. Change
the factory to accept an injected resolver:

```ts
export interface LlmKeyResolver {
  getApiKey(provider: LlmProvider): Promise<string | null>;
}
export function createModelFactory(resolver: LlmKeyResolver) { ... }
```

Move `openAiSupportsCustomTemperature`, temperature resolution, and the provider `type`
(rename `RoleplayProvider` → `LlmProvider` with a re-export alias app-side to avoid churn).
`RoleplayNotConfiguredError` → `LlmNotConfiguredError` (same alias approach). The app wires
`roleplayConfigService` in as the resolver at startup. `roleplay-config.service.ts`,
`agent-config.service.ts`, `agent-model-catalog.service.ts`, and the
`agent/roleplay-app-config.ts` schema ALL STAY app-side until Phase 2.

### Step 8 — `@heybray/ui`
`git mv` into `packages/ui/src/`:

| Source | Destination |
|---|---|
| `client/src/components/ui/*` (all 22 files incl. NoticeBanner) | `ui/src/components/` |
| `client/src/components/errors/*` | `ui/src/errors/` |
| `client/src/lib/utils.ts` (`cn`) | `ui/src/utils.ts` |
| `client/src/lib/ContentHeaderCard.tsx` | `ui/src/ContentHeaderCard.tsx` |
| `client/src/hooks/use-toast.ts` | `ui/src/hooks/use-toast.ts` |
| `client/src/hooks/use-debounced-value.ts` | `ui/src/hooks/use-debounced-value.ts` |

Tailwind: create `ui/src/tailwind-preset.ts` exporting the theme extension currently in
`client/tailwind.config.ts`; the client config becomes
`presets: [preset]` + its `content` globs (which must now also include
`../packages/ui/src/**/*.{ts,tsx}` and `../packages/react/src/**/*.{ts,tsx}`). CSS
variables stay in `client/src/index.css` for now (they are the app's brand values).
`client/src/components/icons/roleplay-field-icons.tsx` is app-specific — stays.

React/lucide/radix/etc. are declared as `peerDependencies` in ui/react packages, with the
client remaining the installer (no version changes).

### Step 9 — `@heybray/react`
`git mv` into `packages/react/src/`:

| Source | Destination |
|---|---|
| `client/src/lib/{queryClient,http-error,auth,user-display,media}.ts` | `react/src/lib/` |
| `client/src/lib/oidc-provider-icon.ts` | `react/src/lib/` |
| `client/src/hooks/{use-auth,use-authenticated-image}.ts` | `react/src/hooks/` |
| `client/src/components/{ProtectedRoute,MainLayout,AppBrandTitle,SettingsModal,AboutPanel,AuthHeroPanel}.tsx` | `react/src/components/` |
| `client/src/components/{UsersManagementPanel,TeamsManagementPanel,MediaManagementPanel,ClassificationManagementPanel}.tsx` | `react/src/admin/` |
| `client/src/pages/{LoginPage,RegisterPage,OidcCallbackPage,SamlCallbackPage}.tsx` | `react/src/pages/` |
| generic `client/src/components/classifications/*` (per Step 4) | `react/src/classifications/` |

Stays app-side: HomePage, all Roleplay* pages, ScenarioSearchPage, TeamStarMapPage,
FeaturedScenariosPanel, RoleplayConfigPanel, `components/roleplays/`, `components/points/`,
`components/teams/`, `components/roleplay-config/`, `lib/{attempt-display,cheat-mode,
classification-display client-copy if app-flavored,roleplay-transfer,reward-tier-utils}.ts`,
hooks `use-featured-scenario`, `use-roleplay-stream`, `use-scenario-admin-actions`.

If MainLayout/SettingsModal hardcode app-specific nav items or panels, do NOT build a
registry (Phase 3): give them props (`navItems`, `settingsPanels`) and pass the current
values from the app. Smallest change that removes app imports from the package.

### Step 10 — `AppConfigProvider` (whitelabel seam)
In `@heybray/react`: `AppConfigProvider` + `useAppConfig()` providing
`{ displayName, tagline?, urls: { repo, docs?, issues?, releases? } }`. Wrap the app in
`client/src/App.tsx` with the current values from `client/src/lib/app-config.ts`, convert
the ~6 consumers (MainLayout, AboutPanel, LoginPage, RegisterPage, RoleplayTaking, …) to
`useAppConfig()`, then delete `client/src/lib/app-config.ts`. Rendered output must be
identical.

### Step 11 — Dissolve the rest of `shared/`
After Steps 3–7, `shared/schemas/` holds only app schemas (`roleplay-core.ts`,
`roleplay-classification-links.ts`, `roleplay-transfer.ts`, `points.ts`,
`agent/roleplay-app-config.ts`). Either leave them in `shared/` (acceptable) or move to
`app-shared/schemas/` updating the `@shared` alias — pick ONE and apply consistently.
Leaving them in `shared/` is the lower-churn choice and is fine.

## Verification (all must pass; this is the Phase 1 done-definition)

```bash
npm install                          # workspaces wire up cleanly
npm run typecheck                    # all workspaces
npm run build --workspace=client     # vite production build succeeds
npm test                             # full API suite vs fresh Postgres (:5434)
git diff --stat main -- server/drizzle/   # MUST be empty (no migration changes)
```

Then behavioral spot-checks with `npm run dev` + `npm run db:seed-demo`:
login (local auth), browse scenarios, open a scenario detail (classifications render),
complete or view results (points/stars render), leaderboard panel, team star map page,
media management panel (upload + usage count), users/teams/classification admin panels,
About panel shows app name + version.

Also confirm: `git log --follow` shows history on moved files (moves, not rewrites), and
the Docker build still succeeds: `docker build -t scenarios-test .` (the Dockerfile may
need `packages/` added to its COPY context — that is an allowed Phase 1 change).

## Acceptance checklist

- [ ] All verification commands green; CI green on the PR
- [ ] `server/drizzle/` untouched; DB table set identical (21 tables)
- [ ] Zero user-visible behavior change
- [ ] No package imports app code (`packages/**` must not import from `server/`,
      `client/src/`, or app-side `shared/` — enforce by grep:
      `grep -rn "from \"\.\./\.\./server\|from \"@shared" packages/` returns nothing)
- [ ] Gamification files untouched except the team.controller split (Step 3)
- [ ] Moves are `git mv` (history preserved), one package per commit where practical