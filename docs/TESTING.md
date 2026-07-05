# Testing

API smoke tests cover all server endpoints using **Vitest** and **Supertest** against an in-process Express app with a real PostgreSQL database.

## Prerequisites

- Node.js 20+ and npm 10+
- **Docker** (for local test database on port `5434`)

CI uses a GitHub Actions Postgres service container — no Docker required in CI.

## Running tests

From the repository root:

```bash
npm run test
```

This script:

1. Starts `docker-compose.test.yml` (Postgres on `localhost:5434`)
2. Applies database migrations
3. Runs the Vitest suite
4. Tears down the test database container

### Other commands

| Command | Description |
|---------|-------------|
| `npm run test:watch` | Run tests in watch mode (requires test DB already running) |
| `npm run test:db:up` | Start test Postgres only |
| `npm run test:db:down` | Stop and remove test Postgres |
| `./bin/test.sh --keep-db` | Run tests without tearing down the DB afterward |

### Using an existing Postgres instance

Set `DATABASE_URL` (or `TEST_DATABASE_URL`) and skip Docker:

```bash
export SKIP_TEST_DOCKER=1
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/roleplay_app_test
npm run db:migrate --workspace=server
npm run test --workspace=server
```

## What is tested

- **Smoke coverage** for ~60 API endpoints: HTTP status codes, auth gates, and basic JSON response shape
- **Auth-negative cases**: protected routes return `401` without a token; admin-only routes return `403` for learners
- **LLM calls are mocked** — no real OpenAI/Anthropic/Google API keys needed
- **OIDC/SAML routes are excluded** — they require external identity providers and are marked `it.skip` in `auth.test.ts`

## Coverage inventory (v1)

This first iteration establishes infrastructure and smoke hits — not exhaustive edge-case coverage.

| Category | Detail |
|----------|--------|
| **Covered** | All six route modules (`health`, `auth`, `users`, `media`, `classifications`, `roleplay-config`, `roleplays`) with at least one authenticated smoke request per endpoint |
| **Skipped (6)** | OIDC/SAML routes in `auth.test.ts` (`it.skip`) — require external IdP |
| **Light coverage** | `POST /api/roleplays/import/preview` — missing-file `400` only, no zip upload |
| **Light coverage** | `GET /api/roleplays/:id/stream/:runId` — SSE headers/connection only |
| **Light coverage** | Auth-negative `401`/`403` — spot-checked per module, not every endpoint × role |

Future iterations can add deeper contract tests, zip import fixtures, OIDC/SAML mock IdP flows, and a real LLM integration suite.

## Test layout

```
server/test/
├── api/                  # One test file per route module
├── helpers/              # Auth, fixtures, request wrapper
├── mocks/                # LLM and model-catalog mocks
├── env.ts                # Test environment variables
├── setup.ts              # DB init + reset between files
└── global-setup.ts       # Docker Postgres lifecycle (local only)
```

## Adding a new endpoint

1. Add a row to the table-driven test array in the relevant `server/test/api/*.test.ts` file
2. If the endpoint needs fixtures, extend `server/test/helpers/fixtures.ts`
3. Run `npm run test` locally before pushing

## CI

The `api-tests` job in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs on every pull request and push to `main`, in parallel with typecheck, migrations, and Docker build.

Tagged releases ([`.github/workflows/release.yml`](../.github/workflows/release.yml)) also run API tests before publishing Docker images or creating a GitHub Release.

### Branch protection

After merging, enable **API tests** as a required status check on `main` in GitHub repository settings (Settings → Branches → Branch protection rules). This ensures the CI gate is enforced, not advisory.
