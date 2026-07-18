# UI patterns and component guidelines

Conventions for the `client/` app. See also [UI audit](./ui-audit.md) and [refactor plan](./ui-refactor-plan.md).

## Layering

| Layer | Location | Responsibility |
|-------|----------|----------------|
| Primitives | `components/ui/*` | shadcn/Radix building blocks — no domain logic |
| Domain | `components/{feature}/*` | Reusable feature UI (roleplays, points, teams, …) |
| Pages | `pages/*` | Routing, data fetching, composition only |
| Helpers | `lib/*` | Pure functions — formatters, display logic, label copy |

**Rule:** If markup appears in two or more places, extract to domain or `ui/` before copying a third time.

**Rule:** Pages over ~300 lines with local components should move those components into `components/{feature}/`.

## When to use each layer

### `ui/*` primitives

Use for generic, design-system-level elements: buttons, inputs, dialogs, badges, cards.

Extend via CVA variants (see `components/ui/button.tsx`). Do not add domain-specific props to `ui/*` files.

### Domain components

Use for feature-specific UI that may compose multiple primitives:

- `ScenarioBrowseCard` — browse grid tile
- `LeaderboardPanel` — home sidebar leaderboard
- `ClassificationChip` — taxonomy pill with icon and color

Place by feature folder: `roleplays/`, `points/`, `teams/`, `classifications/`, `errors/`.

### Page composition

Pages should:

1. Fetch data (React Query hooks)
2. Handle route params and navigation
3. Compose domain components

Avoid inline JSX blocks longer than ~40 lines. Extract to domain components.

## Shared primitives (use these)

| Primitive | Path | Use for |
|-----------|------|---------|
| `ClassificationChip` | `classifications/ClassificationChip` | Category, audience, duration, tag pills |
| `DifficultyPill` | `classifications/DifficultyPill` | Difficulty and status-colored pills |
| `ScenarioMetadataChips` | `roleplays/scenario-detail/ScenarioMetadataChips` | Metadata chip rows |
| `CardRibbon` | `roleplays/CardRibbon` | Corner ribbons on browse/cover cards |
| `ScenarioCover` | `roleplays/ScenarioCover` | Authenticated cover image + overlays |
| `TierStars` | `points/TierStars` | Star tier glyphs |
| `CategoryMasteryBar` | `points/CategoryMasteryBar` | Tier-segment progress bar |
| `CategoryMasteryRow` | `points/CategoryMasteryRow` | Label + bar + count row |
| `HomeSidebarPanel` | `points/HomeSidebarPanel` | Home sidebar card shell |
| `TranscriptThread` | `roleplays/transcript/TranscriptThread` | Chat transcript in taking + results |
| `StagePanel`, `FieldBlock`, `ResultsRevealHero` | `roleplays/results/*` | Results page sections |
| `StarMapTable`, `StarMapSummaryCards` | `teams/*` | Team star map page |
| `NoticeBanner` | `ui/NoticeBanner` | Alert, admin, timer, rewards notice surfaces |

## Styling conventions

### Tailwind + `cn()`

- Merge classes with `cn()` from `@/lib/utils`.
- Prefer semantic tokens (`text-muted-foreground`, `bg-card`) over raw colors.
- Default palette + gamification tokens ship in `@heybray/ui/theme-default.css` (import in app CSS). App-specific extras stay in local `index.css`; use via `var(--*)` or helpers in `classification-display.ts`.

### CVA variants

New primitives with 2+ visual variants should use `class-variance-authority`:

```tsx
const pillVariants = cva("inline-flex items-center rounded-full border …", {
  variants: {
    variant: { inline: "…", overlay: "…" },
  },
  defaultVariants: { variant: "inline" },
});
```

### Style helpers vs components

- `lib/classification-display.ts` — color lookup, icon resolution, style objects.
- Components — markup and composition. Prefer a component over copying pill markup + `style={…}` at call sites.

### CSS variables

Tokens in `index.css` are full `hsl(...)` values. Use `var(--token)` directly — not `hsl(var(--token))`.

## Extract when / don't extract when

### Extract when

- Same JSX structure appears in 2+ files with only data/props differing
- A page-local component exceeds ~80 lines and has a clear single responsibility
- Styling drift is visible (same pill with different `px-2` vs `px-2.5`)

### Don't extract when

- Components look similar but serve different layout contracts (browse card vs cinema hero vs dossier section)
- Metrics or APIs differ fundamentally (global points leaderboard vs scenario best-score)
- Extraction would require 5+ variant props to preserve behavior — keep separate instead
- One-off admin or edge-screen UI with no second consumer

## Naming and file placement

- **Components:** PascalCase, named exports, one primary component per file.
- **Folders:** Group by feature, not by component type. Scenario detail lives under `roleplays/scenario-detail/`.
- **Helpers:** camelCase functions in `lib/`, suffixed by concern (`*-display.ts`, `*-display.ts`).
- **Types:** Co-locate with the component or in a nearby `types.ts` (see `scenario-detail/types.ts`).

## Visual-preservation rule

Structural refactors must be **behavior- and pixel-preserving** unless the task explicitly includes visual changes.

When extracting:

1. Copy exact class strings for the first migration
2. Pass layout differences via `className` prop, not by changing defaults
3. Spot-check affected routes in the browser before merging

## Anti-patterns (avoid)

- Copying pill markup instead of using `ClassificationChip` or `DifficultyPill`
- Hardcoding corner ribbons instead of `CardRibbon`
- Inline `initials` logic — use `initialsFromName` or `initialsFromUser`
- Duplicating attempt CTA copy — use `getStartAttemptLabel`
- Inline `var(--alert-*)` / `var(--admin-banner-*)` strips — use `NoticeBanner`
- Adding new globals to `index.css` when a component variant would suffice
- Putting domain logic in `ui/*` primitives

## Adding new UI

1. Check existing primitives and domain components first (table above).
2. If extending an existing component fits, add a variant — don't fork.
3. Place in the correct feature folder.
4. Keep pages thin — compose, don't implement.
5. Run `npm run typecheck` in `client/`.
