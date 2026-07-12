# UI modularisation audit

Read-only audit of the `client/` app (March 2026). Focus: component duplication and reuse opportunities. Visual design must be preserved during refactors.

## Component layering

```
pages/          → routing, data fetching, layout composition
components/     → domain features (roleplays, points, teams, auth, errors)
  ui/           → shadcn primitives (button, card, badge, dialog, …)
lib/            → pure helpers (classification-display, user-display, cn)
index.css       → design tokens + global base styles
```

| Layer | Count / notes |
|-------|----------------|
| `ui/*` | 21 shadcn primitives; `Button`, `Dialog`, `Skeleton` most used |
| Domain | ~60 feature components across roleplays, points, teams, classifications |
| Pages | 11 pages; `RoleplayResults` (~908 lines) and `TeamStarMapPage` (~696 lines) carry the most inline UI |

### Pages by layering quality

| Page | Quality |
|------|---------|
| `HomePage` | Good — delegates to domain panels |
| `RoleplayIntroPage` | Good — composes scenario-detail components |
| `RoleplayResults`, `RoleplayTaking`, `TeamStarMapPage` | Heavy inline UI — primary extraction debt |
| `LoginPage`, `ScenarioSearchPage` | Moderate inline UI |

---

## Duplication clusters (ranked by impact)

### 1. Metadata chips and difficulty pills — **High**

**Files:** `ScenarioMetadataChips`, `ScenarioHeroBanner`, `HeroFeaturedCarousel`, `ScenarioCover`, `ScenarioRuns`, `ScenarioObjectives`

**Pattern:** Category/audience/difficulty/duration/tags rendered as `ClassificationChip` + raw `<span>` difficulty pills with duplicated Tailwind (`inline-flex rounded-full border px-2[.5] py-0.5 text-xs font-medium shadow-sm`) and style helpers from `classification-display.ts`.

**Differences:** Overlay vs inline tint; hero uses `text-white` on difficulty; field order and tag limits differ by surface.

**Extraction:** `DifficultyPill` primitive + extend `ScenarioMetadataChips` with `variant: "inline" | "overlay"` and optional `achievedTier`.

**Risk:** Medium–High if field order or spacing drifts.

**Do not merge:** `RewardTierLabel` into classification chips; browse-card tag row (max 2 tags in body) into full metadata row.

---

### 2. Card shells and cover overlays — **High**

**Files:** `ScenarioBrowseCard`, `ScenarioMiniCard` (orphaned), `HeroFeaturedCarousel`, `ScenarioCarouselCardSlot`, `ScenarioDetailCard`, `ScenarioCover`

**Pattern:** Relative cover zone + absolute ribbon/stars/pills. Shared classes: `rounded-xl border bg-card overflow-hidden shadow-sm`, `absolute top-2 right-2` stars, corner ribbons.

**Differences:** Browse card has admin chrome, rewards, CTA; cinema hero is full-bleed gradients; detail card is a section panel shell.

**Extraction:** Extend `ScenarioCover` sizes; unify cover overlays; add `featured` to `CardRibbon`.

**Risk:** High for merging browse ↔ cinema ↔ mini layouts.

**Do not merge:** `ScenarioDetailCard` into browse tiles; hero cinema into browse card.

---

### 3. Home sidebar panel shell — **Medium**

**Files:** `LeaderboardPanel`, `RecentStarsPanel`, `YourProgressPanel` (partial)

**Pattern:** `rounded-2xl border bg-card p-4 shadow-sm` + icon-in-circle header (`h-10 w-10 rounded-full bg-primary/10`).

**Extraction:** `HomeSidebarPanel` with `icon`, `title`, `subtitle`, `children`.

**Risk:** Low.

---

### 4. Category mastery row — **Medium**

**Files:** `YourProgressPanel`, `TeamStarMapComponents`, `TeamStarMapPage`

**Pattern:** Label + `CategoryMasteryBar` + `starred/total` count. Bar widths differ (`w-[9rem]` vs `w-[4.5rem]`).

**Extraction:** `CategoryMasteryRow` with configurable label slot and bar width.

**Risk:** Low–Medium (drawer header is a collapsible trigger, not a plain row).

---

### 5. Chat transcript UI — **Medium**

**Files:** `RoleplayTaking`, `RoleplayResults`

**Pattern:** Ended divider + message rows (avatar + bubble). Nearly duplicated markup.

**Extraction:** `TranscriptThread`, `TranscriptMessage`, `TranscriptDivider` under `components/roleplays/transcript/`.

**Risk:** Medium (streaming/loading states differ in taking view).

**Do not merge** until taking-page streaming behavior is accounted for.

---

