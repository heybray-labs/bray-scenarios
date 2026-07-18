#!/usr/bin/env bash
# Fail fast when .env DATABASE_URL points at the wrong local Postgres port for dev compose.
set -euo pipefail

die() {
  echo "error: $*" >&2
  exit 1
}

compose_file="${1:-docker-compose.yml}"

if [ -z "${DATABASE_URL:-}" ]; then
  die "DATABASE_URL is not set (check .env)"
fi

if [ ! -f "$compose_file" ]; then
  exit 0
fi

default_port="$(
  grep -E 'POSTGRES_PORT:-[0-9]+' "$compose_file" 2>/dev/null \
    | head -1 \
    | sed -E 's/.*POSTGRES_PORT:-([0-9]+).*/\1/' \
    || true
)"
if [ -z "$default_port" ]; then
  default_port="$(
    grep -E '"[0-9]+:5432"' "$compose_file" 2>/dev/null \
      | head -1 \
      | sed -E 's/.*"([0-9]+):5432".*/\1/' \
      || true
  )"
fi

compose_port="${POSTGRES_PORT:-${default_port:-}}"
if [ -z "$compose_port" ]; then
  die "could not determine dev Postgres port from ${compose_file}"
fi

read -r db_host db_port <<< "$(
  node -e "
    const raw = process.env.DATABASE_URL;
    const url = new URL(raw.replace(/^postgresql:/, 'postgres:'));
    process.stdout.write(\`\${url.hostname} \${url.port || '5432'}\`);
  "
)"

case "$db_host" in
  localhost | 127.0.0.1 | ::1) ;;
  *)
    exit 0
    ;;
esac

if [ "$db_port" != "$compose_port" ]; then
  die ".env DATABASE_URL uses port ${db_port}, but this repo's dev compose serves ${compose_port} — check for a stale .env"
fi
