# Phase 4 verification record

Recorded after Part B Steps 9–12 (2026-07-15).

## Published packages (npm registry)

All 10 `@heybray/*` packages published from `heybray-labs/bray-platform`:

| Package | Latest | Notes |
|---|---|---|
| `@heybray/server-kit` | 0.1.2 | includes `getAppVersion(path)` fix |
| all other 9 packages | 0.1.1 | initial public release follow-up |

## Part B Step 9 — dry-run verification

Scratch `npm install` of all 10 packages at published versions; trivial TypeScript usage typechecked clean.

## Part B Step 10 — cutover

- `packages/` removed; workspaces = `["client", "server"]`
- `@heybray/*` pinned in `client/package.json` / `server/package.json`, resolved from npm
- `Dockerfile` no longer copies `packages/`
- `server/drizzle-packages-schema.ts` re-exports published package schemas for drizzle-kit
- `openai` kept in `server/package.json` — used directly by `agent-model-catalog.service.ts` for model listing (not via `@heybray/llm`)

## Part B Step 12 — final verification

```bash
npm install          # OK — resolves @heybray/* from registry
npm run typecheck    # OK
npm run build --workspace=client  # OK
npm test             # OK — 140 passed, 6 skipped
docker build -t scenarios-test .  # OK — no packages/ in build context
```

Fresh clone (`git clone` + `npm ci` + `npm run typecheck`): OK — `@heybray/*` hoisted from npm, no workspace symlinks.

## Patch-release round trip

Exercised end-to-end via the real `getAppVersion()` bug discovered during cutover:

1. **bray-platform:** fix landed in `@heybray/server-kit@0.1.2` (published manually with automation token; CI publish still returns misleading E404)
2. **bray-scenarios:** bumped `server/package.json` to `^0.1.2`, `npm install`, updated `getAppVersion(rootPackageJson)` call site
3. **Verified:** `/api/about` returns version; full test suite green

No Scenarios source change beyond the version bump and the one call-site fix was required for the platform-side bugfix to take effect.
