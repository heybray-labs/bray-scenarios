# Bray Scenarios

[CI](https://github.com/heybray-labs/bray-scenarios/actions/workflows/ci.yml)

Bray Scenarios is an open-source AI roleplay training app for practicing real-world conversations with a simulated persona and receiving rubric-based feedback. It is a standalone deployment of the roleplay feature from the Bray platform, with a focused learner and admin experience.

## Key features

- **📇 Scenario authoring** — Create training scenarios with persona, rubric, and settings
- **💬 Live roleplay sessions** — Learners move through intro → streaming chat → graded results
- **🤖 LLM configuration** — Admins configure OpenAI, Anthropic, and Google models using your own API keys
- **🔒 Identity provider integration** — Local email/password, OIDC (Microsoft Entra ID, Okta), or SAML (Google Workspace)
- **🐳 Docker deployment** — Production-like Compose stack with PostgreSQL and a single container serving API and frontend

## Installation and Launch

### Option 1: 🚀 Quickstart (download and launch Docker image in one command) 

This will fetch and launch the latest public Docker image without downloading the codebase. You will need Docker and Docker Compose installed.

Run from the directory where you want the install files created:

```bash
curl -fsSL https://raw.githubusercontent.com/heybray-labs/bray-scenarios/main/bin/quickstart.sh | bash
```

Or, for a guided setup (port, instance prefix, auth mode, OIDC settings), run interactively in a terminal:

```bash
curl -fsSL https://raw.githubusercontent.com/heybray-labs/bray-scenarios/main/bin/quickstart.sh | bash -s -- --interactive
```

#### Environment variables
Can be passed on the command line before `curl` (and are asked for explicitly in interactive mode):

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `3001` | Host port for the app |
| `APP_INSTANCE_PREFIX` | (unset) | Isolates Docker project/volumes; creates `{prefix}/` in the current directory |
| `BRAY_IMAGE_TAG` | latest GitHub release (e.g. `1.1.0`) | Docker image tag to pull |
| `BRAY_SCRIPTS_REF` | latest GitHub release (e.g. `v1.1.0`) | Git ref for install scripts and compose file (advanced) |

Examples:

```bash
# Custom port
PORT=3002 curl -fsSL https://raw.githubusercontent.com/heybray-labs/bray-scenarios/main/bin/quickstart.sh | bash

# Pin a specific Docker image (install scripts still come from the latest release)
BRAY_IMAGE_TAG=1.0.7 curl -fsSL https://raw.githubusercontent.com/heybray-labs/bray-scenarios/main/bin/quickstart.sh | bash

# Second instance on the same host (creates ./demo2/)
APP_INSTANCE_PREFIX=demo2 PORT=3002 curl -fsSL https://raw.githubusercontent.com/heybray-labs/bray-scenarios/main/bin/quickstart.sh | bash
```
#### What gets created?
The script writes into the **current working directory**:

- `.env` — configuration (generated on first run; not overwritten on later runs)
- `compose-env.sh` — helper for Docker Compose commands
- `docker-compose.quickstart.yml` — Compose stack definition
- `upgrade-backup.sh` — database backup before an in-place upgrade
- `upgrade-verify.sh` — confirm migrations and API health after an upgrade

With `APP_INSTANCE_PREFIX`, a subdirectory is created first (e.g. `./demo2/`) and files go inside it.

See [docs/DOCKER.md](docs/DOCKER.md) for stop, logs, reset, SSO setup, and [running multiple instances](docs/DOCKER.md#running-multiple-instances) on one host.

### Option 2: 💻 Clone from GitHub and run locally (use this if you don't have docker, or you want to extend the codebase) 

This requires Node.js 20+, npm 10+, and Docker (Postgres is started automatically by `npm run dev`).

```bash
git clone https://github.com/heybray-labs/bray-scenarios.git
cd bray-scenarios

cp .env.example .env
# Edit DATABASE_URL and JWT_SECRET

npm install
npm run dev        # starts Postgres, migrates, API on :3001, client on :5173
npm run test       # optional: API smoke tests (requires Docker)
```

`npm run launch:local` is a backward-compat alias for the same command.

### Option 3: Clone from GitHub -> Docker 🐳
This will download the full codebase to your local machine, builds the docker container locally and then spins up with the same docker compose as #1.  Use this is you want to customize or otherwise extend the application. 

```bash
git clone https://github.com/heybray-labs/bray-scenarios.git
cd bray-scenarios

cp .env.docker.example .env
# Edit JWT_SECRET (required)

docker compose up --build
# open http://localhost:3001
```

See [docs/DOCKER.md](docs/DOCKER.md) for SSO, volumes, troubleshooting, [upgrading](docs/UPGRADING.md), and running multiple instances on one host.

Versioned images are published to `ghcr.io/heybray-labs/bray-scenarios` on each tagged release — see [docs/RELEASING.md](docs/RELEASING.md).

## Configuration

In each of the above cases, you'll end up with the app running on http://localhost:3000.  To get started:

1. Point your browser to `http://localhost:3001`
2. Create the Administrator account by filling in the registration form
3. Configure LLM keys under "⚙️ Settings -> AI",
4. Setup your Users under "⚙️ Settings -> Users". If you want to use SSO, then you'll need to first edit `.env` — see [docs/AUTHENTICATION.md](docs/AUTHENTICATION.md).

Environment variables are documented in [.env.example](.env.example) and [.env.docker.example](.env.docker.example).

For authentication setup (IdP configuration, redirect URIs, Google Workspace SAML), see [AUTHENTICATION.md](AUTHENTICATION.md).

## Upgrading

See [docs/UPGRADING.md](docs/UPGRADING.md).

## Operations

See [docs/OPERATIONS.md](docs/OPERATIONS.md) for rate limiting, React Query defaults, and
session-expiry behavior.

## Testing

See [docs/TESTING.md](docs/TESTING.md) for running API smoke tests locally and in CI.

## Project structure

```
bray-scenarios/
├── client/     React + Vite frontend
├── server/     Express + Drizzle + LangChain backend
├── shared/     Drizzle schemas
├── docker/     Container entrypoint
└── bin/        Dev and upgrade scripts
```

## License

See [LICENSE](LICENSE).