### 6. Leaderboard rows — **Low priority**

**Files:** `LeaderboardPanel`, `ScenarioLeaderboard`, `RecentStarsPanel`

**Pattern:** Rank-ordered rows with avatar, initials, rank coloring.

**Extraction:** Optional `CurrentUserBadge`; shared row styling helpers.

**Risk:** Medium for a generic leaderboard — metrics and density differ.

**Do not merge:** Global points leaderboard ↔ per-scenario best-score leaderboard.

---

### 7. Attempt CTA labels — **Low**

**Files:** `ScenarioLaunchBar`, `FinalAttemptDialog`

**Pattern:** "Start attempt N of M" / "Starting…" / "No attempts remaining" logic.

**Extraction:** `getStartAttemptLabel()` in `lib/attempt-display.ts`.

**Risk:** Low.

---

### 8. User initials — **Low**

**Files:** `MainLayout`, `RoleplayTaking`, `RoleplayResults`, `YourProgressPanel`

**Pattern:** Profile first-letter extraction duplicated; `initialsFromName` exists but bypassed.

**Extraction:** `initialsFromUser()` in `lib/user-display.ts`.

**Risk:** Low.

---

### 9. Dead / orphaned code — **Cleanup**

| File | Status |
|------|--------|
| `NewScenarioRow.tsx` | Unreferenced — superseded by `HomepageCarouselRows` |
| `ContinueScenarioRow.tsx` | Unreferenced |
| `ScenarioMiniCard.tsx` | Only used by orphaned rows |
| `ScenarioMetadata.tsx` | Deprecated wrapper, unreferenced |

---

## CSS / styling notes

- **Tokens:** ~90 CSS variables in `index.css` (shadcn semantic + Bray brand + domain tokens).
- **Consumption:** Mostly arbitrary `var(--*)` in className strings; domain tokens not mapped in `tailwind.config.ts`.
- **Mismatch:** Some code uses `hsl(var(--success))` but tokens are already full `hsl(...)` strings — use `var(--success)` instead.
- **Dead config:** `tailwind.config.ts` references `--chart-*` and `--sidebar-*` not defined in `index.css`.
- **Shared style modules:** Only `drawer-pink-styles.ts`; pill/card/alert patterns not extracted.
- **Underused primitives:** `ui/alert` (2 consumers) vs 5+ custom alert/banner implementations.

### Repeated class compositions worth extracting (future)

| Pattern | Example sites |
|---------|---------------|
| Colored pills | 10+ roleplay/classification files |
| Card surfaces | points panels, scenario detail, results |
| Section eyebrows | `RoleplayResults`, `ScenarioDossier`, `ScenarioLaunchBar` |
| Alert/notice strips | `MainLayout`, `RoleplayTaking`, `ScenarioLaunchBar` |
| Back link | results, intro, search pages |

---

## Recommended shared primitives (minimal set)

1. `DifficultyPill` — difficulty/status colored pill variants
2. `ScenarioMetadataChips` (enhanced) — unified metadata row
3. `CardRibbon` — add `featured` variant
4. `HomeSidebarPanel` — home sidebar card shell
5. `CategoryMasteryRow` — label + bar + count
6. `getStartAttemptLabel` — attempt CTA copy
7. `initialsFromUser` — profile-based initials

**Future (higher effort):** `NoticeBanner`, `SurfaceCard`/`PanelCard`, `TranscriptThread`, `BackLink`, `SectionLabel`.

---

## Explicit do-not-merge list

| Pair | Reason |
|------|--------|
| Browse tiles ↔ cinema hero ↔ detail section panels | Different layout contracts and semantics |
| Global ↔ scenario leaderboards | Different metrics, APIs, density |
| `RecentStarsPanel` ↔ `LeaderboardPanel` | Activity feed vs ranked competition |
| `RewardTierLabel` ↔ `ClassificationChip` | Different schema and rendering |
| `CardRibbon` ↔ metadata chip flex row | Absolute corner chrome vs in-flow metadata |
| `ScenarioLaunchBar` ↔ `RoleplayConfigPanel` sticky footer | Fixed viewport vs in-panel admin save |
| `AuthHeroPanel` ↔ `ScenarioHeroBanner` | Static half-width vs dynamic full hero |
| `BrandedErrorScreen` ↔ hero panels | Error recovery UX vs presentation |

---

## Visual-preservation checklist (per extraction)

- [ ] Compare before/after in browser for each affected route
- [ ] Verify spacing (gap, padding, font-weight) matches exactly
- [ ] Verify overlay tints on dark backgrounds (hero, cinema carousel)
- [ ] Verify responsive breakpoints unchanged
- [ ] Run `npm run typecheck` in `client/`
