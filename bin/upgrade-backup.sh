#!/usr/bin/env bash
# Back up the PostgreSQL database before an in-place upgrade.
set -euo pipefail

die() {
  echo "error: $*" >&2
  exit 1
}

usage() {
  cat <<EOF
Usage: upgrade-backup.sh [OUTPUT_FILE]

Write a pg_dump SQL file from the running db service.

Run from your install directory (where .env and the compose file live).

Examples:
  ./upgrade-backup.sh
  ./upgrade-backup.sh backups/before-upgrade.sql
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

OUTPUT="${1:-backup-$(date +%Y-%m-%d).sql}"

set -a
# shellcheck disable=SC1091
source .env
set +a

POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-roleplay_app}"

"$COMPOSE_ENV" --env-file .env -- docker compose -f "$COMPOSE_FILE" exec -T db \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > "$OUTPUT"

echo "Backup saved to ${OUTPUT}"
