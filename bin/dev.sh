#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

INSTALL_MARKER=".npm-install.stamp"
if [ ! -d node_modules ] || [ ! -f "$INSTALL_MARKER" ] || [ package-lock.json -nt "$INSTALL_MARKER" ]; then
  npm install
  touch "$INSTALL_MARKER"
fi

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

./bin/check-dev-db-port.sh
./bin/compose-env.sh -- docker compose up -d db --wait
npm run db:init

exec concurrently -n server,client -c blue,green \
  "npm run dev --workspace=server" \
  "npm run dev --workspace=client"
