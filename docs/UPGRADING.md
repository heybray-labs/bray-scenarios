# Upgrading

This guide covers in-place upgrades that preserve your database and configuration.

## How upgrades work

On every container start, the app:

1. Runs pending SQL migrations from `server/drizzle/` (versioned, committed with each release)
2. Runs idempotent seeding (roles, taxonomy — does not overwrite your data)

Schema changes ship inside the Docker image. You do not run migrations manually unless developing locally.

## Quickstart installs (published GHCR image)

Run these commands from the directory where quickstart created your install files (where `.env` and `docker-compose.quickstart.yml` live).

### 1. Back up the database (recommended for production)

```bash
./upgrade-backup.sh
```

Writes `backup-YYYY-MM-DD.sql` in the current directory. Pass a custom path if you prefer:

```bash
./upgrade-backup.sh backups/before-upgrade.sql
```

### 2. Upgrade to the target version

Re-run quickstart with the release pinned. This pulls the new image and restarts the app (migrations run on start):

```bash
BRAY_IMAGE_TAG=1.0.8 curl -fsSL https://raw.githubusercontent.com/heybray-labs/bray-scenarios/main/bin/quickstart.sh | bash
```

Existing `.env` is preserved unless you pass `--interactive --reconfigure`.

### 3. Verify

```bash
./upgrade-verify.sh
```

Expected output on success:

```
Checking app logs...
  OK: migrations complete
Checking http://localhost:3001/api/health...
  OK: {"status":"ok"}
Checking http://localhost:3001/api/about...
  OK: {"version":"1.0.8","authProtocol":"local","authProtocolLabel":"Local sign-in"}
Upgrade verified.
```

The version and `authProtocol` values depend on your release and `.env`. If migrations ran on an earlier restart, you may see `OK: server listening` instead of `OK: migrations complete` — that is also fine.

On failure the script prints `FAIL:` lines and exits with a non-zero status.

## Clone + Docker installs

From the repository root:

### 1. Back up the database (recommended for production)

```bash
npm run upgrade:backup
```

### 2. Upgrade to the target version

```bash
git pull
cp .env .env.backup   # optional safety copy

# Pin version by checking out a release tag, or stay on main for latest
git checkout v1.0.8

docker compose pull    # if using a published image
docker compose up --build -d
```

Or use the npm script:

```bash
npm run docker:up
```

### 3. Verify

```bash
npm run upgrade:verify
```

Expected output is the same as for quickstart installs (see above).

## Local development (no Docker)

After pulling schema changes:

```bash
npm install
npm run db:migrate    # apply pending migrations
npm run dev
```

Or use the all-in-one init (migrate + seed):

```bash
npm run db:init
```

## Rollback

Deploy the previous image tag:

```bash
BRAY_IMAGE_TAG=1.0.7 curl -fsSL https://raw.githubusercontent.com/heybray-labs/bray-scenarios/main/bin/quickstart.sh | bash
```

Migrations are forward-only. Rolling back the app does not undo database changes. If a migration caused problems, restore from your backup:

```bash
./compose-env.sh --env-file .env -- docker compose -f docker-compose.quickstart.yml exec -T db \
  psql -U postgres -d roleplay_app < backup-YYYY-MM-DD.sql
```

## Full reset (destroys all data)

To wipe the database and start fresh:

```bash
./compose-env.sh --env-file .env -- docker compose -f docker-compose.quickstart.yml down -v
./compose-env.sh --env-file .env -- docker compose -f docker-compose.quickstart.yml up -d
```

## Developer workflow for schema changes

When changing tables in `shared/schemas/`:

1. Edit the schema TypeScript files
2. Generate a migration: `npm run db:generate`
3. Review the SQL in `server/drizzle/` (watch for accidental `DROP COLUMN`)
4. Test locally: `npm run db:migrate`
5. Commit the migration files with your code change
6. Release via [RELEASING.md](RELEASING.md) — migrations are included in the image

**Production and Docker** apply migrations automatically on startup via [`server/init-db/run-migrations.ts`](../server/init-db/run-migrations.ts). **Local dev** uses `db:generate` + `db:migrate`, or `db:init` (same programmatic migrator plus seed). `npm run db:push` is a dev-only escape hatch for quick schema experiments — do not use it for releases.

**Platform package updates:** since Phase 4, generic platform code lives in published `@heybray/*` npm packages (see `heybray-labs/bray-platform`), not in this repo. A platform-only bugfix arrives here as a version-bump PR — update the pinned ranges in `client/package.json` and/or `server/package.json`, run `npm install`, and restart. No Scenarios source edit is required unless the app wires new APIs.

For destructive changes (column renames, data moves), write a multi-step migration in one PR: add new column → backfill data → drop old column.

## Upgrading from pre-migration releases

Releases before versioned migrations used `drizzle-kit push` on startup. The first upgrade to a migration-based release:

- Detects an existing database and stamps the baseline migration as already applied
- Runs only incremental migrations (e.g. legacy column cleanup)

No manual steps are required for typical installs.
