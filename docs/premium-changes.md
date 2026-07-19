# Premium integration notes

Raw discovery notes from composing `bray-premium` with `@heybray/scenarios-*` and `@heybray/flashcards-*`. Triage completed 2026-07-19; deferred items live in [`premium-backlog-6b.md`](./premium-backlog-6b.md).

## Fixed in 6A closeout

| Item | Fix |
|---|---|
| Demo seed: no flashcard points/sessions | `bray-premium/server/demo-seed.ts` — completed study sessions + `recordResult` for demo decks |
| Leaderboard global scope mixes apps | Platform `contentType` filter on global leaderboard; Premium tabs pass `scenario` / `deck` |
| Publish scenario fails silently (AI not set) | Server rejects publish without persona+grader models and without allowlisted models; client toasts; card menu direct API; browse `canPublish` aligned with allowlist; demo seed adds `gpt-4o-mini` to allowlist |
| Points history deep links broken in Premium | History API returns `contentType` per row; dialog links per activity type |

## Deferred to 6B+

See [`premium-backlog-6b.md`](./premium-backlog-6b.md):

- Bulk assign AIs across activities
- Disable/inactive user + retain score options
- Pro media settings/browser
- Premium activity-type features (dangerous-failure warnings, participant flags)
- Optional continue after max attempts + admin attempt management
- Assign activities to users
- Points dialog visual redesign (beyond link fix)
- Rate-limit IP allowlist / VPN
- Scenario home headers / drawer prominence (polish)
