# Bray Scenarios

[![CI](https://github.com/heybray-labs/bray-scenarios/actions/workflows/ci.yml/badge.svg)](https://github.com/heybray-labs/bray-scenarios/actions/workflows/ci.yml)

Bray Scenarios is an open-source AI roleplay training app for practicing real-world conversations with a simulated persona and receiving rubric-based feedback. It is a standalone deployment of the roleplay feature from the Bray platform, with a focused learner and admin experience.

## Key features

- **Scenario authoring** — Create training scenarios with persona, rubric, and settings
- **Live roleplay sessions** — Learners move through intro → streaming chat → graded results
- **LLM configuration** — Admins configure OpenAI, Anthropic, and Google models at `/settings/ai`
- **Identity provider integration** — Local email/password, OIDC (Microsoft Entra ID, Okta), or SAML (Google Workspace)
- **Docker deployment** — Production-like Compose stack with PostgreSQL and a single container serving API and frontend

## Installation

### Option 1: Clone from GitHub and run locally

**Prerequisites:** Node.js 20+, npm 10+, and PostgreSQL

```bash
git clone https://github.com/heybray-labs/bray-scenarios.git
cd bray-scenarios

cp .env.example .env
# Edit DATABASE_URL and JWT_SECRET

npm install
npm run db:init    # push schema + seed roles
npm run dev        # API on :3001, client on :5173
```

Or use the launch script, which copies `.env.example` if needed, installs dependencies, initializes the database, and starts both services:

```bash
chmod +x bin/dev.sh
npm run launch:local
```

On first visit to `/login`, create the administrator account in the setup form. Optionally set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env` to seed an admin automatically on init — seeded admins must change their password on first login.

### Option 2: Quick start with Docker

**Prerequisites:** Docker and Docker Compose

```bash
git clone https://github.com/heybray-labs/bray-scenarios.git
cd bray-scenarios

cp .env.docker.example .env
# Edit JWT_SECRET (required)

docker compose up --build
# open http://localhost:3001
```

Or: `npm run docker:up`

See [docs/DOCKER.md](docs/DOCKER.md) for SSO, volumes, and troubleshooting.

Versioned images are published to `ghcr.io/heybray-labs/bray-scenarios` on each tagged release — see [docs/RELEASING.md](docs/RELEASING.md).

## Configuration

Environment variables are documented in [.env.example](.env.example) and [.env.docker.example](.env.docker.example).

For authentication setup (IdP configuration, redirect URIs, Google Workspace SAML), see [AUTHENTICATION.md](AUTHENTICATION.md).

## Project structure

```
bray-scenarios/
├── client/     React + Vite frontend
├── server/     Express + Drizzle + LangChain backend
├── shared/     Drizzle schemas
├── docker/     Container entrypoint
└── bin/        Dev scripts
```

## License

License to be confirmed.
