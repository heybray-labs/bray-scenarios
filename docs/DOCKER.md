# Docker deployment

Production-like Docker Compose stack: **Postgres** + **single app container** serving the built React SPA and API on one port (`3001`).

## Quick start (no clone)

Requires Docker and Docker Compose. Pulls the published image from GHCR (must be public — see [RELEASING.md](RELEASING.md)).

```bash
curl -fsSL https://raw.githubusercontent.com/heybray-labs/bray-scenarios/main/bin/quickstart.sh | bash
```

### Interactive wizard

Requires a terminal (TTY). Prompts for port, `APP_URL`, auth mode (local / OIDC / SAML), and related settings. LLM keys are configured later in the admin UI at `/settings/ai`.

```bash
curl -fsSL https://raw.githubusercontent.com/heybray-labs/bray-scenarios/main/bin/quickstart.sh | bash -s -- --interactive
```

From a clone: `npm run quickstart:interactive`

The wizard asks for an **instance prefix** first (optional — press Enter to install in the current directory, or enter a name to create a subdirectory and isolate Docker resources). Fresh installs default to no prefix (a stale `APP_INSTANCE_PREFIX` in your shell is ignored). Re-running `--interactive --reconfigure` from inside an install directory locks the prefix from `.env`.

Re-run the wizard on an existing install (overwrites `.env`):

```bash
./bin/quickstart.sh --interactive --reconfigure
```

**SAML note:** the wizard sets `AUTH_PROTOCOL=saml` and `APP_URL`, then prints a checklist for tunnel setup, Google Admin configuration, and `SAML_IDP_METADATA`. Full steps are in [AUTHENTICATION.md](AUTHENTICATION.md).

Installs into the current working directory. On first silent run, copies `.env.docker.example` to `.env`, injects a generated `JWT_SECRET`, and does not overwrite `.env` on subsequent runs unless `--reconfigure` is used. With `APP_INSTANCE_PREFIX`, files go in a subdirectory of the current directory.

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `3001` | Host port for the app |
| `APP_INSTANCE_PREFIX` | (unset) | Optional prefix — isolates Docker project/volumes; quickstart creates `{prefix}/` in the current directory |
| `BRAY_IMAGE_TAG` | latest GitHub release (e.g. `1.1.0`) | Docker image tag to pull |
| `BRAY_SCRIPTS_REF` | latest GitHub release (e.g. `v1.1.0`) | Git ref for install scripts and compose file (advanced) |
| `BRAY_VERSION` | (derived from `BRAY_IMAGE_TAG`) | Alias for pinning the Docker image tag (e.g. `v1.0.7` → image `1.0.7`) |

By default the script resolves the latest GitHub release for install scripts and the Docker image. Pinning `BRAY_IMAGE_TAG` does not change which scripts are downloaded — use `BRAY_SCRIPTS_REF` to pin those too.

```bash
# Pin a specific Docker image (install scripts still come from the latest release)
BRAY_IMAGE_TAG=1.0.7 curl -fsSL https://raw.githubusercontent.com/heybray-labs/bray-scenarios/main/bin/quickstart.sh | bash

# Lifecycle (run from the directory where quickstart was executed)
./compose-env.sh --env-file .env -- docker compose -f docker-compose.quickstart.yml logs -f app
./compose-env.sh --env-file .env -- docker compose -f docker-compose.quickstart.yml down
./compose-env.sh --env-file .env -- docker compose -f docker-compose.quickstart.yml down -v   # reset database
```

