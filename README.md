# Roleplay Standalone App

Open-source AI roleplay training app — a minimized port of the WebAppTemplate roleplay feature with the Bray pink theme and navbar-only shell.

## Features

- **Authoring** — Create scenarios with persona, rubric, and settings
- **Learner flow** — Intro → live SSE chat → graded results
- **LLM admin** — Configure OpenAI, Anthropic, and Google keys/models at `/settings/ai`
- **Attempt history** — Admins can review attempts and override criterion scores
- **Auth** — Local email/password, OIDC (Microsoft Entra ID, Okta), or SAML (Google Workspace); admin and learner roles (single tenant)

## Non-goals (v1)

- Multi-tenant / platform admin
- Spaces, folders, gamification rewards
- Navbar shortcuts, sidebar, media uploads

## Prerequisites

- Node.js 20+
- PostgreSQL

## Quick start

```bash
cp .env.example .env
# Edit DATABASE_URL and JWT_SECRET

npm install
npm run db:init    # push schema + seed tenant/roles
npm run dev        # API :3001, client :5173
```

Or use the launch script:

```bash
chmod +x bin/dev.sh
npm run launch:local
```

On first visit to `/login`, create the administrator account in the setup form. Optionally set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env` to seed an admin automatically on init — the seeded admin must change their password on first login.

## Project structure

```
bray-scenarios/
├── client/     React + Vite frontend
├── server/     Express + Drizzle + LangChain backend
├── shared/     Drizzle schemas
└── bin/        Dev scripts
```

## Environment variables

See [.env.example](.env.example).

### Authentication

Set `AUTH_PROTOCOL` in `.env`:

| Value | Mode |
|-------|------|
| `local` (default) | Email/password login and self-registration |
| `oidc` | OpenID Connect SSO (Microsoft Entra ID, Okta) |
| `saml` | SAML SSO (Google Workspace) |

Only one SSO protocol per deployment. Full setup guides (IdP configuration, redirect URIs, Google Workspace SAML, troubleshooting) are in [AUTHENTICATION.md](AUTHENTICATION.md).

## License

Placeholder — add your chosen open-source license.
