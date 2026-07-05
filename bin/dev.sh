#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example — update DATABASE_URL if needed."
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

export VITE_API_PORT="${VITE_API_PORT:-${PORT:-3001}}"
export VITE_PORT="${VITE_PORT:-5173}"

npm install
npm run db:init
npm run dev