Open [http://localhost:3001](http://localhost:3001). On first visit to `/login`, create the administrator account, then configure LLM keys at `/settings/ai`.

To enable SSO, edit `.env` in the install directory (set `AUTH_PROTOCOL` and OIDC/SAML variables), then run `./compose-env.sh --env-file .env -- docker compose -f docker-compose.quickstart.yml up -d`. See [AUTHENTICATION.md](AUTHENTICATION.md).

## Running multiple instances

Use `APP_INSTANCE_PREFIX` to isolate Docker volumes, networks, and containers on one host. Set `PORT` and `APP_URL` manually for each instance — ports are not auto-derived from the prefix.

### Second quickstart instance

```bash
# From the directory where you want demo2/ created:
APP_INSTANCE_PREFIX=demo2 PORT=3002 curl -fsSL https://raw.githubusercontent.com/heybray-labs/bray-scenarios/main/bin/quickstart.sh | bash
# Creates ./demo2/ with compose-env.sh, docker-compose.quickstart.yml, and .env
# Compose project: bray-scenarios-demo2 — edit demo2/.env if APP_URL needs updating
```

### Second clone-docker instance

```bash
# In .env:
# APP_INSTANCE_PREFIX=dev2
# PORT=3011
# POSTGRES_PORT=5441
# APP_URL=http://localhost:3011

npm run docker:up
```

Use `./bin/compose-env.sh -- docker compose ...` for manual compose commands when a prefix is set (clone-docker and quickstart installs both persist `APP_INSTANCE_PREFIX` in `.env`).

### Native dev (no Docker)

Set ports in `.env` and run `npm run dev`:

```bash
# PORT=3011
# VITE_PORT=5183
# APP_URL=http://localhost:5183
```

## Quick start (from clone)

```bash
cp .env.docker.example .env
# Edit JWT_SECRET (required). Set AUTH_PROTOCOL and SSO vars if needed.

docker compose up --build
# or: npm run docker:up
```

Open [http://localhost:3001](http://localhost:3001).

On first visit to `/login`, create the administrator account, or set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env` before starting.

## Architecture

| Service | Role |
|---------|------|
| `db` | PostgreSQL 16 with persistent `pgdata` volume |
| `app` | Express API + static SPA from `client/dist` |

The app container:

1. Waits for Postgres to accept connections
2. Runs `initializeDatabase()` on startup (schema push + role seed)
3. Listens on `PORT` (default `3001`)

## Environment variables

Copy [`.env.docker.example`](../.env.docker.example) to `.env`. Compose loads `.env` for variable substitution and passes it to the app via `env_file`.

Important Docker-specific values:

| Variable | Docker value |
|----------|----------------|
| `DATABASE_URL` | `postgresql://postgres:postgres@db:5432/roleplay_app` (overridden in compose) |
| `APP_URL` | `http://localhost:3001` — must match the URL users open in the browser |
| `SAML_SP_CERT_DIR` | `/app/data/saml` — mounted volume for stable SAML certificates |
| `MEDIA_DIR` | `/app/data/media` — mounted `media_data` volume for scenario cover images |

`docker-compose.yml` overrides `DATABASE_URL` and `PORT` so a local-dev `.env` with `localhost` does not break the container.

## SSO in Docker

Docker serves frontend and API on the **same origin** (`APP_URL`). SSO redirect/callback URLs are derived from `APP_URL`:

| Protocol | Callback / ACS URL |
|----------|-------------------|
| OIDC | `{APP_URL}/api/auth/oidc/callback` |
| SAML ACS | `{APP_URL}/api/auth/saml/acs` |
| SAML metadata | `{APP_URL}/api/auth/saml/metadata` |

Set `OIDC_REDIRECT_URI`, `SAML_ACS_URL`, or `SAML_SP_ENTITY_ID` explicitly if your IdP requires fixed values.

### OIDC (Microsoft Entra ID, Okta)

1. Set `AUTH_PROTOCOL=oidc` and OIDC variables in `.env`.
2. Set `APP_URL` to the URL users use (e.g. `http://localhost:3001` for local Docker).
3. Register redirect URI: `{APP_URL}/api/auth/oidc/callback` in your IdP.
4. Restart: `docker compose up --build`.

### SAML (Google Workspace)

Google SAML requires **HTTPS**. For local Docker:

1. Run a tunnel (e.g. [ngrok](https://ngrok.com/)) to port `3001`:
   ```bash
   ngrok http 3001
   ```
2. Set `APP_URL` to the tunnel HTTPS URL (e.g. `https://abc123.ngrok-free.app`).
3. Set `AUTH_PROTOCOL=saml` and `SAML_IDP_METADATA` (and other SAML vars). See [AUTHENTICATION.md](../AUTHENTICATION.md).
4. In Google Admin, set ACS URL and Entity ID to match `APP_URL` paths above.
5. SAML SP certificates are stored in the `saml_certs` volume — they persist across `docker compose down` / `up` so metadata stays stable.
6. Scenario cover images are stored in the `media_data` volume (`MEDIA_DIR=/app/data/media`) — they persist across container rebuilds.

### Checklist before enabling SSO

- [ ] `APP_URL` matches the browser URL exactly (scheme, host, port)
- [ ] IdP redirect URI / ACS URL registered to match `APP_URL`
- [ ] For SAML: HTTPS tunnel in place; Google Admin updated if tunnel URL changes
- [ ] `JWT_SECRET` set to a strong random value

## Commands

```bash
npm run docker:up      # build and start (uses bin/compose-env.sh)
docker compose up -d   # detached (use compose-env.sh when APP_INSTANCE_PREFIX is set)
npm run docker:down    # stop and remove containers (volumes kept)
npm run docker:logs    # follow app logs
docker compose down -v # also remove pgdata, saml_certs, and media_data volumes
```

For in-place upgrades that preserve data, see [UPGRADING.md](UPGRADING.md).

## Health check

```bash
curl http://localhost:3001/api/health
# {"status":"ok"}
```

## Troubleshooting

**App exits on startup** — Check logs: `docker compose logs app`. Often Postgres not ready (entrypoint retries) or invalid `DATABASE_URL`.

**SSO redirect mismatch** — `APP_URL` must match what the browser shows. Update IdP redirect URIs when you change ports or tunnels.

**SAML cert changed after rebuild** — Ensure `saml_certs` volume is mounted (`docker volume ls`). Do not run `docker compose down -v` unless you intend to reset certs and re-register with Google Admin.

**Blank page on refresh** — SPA fallback is served by Express when `client/dist` exists in the image. Rebuild: `docker compose up --build`.

For full auth setup (IdP configuration, Google Workspace, ngrok details), see [AUTHENTICATION.md](../AUTHENTICATION.md).
