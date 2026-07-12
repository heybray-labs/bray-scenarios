# Phase 1 Remediation Brief — Review Fixes Before Phase 2

**Prerequisites:** read `AGENTS.md`. This brief is the executable work order for fixing the
findings from the Phase 1 code review (range `2847aae..HEAD`). All Phase 1 rules still
apply: **zero user-visible behavior change, zero DB migration changes** (`server/drizzle/`
stays byte-identical), no dependency version upgrades, one fix per commit.

The review verdict was positive — boundaries clean, behavior preserved, db.ts table set
identical. These are the ten items that must be fixed (or explicitly deferred with markers)
before Phase 2 starts. Work top to bottom.

## Fix 1 — drizzle-kit no longer sees the moved schemas (SEVERE — data-loss footgun)

`server/drizzle.config.ts:11` still has `schema: "../shared/schemas/**/*.ts"`, but 8 tables
moved into packages (users/roles/teams → identity; media_assets → server-kit;
classification dimensions/options → taxonomy). Running `npm run db:generate` or
`npm run db:push` (which hardcodes `--force`) would diff a half-empty schema against a live
DB and emit DROP TABLE statements.

Change the config to an array covering both locations:
```ts
schema: ["../shared/schemas/**/*.ts", "../packages/*/src/schema/**/*.ts"],
```
Then verify: run `npm run db:generate` against a scratch database and confirm the generated
SQL contains **no DROP statements and no changes at all** (schema should be in sync).
Delete any generated files — do NOT commit new migrations.

## Fix 2 — restore the dropped FK in the media schema definition

`packages/server-kit/src/schema/media-assets.ts:11` lost the foreign key the old
`shared/schemas/media-assets.ts` had:

- Old: `createdBy: integer("created_by").references(() => users.id)`
- Now: `createdBy: integer("created_by")`

Restore the `.references()` by importing `users` from `@heybray/identity/schema`
(package→package imports are allowed; add `@heybray/identity` to server-kit's dependencies
per Fix 4). This makes the Drizzle schema agree with the constraint that already exists in
the live DB. Re-run the Fix 1 verification afterward — `db:generate` must produce nothing.

## Fix 3 — auth middleware runs twice on `/api/teams` star-map routes

`server/app.ts:91-92` mounts two routers at the same prefix:
```ts
app.use("/api/teams", teamsRouter);        // @heybray/identity CRUD router
app.use("/api/teams", teamStarMapRoutes);  // app star-map router
```
Both routers open with `router.use(authenticateToken)` + `router.use(requirePasswordChanged)`
(`packages/identity/src/routes/teams.ts:24-25`, `server/routes/team-star-map.ts:16-17`).
Star-map paths (`GET /:id/star-map`, `/:id/members/...`) match nothing in `teamsRouter`, so
they run its middleware (including a users⨝roles DB query in `authenticateToken`), fall
through, and run the identical middleware again in the second router.

