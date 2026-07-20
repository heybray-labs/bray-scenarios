# @heybray/scenarios-server

## 0.2.0

### Minor Changes

- b50d162: Add typed `ScenariosServerDeps` strategy injection for grader, coach, and scorer with byte-identical defaults when deps are omitted.

## 0.1.7

### Patch Changes

- 7ff97b3: Publish demo seed cover image generation: pastel Lucide PNG covers at seed time, distinct `originalFilename` per scenario, and stable `demo-cover-{slug}.png` storage keys.

## 0.1.6

### Patch Changes

- eb617dc: Enforce publish eligibility against the admin model allowlist; seed demo AI allowlist defaults; fix card publish/unpublish UX and browse cache updates; add API coverage for configured-but-unallowlisted drafts.

## 0.1.5

### Patch Changes

- feb67d2: Demo seed/wipe tooling: generated Lucide cover images, configurable seed counts, exported `wipeDemo`, `DEMO_TITLE_PREFIX`, and `renderCoverImageFromArt`.
- Block publishing scenarios without persona and grader AI configured; surface publish failures via client error toasts.

## 0.1.4

### Patch Changes

- 8f213fb: Demo seed/wipe tooling: generated Lucide cover images, configurable seed counts, exported `wipeDemo`, `DEMO_TITLE_PREFIX`, and `renderCoverImageFromArt`.

## 0.1.3

### Patch Changes

- Add demo seed/wipe API: `wipeDemo`, `SeedDemoCounts`, `DEMO_TITLE_PREFIX`, `renderCoverImageFromArt`, and generated Lucide PNG covers (no `examples/` dependency).
- Rename shell commands to `db:demo-seed`, `db:demo-wipe`, `db:docker:demo-seed`, `db:docker:demo-wipe`, and `db:docker:wipe`.

## 0.1.2

### Patch Changes

- 217636e: Export `registerDomainRoutes()` for composed shells and star-map drill-in handler functions via `@heybray/scenarios-server/team-star-map`.

## 0.1.0

### Minor Changes

- Initial publish of mountable Scenarios feature packages (Phase 6A Step 3).
