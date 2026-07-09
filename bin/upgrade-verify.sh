#!/usr/bin/env bash
# Verify a Docker Compose install after upgrade (migrations + API health).
set -euo pipefail

die() {
  echo "error: $*" >&2
  exit 1
}

usage() {
  cat <<EOF
Usage: upgrade-verify.sh

Check recent app logs for migration success and confirm the API responds.

Run from your install directory (where .env and the compose file live).
EOF
}

if [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
  usage
  exit 0
fi

[ -f .env ] || die "run from your install directory (where .env lives)"

COMPOSE_FILE="docker-compose.quickstart.yml"
if [ ! -f "$COMPOSE_FILE" ]; then
  COMPOSE_FILE="docker-compose.yml"
fi
[ -f "$COMPOSE_FILE" ] || die "no compose file found (docker-compose.quickstart.yml or docker-compose.yml)"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
COMPOSE_ENV="./compose-env.sh"
if [ ! -x "$COMPOSE_ENV" ]; then
  COMPOSE_ENV="${SCRIPT_DIR}/compose-env.sh"
fi
[ -x "$COMPOSE_ENV" ] || die "compose-env.sh not found"

set -a
# shellcheck disable=SC1091
source .env
set +a

PORT="${PORT:-3001}"
BASE_URL="http://localhost:${PORT}"
FAILED=0

compose() {
  "$COMPOSE_ENV" --env-file .env -- docker compose -f "$COMPOSE_FILE" "$@"
}

echo "Checking app logs..."
LOGS="$(compose logs app --tail 80 2>/dev/null || true)"
if echo "$LOGS" | grep -qE "No migrations pending|Applied migration "; then
  echo "  OK: migrations checked"
elif echo "$LOGS" | grep -q "Server listening"; then
  echo "  OK: server listening (migrations may have run earlier)"
else
  echo "  FAIL: no migration or startup message in recent logs" >&2
  FAILED=1
fi

echo "Checking ${BASE_URL}/api/health..."
HEALTH="$(curl -fsS "${BASE_URL}/api/health" 2>/dev/null || true)"
if [ "$HEALTH" = '{"status":"ok"}' ]; then
  echo "  OK: ${HEALTH}"
else
  echo "  FAIL: health check failed" >&2
  FAILED=1
fi

echo "Checking ${BASE_URL}/api/about..."
ABOUT="$(curl -fsS "${BASE_URL}/api/about" 2>/dev/null || true)"
if [ -n "$ABOUT" ]; then
  echo "  OK: ${ABOUT}"
else
  echo "  FAIL: /api/about unreachable" >&2
  FAILED=1
fi

if [ "$FAILED" -ne 0 ]; then
  die "upgrade verification failed"
fi

echo "Upgrade verified."