Fix: apply the auth chain exactly once. Preferred shape — a wrapper router in
`server/app.ts`:
```ts
const teamsRoot = Router();
teamsRoot.use(authenticateToken);
teamsRoot.use(requirePasswordChanged);
teamsRoot.use(teamsRouter);          // with its own router.use(auth...) lines REMOVED
teamsRoot.use(teamStarMapRoutes);    // with its own router.use(auth...) lines REMOVED
app.use("/api/teams", teamsRoot);
```
Both sub-routers keep their route definitions and per-route permission checks unchanged.
Check whether either router is mounted anywhere else before removing its internal auth
lines (it isn't, but verify). All 9 team routes must still 401 without a token — the API
test suite covers this; also confirm via dev-server logs that a star-map request performs
exactly one user lookup.

## Fix 4 — server packages declare zero dependencies (breaks the future repo lift)

`packages/{identity,server-kit,taxonomy,llm}/package.json` have no `dependencies` or
`peerDependencies`, yet import express, drizzle-orm, drizzle-zod, zod, pg, multer,
express-rate-limit, jsonwebtoken, bcrypt, nanoid, @node-saml/node-saml, openid-client,
selfsigned, and @langchain/{anthropic,core,google-genai,openai}. They resolve only because
npm hoists server's deps to the root — phantom dependencies.

For each of the four packages: inspect its actual imports and declare each third-party
runtime lib in `dependencies`, using the **same version range as `server/package.json`**
(no upgrades). Declare sibling `@heybray/*` imports as `"dependencies": { "@heybray/x": "*" }`
(matching how `@heybray/react` already does it). Run `npm install`; the lockfile diff must
show only workspace re-wiring, zero third-party version changes.

## Fix 5 — packages are never typechecked in CI

No package has a `typecheck` script, so root `npm run typecheck --workspaces --if-present`
skips all seven. Add to every `packages/*/package.json` (except dev-config):
```json
"scripts": { "typecheck": "tsc -p tsconfig.json --noEmit" }
```
Run `npm run typecheck` from the root and fix any type errors this newly surfaces (there
may be some — the packages have never been directly checked).

## Fix 6 — parameterize the hardcoded `"roleplay:manage"` in server packages

The client side of this seam was done correctly (`SettingsModal` takes a `managePermission`
prop). The server side hardcodes the app's permission string inside platform packages:

- `packages/taxonomy/src/routes.ts` — lines 15, 34, 66, 85, 106, 127
- `packages/identity/src/controllers/team.controller.ts:27` (`hasManagePermission`)

Convert the taxonomy router to a factory `createTaxonomyRouter({ managePermission })` and
thread the option through; same for the identity team controller (accept the permission
string via its constructor/factory). The app passes `"roleplay:manage"` at the wiring site
in `server/app.ts` — the string, routes, and behavior stay identical; only its *home* moves
from platform code to app config. While here, remove the `= "roleplay:manage"` default on
`packages/react/src/components/SettingsModal.tsx:39` and pass the value explicitly from
`client/src/components/AppLayout.tsx` (a platform package should not default to one app's
permission).

## Fix 7 — move roleplay difficulty semantics back app-side

The Phase 1 brief said difficulty-flavored code stays app-side; it was moved into the
platform package:

- `packages/react/src/classifications/DifficultyPill.tsx` (only consumed by roleplay
  components: ScenarioCover, HeroFeaturedCarousel, ScenarioMetadataChips)
- `packages/react/src/lib/classification-display.ts:55-74` — `formatDifficulty()` and
  `getDifficultyColor()` with the easy/medium/hard switch and `--difficulty-*` CSS vars

`git mv` DifficultyPill back to `client/src/components/classifications/DifficultyPill.tsx`.
Split classification-display: the difficulty functions move to a new app-side
`client/src/lib/difficulty-display.ts`; the generic helpers (chip/overlay styles,
`resolveOptionDisplay`, etc.) stay in the package. Update the three consumers' imports.
No rendering change.

## Fix 8 — defer the taxonomy Scenarios-shape to Phase 2, with markers (DO NOT rework now)

Known, accepted debt — reworking it now would be doing Phase 2 early:

- `packages/taxonomy/src/schema/links-registry.ts` — the fallback table and
  `ClassificationLinksTable` type are roleplay-shaped
- `packages/taxonomy/src/service.ts` — `emptyClassifications()` /
  `mapLinksToClassifications()` hardcode category/audience_level/duration/tags and the
  switch silently drops unknown dimensions
- `packages/react/src/admin/{MediaManagementPanel,ClassificationManagementPanel}.tsx` —
  hardcoded `/api/roleplays` invalidations and "scenario" copy
- `packages/llm/src/model-factory.ts:165` — "Roleplay will omit…" user-facing copy

Add a `// PHASE-2: generalize — see docs/platform-architecture.md §3/§7` comment at each
site, and append a short "Carried debt from Phase 1" list to the Phase 2 section of
`docs/platform-architecture.md` naming these four items (plus: endpoint/copy adapter for
the admin panels, error-copy injection for llm). No code behavior changes.

## Fix 9 — commit the governing docs

`AGENTS.md`, `docs/platform-architecture.md`, and `docs/phase-1-implementation.md` are
untracked. Commit them (single docs commit). Add this file too.

## Fix 10 — minor cleanups (one commit)

- Delete the dead alias line `export { LlmNotConfiguredError as RoleplayNotConfiguredError }`
  in `server/services/roleplay-config.service.ts:474` (the live alias is in
  `server/roleplay/model-factory.ts`; grep first to confirm zero importers of the
  service-path alias).
- Delete the dead re-export `export { openAiSupportsCustomTemperature }` at
  `server/roleplay/model-factory.ts:17` (zero importers).
- `client/src/components/AppLayout.tsx:150`: change the props type from
  `{ children: ReactNode } & Partial<NavbarProps>` to `{ children: ReactNode }` — the extra
  props are silently ignored.
- `packages/react/package.json`: the root barrel `src/index.ts` is `export {}` while
  `"main"`/`"."` point at it. Remove the `"."` and `"main"` entries so consumers must use
  the subpath exports (matching actual usage), or populate the barrel. Prefer removing.

## Out of scope

- ❌ No changes under `server/drizzle/` (Fix 1 verification generates files locally only —
  never commit them).
- ❌ No Phase 2 work: no table renames, no gamification extraction, no generalizing the
  taxonomy shapes beyond the markers in Fix 8.
- ❌ No dependency version changes — Fix 4 copies existing ranges only.
- ❌ No route path, status code, string, or permission-value changes.

## Verification (all must pass)

```bash
npm install                          # lockfile: workspace wiring only, no version bumps
npm run typecheck                    # now includes all packages — green
npm run build --workspace=client     # green
npm test                             # full API suite — green (covers team auth after Fix 3)
git diff --stat main~N -- server/drizzle/   # empty across your commits
```

Plus:
- Fix 1/2: `npm run db:generate` against a scratch DB → generates nothing (schema in sync).
- Fix 3: one auth DB lookup per star-map request (observe request logs in dev).
- Fix 7: scenario browse/detail pages render difficulty pills identically.

## Acceptance checklist

- [ ] All verification commands green
- [ ] `packages/**` contains no hardcoded `roleplay:manage` (grep returns nothing)
- [ ] `packages/react` contains no difficulty semantics (grep `getDifficultyColor` → app only)
- [ ] Every server package's imports are covered by its own `dependencies`
- [ ] `// PHASE-2:` markers present at all four Fix 8 sites; architecture doc updated
- [ ] Governing docs committed
- [ ] One fix per commit, messages referencing the fix numbers from this brief