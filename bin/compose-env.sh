#!/usr/bin/env bash
# Load .env, validate APP_INSTANCE_PREFIX, export COMPOSE_PROJECT_NAME, exec command.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE=".env"

die() {
  echo "error: $*" >&2
  exit 1
}

usage() {
  cat <<EOF
Usage: compose-env.sh [OPTIONS] -- COMMAND [ARGS...]

Load .env, apply APP_INSTANCE_PREFIX for Docker isolation, then run COMMAND.

Options:
  --env-file PATH   Env file to load (default: .env in current directory)
  -h, --help        Show this help

Examples:
  ./bin/compose-env.sh docker compose up --build
  ./bin/compose-env.sh --env-file .env docker compose down
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --env-file)
      [ $# -ge 2 ] || die "--env-file requires a path"
      ENV_FILE="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    --)
      shift
      break
      ;;
    *)
      break
      ;;
  esac
done

[ $# -gt 0 ] || die "missing command (try --help)"

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

validate_instance_prefix() {
  local prefix="$1"
  if [ -z "$prefix" ]; then
    return 0
  fi
  if ! [[ "$prefix" =~ ^[a-z0-9][a-z0-9-]{0,31}$ ]]; then
    die "APP_INSTANCE_PREFIX must be 1-32 lowercase alphanumeric/hyphen chars, starting with a letter or digit (got: ${prefix})"
  fi
}

validate_instance_prefix "${APP_INSTANCE_PREFIX:-}"

if [ -n "${APP_INSTANCE_PREFIX:-}" ]; then
  export COMPOSE_PROJECT_NAME="bray-scenarios-${APP_INSTANCE_PREFIX}"
fi

PORT="${PORT:-3001}"
if [ -n "${APP_INSTANCE_PREFIX:-}" ]; then
  echo "Instance prefix: ${APP_INSTANCE_PREFIX} | Compose project: ${COMPOSE_PROJECT_NAME} | PORT: ${PORT}"
else
  echo "Compose project: ${COMPOSE_PROJECT_NAME:-bray-scenarios} | PORT: ${PORT}"
fi

exec "$@"
