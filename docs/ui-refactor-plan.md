# UI refactor plan

Prioritized backlog from the [UI audit](./ui-audit.md). **Visual design must not change** — structural refactors only.

Approve or reprioritize items before each implementation batch.

---

## Priority 1 — Low risk, high value (implement first)

### P1.1 Remove orphaned mini-card stack

| | |
|---|---|
| **Files** | Delete `NewScenarioRow.tsx`, `ContinueScenarioRow.tsx`, `ScenarioMiniCard.tsx`, `ScenarioMetadata.tsx` |
| **Why** | Zero imports; superseded by `HomepageCarouselRows` + `ScenarioBrowseCard` |
| **API** | N/A — deletion |
| **Migration** | Delete files; confirm no imports via grep |
| **Verification** | `npm run typecheck`; homepage carousels unchanged |
| **Effort** | S |
| **Risk** | Low |

---

### P1.2 Extract `DifficultyPill`

| | |
|---|---|
| **Files** | New `components/classifications/DifficultyPill.tsx`; update `ScenarioMetadataChips`, `ScenarioHeroBanner`, `HeroFeaturedCarousel`, `ScenarioCover` |
| **API** | `{ difficulty: string; variant?: "inline" \| "overlay" \| "hero" \| "cover"; className? }` |
| **Migration** | Create component → replace raw `<span>` pills one file at a time |
| **Verification** | Scenario intro hero, browse cards, featured carousel cover overlays |
| **Effort** | S |
| **Risk** | Low–Medium (font-weight: `font-medium` vs `font-semibold` per variant) |

---

### P1.3 Add `featured` variant to `CardRibbon`

| | |
|---|---|
| **Files** | `CardRibbon.tsx`, `HeroFeaturedCarousel.tsx` |
| **API** | `variant: "new" \| "progress" \| "featured"` |
| **Migration** | Extend variant union → replace hardcoded Featured `<span>` in hero carousel |
| **Verification** | Homepage hero carousel ribbon matches browse-card ribbon styling |
| **Effort** | S |
| **Risk** | Low |

---

### P1.4 Extract `getStartAttemptLabel`

| | |
|---|---|
| **Files** | New `lib/attempt-display.ts`; update `ScenarioLaunchBar.tsx` |
| **API** | `getStartAttemptLabel({ isOutOfAttempts, hasUnlimited, attemptCount, maxAttempts, startPending })` |
| **Migration** | Extract helper → use in launch bar (dialog uses different copy — keep separate) |
| **Verification** | Scenario intro launch bar CTA labels for unlimited, limited, exhausted, pending states |
| **Effort** | S |
| **Risk** | Low |

---

### P1.5 Add `initialsFromUser` and deduplicate

| | |
|---|---|
| **Files** | `lib/user-display.ts`, `MainLayout.tsx`, `RoleplayTaking.tsx`, `RoleplayResults.tsx`, `YourProgressPanel.tsx` |
| **API** | `initialsFromUser(user)` — profile first letters, email fallback |
| **Migration** | Add helper → replace inline logic |
| **Verification** | Navbar avatar, chat transcripts, progress panel avatar |
| **Effort** | S |
| **Risk** | Low |

---

## Priority 2 — Medium value panel/metadata consolidation

### P2.1 Extract `HomeSidebarPanel`

| | |
|---|---|
| **Files** | New `components/points/HomeSidebarPanel.tsx`; update `LeaderboardPanel`, `RecentStarsPanel` |
| **API** | `{ icon: LucideIcon; title: string; subtitle?: string; className?; children }` |
| **Migration** | Extract shell → migrate leaderboard, then recent stars |
| **Verification** | Home page sidebar panels — header icon, title, subtitle, padding |
| **Effort** | S |
| **Risk** | Low |

---

### P2.2 Enhance `ScenarioMetadataChips` for overlay + achieved tier

| | |
|---|---|
| **Files** | `ScenarioMetadataChips.tsx`, `ScenarioHeroBanner.tsx`, `HeroFeaturedCarousel.tsx` |
| **API** | Add `variant?: "inline" \| "overlay"`, `achievedTier?`, `maxTags?` |
| **Migration** | Extend chips → replace inline chip blocks in hero banner and featured card |
| **Verification** | Scenario intro hero metadata row; featured carousel chip row on dark background |
| **Effort** | M |
| **Risk** | Medium (gap: hero uses `gap-2`, default uses `gap-1.5` — pass via className) |

---

### P2.3 Extract `CategoryMasteryRow`

| | |
|---|---|
| **Files** | New `components/points/CategoryMasteryRow.tsx`; update `YourProgressPanel` |
| **API** | `{ label: ReactNode; starCounts; total; barClassName?; highlight?; countClassName? }` |
| **Migration** | Extract from `CategoryMasteryRowView` → use in progress panel |
| **Verification** | Home page "Your progress" category rows |
| **Effort** | S |
| **Risk** | Low |

Later: adopt in `TeamStarMapComponents` drawer headers (collapsible trigger variant).

---

## Priority 3 — Page decomposition (higher effort)

### P3.1 Extract results page components

| | |
|---|---|
| **Files** | Move from `RoleplayResults.tsx` to `components/roleplays/results/*` |
| **Targets** | `StagePanel`, `FieldBlock`, `ResultsRevealHero`, reveal animations |
| **Verification** | Full results reveal flow, reduced-motion path |
| **Effort** | L |
| **Risk** | Medium |

---

### P3.2 Extract shared transcript components

| | |
|---|---|
| **Files** | New `components/roleplays/transcript/*`; update `RoleplayTaking`, `RoleplayResults` |
| **API** | `TranscriptThread`, `TranscriptMessage`, `TranscriptDivider` |
| **Verification** | Active roleplay chat; results conversation tab |
| **Effort** | M |
| **Risk** | Medium (streaming state in taking view) |

---

### P3.3 Extract team star map table components

| | |
|---|---|
| **Files** | From `TeamStarMapPage.tsx` to `components/teams/StarMapTable.tsx`, etc. |
| **Effort** | L |
| **Risk** | Medium |

---

## Priority 4 — CSS architecture (supporting only)

### P4.1 Fix CSS variable usage

Replace `hsl(var(--token))` with `var(--token)` where tokens are full hsl strings.

### P4.2 Remove dead Tailwind config tokens

Remove unused `--chart-*` and `--sidebar-*` references from `tailwind.config.ts`.

### P4.3 Introduce `NoticeBanner` (optional)

Map `--alert-*`, `--admin-banner-*`, `--rewards-banner-*` to a single component when a third consumer appears.

---

## Implementation order summary

```
P1.1 dead code removal
P1.2 DifficultyPill
P1.3 CardRibbon featured
P1.4 getStartAttemptLabel
P1.5 initialsFromUser
P2.1 HomeSidebarPanel
P2.2 ScenarioMetadataChips enhancement
P2.3 CategoryMasteryRow
— pause for review —
P3.x page decomposition (batch by page)
P4.x CSS cleanup
```

---

## Verification checklist (all items)

- [ ] `cd client && npm run typecheck`
- [ ] Visual spot-check affected routes in browser
- [ ] No new eslint/type errors in touched files
- [ ] Grep confirms no orphaned imports after deletions
