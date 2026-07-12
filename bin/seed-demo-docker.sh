#!/usr/bin/env bash
# Run demo seed in a one-off app container on the Compose network (DATABASE_URL @db: works).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! docker compose ps --services --filter status=running 2>/dev/null | grep -qx db; then
  echo "error: db container is not running. Start with: docker compose up -d db" >&2
  exit 1
fi

# The image ENTRYPOINT (docker/entrypoint.sh) ignores its args and always boots
# the server, so a plain CMD override runs index.ts instead of the seed. Override
# the entrypoint to actually run the demo seed.
exec ./bin/compose-env.sh -- docker compose run --rm --no-deps \
  --entrypoint sh \
  -v "$ROOT/server:/app/server" \
  -v "$ROOT/shared:/app/shared" \
  -v "$ROOT/examples:/app/examples" \
  app -c "cd /app/server && npx tsx init-db/seed-demo.ts"
