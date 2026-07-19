#!/usr/bin/env bash
# Stop dev Compose stack and delete all volumes (Postgres data, media, SAML certs).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

./bin/compose-env.sh -- docker compose down -v --remove-orphans

if [[ -d "$ROOT/server/data/media" ]]; then
  rm -rf "$ROOT/server/data/media"
  echo "Removed host server/data/media"
fi

echo ""
echo "Docker dev data wiped (pgdata, media_data, saml_certs)."
echo "Start fresh with: npm run docker:up (or docker compose up -d db) && npm run db:init && npm run db:docker:demo-seed"
