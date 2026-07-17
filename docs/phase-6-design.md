# Phase 6 Design — Premium SaaS: Tenancy, Spaces, Economy

**Status:** Decisions ratified 2026-07-17. Supersedes the Phase 6 sketch in
`docs/platform-architecture.md` §7 (which should be updated to point here).
**Prerequisite state:** `@heybray/*` at 1.0.0+; two standalone apps + template green;
extension seams live with OSS defaults.

## 1. Decision record (ratified — do not relitigate)

| Area | Decision |
|---|---|
| Product | SaaS operated by us; customer orgs subscribe as tenants |
| Tenancy | Subdomain per tenant (`acme.<product>.com`); no in-app switcher in v1 |
| Billing v1 | Placeholder: global-admin assigns a plan; enforcement via `EntitlementProvider`; Stripe deferred |
| Bundling | **Feature packages**: apps extracted to `@heybray/scenarios-{server,client}` and `@heybray/flashcards-{server,client}`; standalone repos become thin shells; premium imports both |
| UX | Spaces-style universal container; **inline authoring** in the space tree (with a decision gate — see §5 risk R1) |
| Gamification | Full economy (levels/XP, achievements, coins, daily store, inventory, avatars, seasons+drops) as **premium-only packages** over the OSS engine's events |
| Teams | Kept, tenant-scoped; cross-app team star map is a flagship manager surface |
| Enterprise v1 | Audit DB + admin UI, SES email, S3 storage, **invitations flow, 2FA activation** |
| Global admin | Tenant ops (create/suspend/plan) + economy authoring (seasons, items, store policies) only |
| Unified surfaces v1 | Dashboard + notifications center. Search and standalone→premium importer deferred |
| Bubble (6B or 6C) | Role-management UI for tenant admins |

**Consciously out of scope for all of Phase 6** (recorded so omission is a decision, not
an accident): Stripe billing suite; API keys/rate tiers/Swagger; full global-admin console
(global user browse, system settings); unified search; customer-owned vanity domains; the
WebAppTemplate content modules (quizzes, surveys, hackathons, idea-jams, news, boards/
discussions, projects, widget-pages); AI assistant + MCP server; file library with
folders/permissions; favorites; competitions; profile extensions; the AWS CloudFormation/
ECS estate (premium hosting architecture is a 6B workstream, not a port).

## 2. Target repo & package architecture

| Repo | Visibility | Contents |
|---|---|---|
| `bray-scenarios`, `bray-flashcards` | public, AGPL | Thin runnable shells + domain feature packages published to public npm: `@heybray/scenarios-server`, `@heybray/scenarios-client`, `@heybray/flashcards-server`, `@heybray/flashcards-client` (AGPL — we hold copyright, so premium use is clean) |
| `bray-platform` | public, AGPL | Unchanged role; gains the platform changesets Phase 6 forces (multi-dimension mastery in 6A; tenancy hooks in 6B) |
| `bray-enterprise` | **private** | Enterprise + economy packages under the **`@heybray-labs/*`** scope on GitHub Packages (verify scope/registry mechanics at 6B start; the public `@heybray` scope stays npmjs-only). Planned packages: `ent-tenancy`, `ent-audit`, `ent-notifications-ses`, `ent-storage-s3`, `ent-entitlements`, `ent-economy`, `ent-seasons`, `ent-admin` |
| `bray-premium` | **private** | The SaaS app: composes platform packages + both app feature packages + enterprise packages. Proprietary license |

**A feature package is** what Phase 3's registries already made an app: routes/services +
Drizzle schema + migrations folder + admin panels + client pages/components, exported for
mounting. The thin shell that remains in each standalone repo is: boot files, `.env`,
Docker/CI, seed/demo data, and the app-definition config — under ~500 lines.

## 3. What the premium app gets "for free" vs what is new integration

**Free by prior design:** one login/one DB with both content types registered → unified
points, streaks, leaderboards, and the cross-app team star map with zero engine changes
(the `(content_type, content_id)` decision paying out). Admin tabs compose via
`AdminRegistry`. Feature gating via `EntitlementProvider`.

**Known new platform work (public `@heybray/*` changesets):**
- **Multi-dimension mastery (6A):** `GamificationConfig.masteryDimensionSlug` becomes
  per-content-type (`contentTypes: [{type, label, masteryDimensionSlug}]`); leaderboard
  scope param carries the dimension; panels take it per-tab. Back-compat for single-type apps.
- **Tenancy hooks (6B):** the deliberate Phase-3 restraint comes due. 6B opens with a
  design spike choosing between tenant_id columns in platform tables (a **2.0 major** with
  expand/contract migrations) vs enterprise-package query wrapping via the request context.
  This is the largest platform change since Phase 2 — the spike is mandatory, not optional.

## 4. Sub-phases (each independently shippable)

- **6A — Extraction + premium shell.** Apps → feature packages (strangler: in-repo
  workspaces → publish → shells consume). New `bray-premium` (private, single-tenant for
  now) mounts both apps as sections under one shell, one identity, one gamification ledger.
  Multi-dimension mastery changeset. *Done when: premium boots with both apps fully
  functional under one login; standalone apps still ship independently.*
- **6B — Tenancy + enterprise v1.** Tenancy spike + implementation (subdomain resolver,
  tenant membership, scoping); audit DB+UI; SES transport; S3 storage; invitations; 2FA
  activation; placeholder billing enforcement; global-admin tenant ops; premium hosting
  architecture chosen and stood up. Role-management UI if capacity allows (else 6C).
  *Done when: two real tenants coexist with isolated data on one deployment.*
- **6C — Spaces + unified dashboard.** Space container schema/tree/routing; **week-one
  spike: embed one app builder inline** (gate: if embedding is ugly, fall back to
  reference-based authoring — decision documented, not silently made); unified home.
- **6D — Economy + notifications.** `ent-economy`/`ent-seasons` packages consuming
  platform events; daily store/inventory/avatars; global-admin economy authoring;
  notifications center (in-app + SES).

## 5. Top risks

- **R1 — Inline authoring** (see 6C gate). The single most likely decision to be revised.
- **R2 — Tenancy scope creep**: every platform query touched. Mitigation: the 6B spike, and
  tenant-scoping tested via the OSS apps' suites (which must stay green as single-tenant).
- **R3 — Extraction regressions in 6A**: mitigated the Phase-1 way — golden suites exist in
  both apps; extraction is moves-not-rewrites; shells must produce byte-identical behavior.
- **R4 — Private-registry mechanics** (GitHub Packages scope/auth for `@heybray-labs/*`):
  verify in week one of 6B before building on it.
- **R5 — Economy is a product, not a feature**: 6D needs its own design pass against
  WebAppTemplate's schemas before any brief is written.
