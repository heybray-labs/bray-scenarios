#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO="heybray-labs/bray-scenarios"
BRAY_VERSION="${BRAY_VERSION:-main}"
BRAY_IMAGE_TAG="${BRAY_IMAGE_TAG:-latest}"
INSTALL_DIR="${BRAY_SCENARIOS_HOME:-$HOME/.bray-scenarios}"
PORT="${PORT:-3001}"
COMPOSE_FILE="docker-compose.quickstart.yml"
COMPOSE_PROJECT="bray-scenarios-quickstart"
LOCAL_COMPOSE="${SCRIPT_DIR}/../docker/${COMPOSE_FILE}"
RAW_BASE="https://raw.githubusercontent.com/${REPO}/${BRAY_VERSION}"

die() {
  echo "error: $*" >&2
  exit 1
}

command -v docker >/dev/null 2>&1 || die "Docker is required. Install Docker Desktop or Docker Engine: https://docs.docker.com/get-docker/"
docker compose version >/dev/null 2>&1 || die "Docker Compose v2 is required (docker compose)."

generate_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
  else
    od -An -N32 -tx1 /dev/urandom | tr -d ' \n'
  fi
}

mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

if [ ! -f "$COMPOSE_FILE" ]; then
  if [ -f "$LOCAL_COMPOSE" ]; then
    cp "$LOCAL_COMPOSE" "$COMPOSE_FILE"
    echo "Copied compose file from local repo."
  else
    echo "Downloading compose file..."
    curl -fsSL "${RAW_BASE}/docker/${COMPOSE_FILE}" -o "$COMPOSE_FILE"
  fi
fi

if [ ! -f .env ]; then
  JWT_SECRET="$(generate_secret)"
  cat > .env <<EOF
PORT=${PORT}
DATABASE_URL=postgresql://postgres:postgres@db:5432/roleplay_app
AUTH_PROTOCOL=local
JWT_SECRET=${JWT_SECRET}
APP_URL=http://localhost:${PORT}
SAML_SP_CERT_DIR=/app/data/saml
LOG_LEVEL=INFO
EOF
  echo "Created ${INSTALL_DIR}/.env with a generated JWT_SECRET."
else
  echo "Using existing ${INSTALL_DIR}/.env"
fi

export BRAY_IMAGE_TAG PORT

compose() {
  docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_FILE" "$@"
}

echo "Pulling images (tag: ${BRAY_IMAGE_TAG})..."
if ! compose pull; then
  die "Failed to pull images. If you see 401/403, the GHCR package may still be private — see docs/RELEASING.md"
fi

echo "Starting Bray Scenarios..."
compose up -d

echo ""
echo "Bray Scenarios is starting."
echo "  URL:        http://localhost:${PORT}"
echo "  Install:    ${INSTALL_DIR}"
echo "  Health:     curl http://localhost:${PORT}/api/health"
echo ""
echo "On first visit to /login, create the administrator account."
echo "Configure LLM keys at /settings/ai after logging in."
echo ""
echo "Logs:   cd ${INSTALL_DIR} && docker compose -p ${COMPOSE_PROJECT} -f ${COMPOSE_FILE} logs -f app"
echo "Stop:   cd ${INSTALL_DIR} && docker compose -p ${COMPOSE_PROJECT} -f ${COMPOSE_FILE} down"
echo "Reset:  cd ${INSTALL_DIR} && docker compose -p ${COMPOSE_PROJECT} -f ${COMPOSE_FILE} down -v"
