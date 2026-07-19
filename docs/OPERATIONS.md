# Runtime behavior (operations)

Current defaults for cross-cutting server and client behavior inherited from
`@heybray/server-kit` and `@heybray/react`. Override via environment variables or
per-query React Query options where noted.

## Rate limiting

The global Express rate limiter (mounted first in the middleware stack) defaults to
**2000 requests per client per 15 minutes** when `RATE_LIMIT_MAX` is unset. Override with
`RATE_LIMIT_MAX` in `.env`. Authenticated routes use a separate auth limiter
(`AUTH_RATE_LIMIT_MAX`, default **20** per window).

When a client exceeds the limit, the server responds with **429** and logs the event
(path, key type, count, limit). Standard `RateLimit-*` response headers reflect the
configured limit.

## React Query defaults

The shared `queryClient` from `@heybray/react` sets:

| Option | Default | Effect |
|--------|---------|--------|
| `staleTime` | **30 seconds** | Remounts within 30s reuse cached data unless a query opts out |
| `retry` | **false** | Failed queries (including 401/429) are not auto-retried |
| `refetchOnWindowFocus` | **false** | Focus changes do not refetch |
| `refetchOnReconnect` | **false** | Network reconnect does not refetch stale queries |

Per-query overrides are appropriate when a screen needs fresher data (e.g. long-lived
config with explicit `staleTime`).

## Session expiry (401 handling)

When an API call returns **401**, the shared client treats it as session expiry:

- A **single-flight latch** ensures only **one** redirect to `/login` runs even when many
  queries fail concurrently.
- The latch resets on successful login, registration, setup, or SSO completion
  (`resetSessionExpiryLatch()`).

Protected routes still return 401 individually; the latch only coordinates client-side
navigation.
