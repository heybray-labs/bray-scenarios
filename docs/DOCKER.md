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

Re-run the wizard on an existing install (overwrites `.env`):

```bash
./bin/quickstart.sh --interactive --reconfigure
```

**SAML note:** the wizard sets `AUTH_PROTOCOL=saml` and `APP_URL`, then prints a checklist for tunnel setup, Google Admin configuration, and `SAML_IDP_METADATA`. Full steps are in [AUTHENTICATION.md](AUTHENTICATION.md).

Installs to `~/.bray-scenarios/` (override with `BRAY_SCENARIOS_HOME`). On first silent run, copies `.env.docker.example` to `.env`, injects a generated `JWT_SECRET`, and does not overwrite `.env` on subsequent runs unless `--reconfigure` is used.

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `3001` | Host port for the app |
| `BRAY_IMAGE_TAG` | latest GitHub release (e.g. `1.0.2`) | Docker image tag to pull |
| `BRAY_VERSION` | latest GitHub release tag (e.g. `v1.0.2`) | Git ref for the compose file |
| `BRAY_SCENARIOS_HOME` | `~/.bray-scenarios` | Install directory |

By default the script resolves the latest GitHub release tag for both the compose file and Docker image.

```bash
# Pin a specific version
BRAY_IMAGE_TAG=1.0.2 curl -fsSL https://raw.githubusercontent.com/heybray-labs/bray-scenarios/main/bin/quickstart.sh | bash

# Lifecycle
cd ~/.bray-scenarios
docker compose -p bray-scenarios-quickstart -f docker-compose.quickstart.yml logs -f app
docker compose -p bray-scenarios-quickstart -f docker-compose.quickstart.yml down
docker compose -p bray-scenarios-quickstart -f docker-compose.quickstart.yml down -v   # reset database
```

Open [http://localhost:3001](http://localhost:3001). On first visit to `/login`, create the administrator account, then configure LLM keys at `/settings/ai`.

To enable SSO, edit `~/.bray-scenarios/.env` (set `AUTH_PROTOCOL` and OIDC/SAML variables), then run `docker compose -p bray-scenarios-quickstart -f docker-compose.quickstart.yml up -d`. See [AUTHENTICATION.md](AUTHENTICATION.md).

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

### Checklist before enabling SSO

- [ ] `APP_URL` matches the browser URL exactly (scheme, host, port)
- [ ] IdP redirect URI / ACS URL registered to match `APP_URL`
- [ ] For SAML: HTTPS tunnel in place; Google Admin updated if tunnel URL changes
- [ ] `JWT_SECRET` set to a strong random value

## Commands

```bash
npm run docker:up      # build and start in foreground
docker compose up -d # detached
npm run docker:down  # stop and remove containers (volumes kept)
docker compose down -v  # also remove pgdata and saml_certs volumes
```

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
