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

This will fetch and launch the latest public Docker image without downloading the codebase.  You will need to have Docker and Docker Compose installed for this to work.

Run the following command in the terminal, to install with default configuration (you can update this later):

```bash
curl -fsSL https://raw.githubusercontent.com/heybray-labs/bray-scenarios/main/bin/quickstart.sh | bash
```

Or, for a guided setup (port, auth mode, OIDC settings), run interactively in a terminal:

```bash
curl -fsSL https://raw.githubusercontent.com/heybray-labs/bray-scenarios/main/bin/quickstart.sh | bash -s -- --interactive
```
See [docs/DOCKER.md](docs/DOCKER.md) for stop, logs, reset, and SSO setup.

### Option 2: 💻 Clone from GitHub and run locally (use this if you don't have docker) 

Use this if you don't have This requires Node.js 20+, npm 10+, and a PostgreSQL server in which you need to create a database for the backend

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

See [docs/DOCKER.md](docs/DOCKER.md) for SSO, volumes, and troubleshooting.

Versioned images are published to `ghcr.io/heybray-labs/bray-scenarios` on each tagged release — see [docs/RELEASING.md](docs/RELEASING.md).

## Configuration

In each of the above cases, you'll end up with the app running on http://localhost:3000.  To get started:

1. Point your browser to `http://localhost:3001`
2. Create the Administrator account by filling in the registration form
3. Configure LLM keys under "⚙️ Settings -> AI",
4. Setup your Users under "⚙️ Settings -> Users". If you want to use SSO, then you'll need to first edit `.env` — see [docs/AUTHENTICATION.md](docs/AUTHENTICATION.md).

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