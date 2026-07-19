#!/usr/bin/env bash
# Run a server demo script in a one-off app container on the Compose network.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SCRIPT=${1:?usage: demo-docker-run.sh init-db/demo-seed.ts}
shift || true

if ! ./bin/compose-env.sh -- docker compose ps --services --filter status=running 2>/dev/null | grep -qx db; then
  echo "error: db container is not running. Start with: npm run docker:up (or docker compose up -d db)" >&2
  exit 1
fi

MOUNTS=(-v "$ROOT/server:/app/server" -v "$ROOT/shared:/app/shared")
SCENARIOS_SERVER_SRC="$ROOT/packages/scenarios-server/src"
if [[ -d "$SCENARIOS_SERVER_SRC" ]]; then
  MOUNTS+=(-v "$SCENARIOS_SERVER_SRC:/app/node_modules/@heybray/scenarios-server/src")
  SETUP="npm install --no-save sharp lucide && "
else
  SETUP=""
fi

# Local dev server cwd is server/ → default MEDIA_DIR is server/data/media on the host.
mkdir -p "$ROOT/server/data/media"
MOUNTS+=(-v "$ROOT/server/data/media:/app/data/media")

exec ./bin/compose-env.sh -- docker compose run --rm --no-deps \
  --entrypoint sh \
  "${MOUNTS[@]}" \
  app -c "${SETUP}cd /app/server && npx tsx ${SCRIPT}"
