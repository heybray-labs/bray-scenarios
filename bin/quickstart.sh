#!/usr/bin/env bash
set -euo pipefail

if [ -n "${BASH_SOURCE[0]:-}" ] && [ "${BASH_SOURCE[0]}" != "bash" ] && [ -f "${BASH_SOURCE[0]}" ]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
elif [ -n "${0:-}" ] && [ -f "$0" ] && [ "$(basename "$0")" != "bash" ]; then
  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
else
  SCRIPT_DIR=""
fi
REPO="heybray-labs/bray-scenarios"
COMPOSE_ENV=""
START_DIR="$(pwd)"
COMPOSE_FILE="docker-compose.quickstart.yml"
LOCAL_COMPOSE="${SCRIPT_DIR:+$SCRIPT_DIR/../docker/${COMPOSE_FILE}}"
LOCAL_ENV_EXAMPLE="${SCRIPT_DIR:+$SCRIPT_DIR/../.env.docker.example}"
LOCAL_COMPOSE_ENV="${SCRIPT_DIR:+$SCRIPT_DIR/compose-env.sh}"
LOCAL_UPGRADE_BACKUP="${SCRIPT_DIR:+$SCRIPT_DIR/upgrade-backup.sh}"
LOCAL_UPGRADE_VERIFY="${SCRIPT_DIR:+$SCRIPT_DIR/upgrade-verify.sh}"
ENV_EXAMPLE_NAME=".env.docker.example"

INTERACTIVE=false
RECONFIGURE=false
WIZARD_AUTH_PROTOCOL="local"
WIZARD_OIDC_REDIRECT_URI=""
SHOW_SAML_CHECKLIST=false

RED='\033[0;31m'
NC='\033[0m' # No Color
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[0;37m'
LIGHT_GRAY='\033[0;37m'
DARK_GRAY='\033[1;30m'
LIGHT_RED='\033[1;31m'
LIGHT_GREEN='\033[1;32m'
LIGHT_YELLOW='\033[1;33m'
LIGHT_BLUE='\033[1;34m'
LIGHT_MAGENTA='\033[1;35m'
LIGHT_CYAN='\033[1;36m'
LIGHT_WHITE='\033[1;37m'

die() {
  echo "error: $*" >&2
  exit 1
}

validate_instance_prefix() {
  local prefix="$1"
  if [ -z "$prefix" ]; then
    return 0
  fi
  if ! [[ "$prefix" =~ ^[a-z0-9][a-z0-9-]{0,31}$ ]]; then
    die "APP_INSTANCE_PREFIX must be 1-32 lowercase alphanumeric/hyphen chars, starting with a letter or digit (got: ${prefix})"
  fi
}

resolve_install_dir() {
  validate_instance_prefix "${APP_INSTANCE_PREFIX:-}"
  if [ "${INSIDE_INSTALL_DIR:-false}" = true ]; then
    INSTALL_DIR="${START_DIR}"
  elif [ -n "${APP_INSTANCE_PREFIX:-}" ]; then
    INSTALL_DIR="${START_DIR}/${APP_INSTANCE_PREFIX}"
  else
    INSTALL_DIR="${START_DIR}"
  fi
}

INSIDE_INSTALL_DIR=false
if [ -f "${START_DIR}/.env" ] && { [ -f "${START_DIR}/${COMPOSE_FILE}" ] || [ -f "${START_DIR}/compose-env.sh" ]; }; then
  INSIDE_INSTALL_DIR=true
fi

is_install_dir() {
  local dir="$1"
  [ -f "${dir}/.env" ] && { [ -f "${dir}/${COMPOSE_FILE}" ] || [ -f "${dir}/compose-env.sh" ]; }
}

usage() {
  cat <<EOF
Usage: quickstart.sh [OPTIONS]

Install and start Bray Scenarios via Docker Compose.

Options:
  --interactive   Run a guided setup wizard (requires a terminal)
  --reconfigure   Re-run the wizard and overwrite .env (use with --interactive)
  -h, --help      Show this help

Examples:
  curl -fsSL .../quickstart.sh | bash
  curl -fsSL .../quickstart.sh | bash -s -- --interactive
  ./bin/quickstart.sh --interactive --reconfigure
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --interactive) INTERACTIVE=true ;;
    --reconfigure) RECONFIGURE=true ;;
    -h|--help) usage; exit 0 ;;
    *) die "unknown argument: $1 (try --help)" ;;
  esac
  shift
done

if [ "$INTERACTIVE" = true ] && [ ! -r /dev/tty ]; then
  die "interactive mode requires a terminal; omit --interactive for silent install (curl | bash)"
fi

prompt_read() {
  IFS= read -r "$@" </dev/tty
}

prompt_read_secret() {
  IFS= read -rs "$@" </dev/tty
}

fetch_latest_release_tag() {
  curl -fsSL -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/${REPO}/releases/latest" 2>/dev/null \
    | sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' \
    | head -1
}

resolve_scripts_ref() {
  if [ -n "${BRAY_SCRIPTS_REF:-}" ]; then
    SCRIPTS_REF="$BRAY_SCRIPTS_REF"
    return
  fi
  local tag
  tag="$(fetch_latest_release_tag || true)"
  SCRIPTS_REF="${tag:-main}"
}

resolve_image_tag() {
  if [ -z "${BRAY_IMAGE_TAG+x}" ] && [ -z "${BRAY_VERSION+x}" ]; then
    local tag
    tag="$(fetch_latest_release_tag || true)"
    if [ -n "$tag" ]; then
      BRAY_IMAGE_TAG="${tag#v}"
      echo "Using latest release: ${tag}"
      return
    fi
    echo "warning: could not fetch latest release; falling back to latest image tag" >&2
    BRAY_IMAGE_TAG="latest"
    return
  fi

  if [ -z "${BRAY_IMAGE_TAG+x}" ]; then
    BRAY_IMAGE_TAG="${BRAY_VERSION#v}"
  elif [ -z "${BRAY_VERSION+x}" ]; then
    BRAY_VERSION="v${BRAY_IMAGE_TAG#v}"
  fi
}

resolve_scripts_ref
resolve_image_tag

if [ -z "${BRAY_SCRIPTS_REF:-}" ] && { [ -n "${BRAY_IMAGE_TAG+x}" ] || [ -n "${BRAY_VERSION+x}" ]; }; then
  local_image_tag="${BRAY_IMAGE_TAG:-${BRAY_VERSION#v}}"
  scripts_tag="${SCRIPTS_REF#v}"
  if [ "$local_image_tag" != "$scripts_tag" ] && [ "$local_image_tag" != "latest" ]; then
    echo "Using image tag ${local_image_tag}; fetching install scripts from ${SCRIPTS_REF}"
  fi
fi

RAW_BASE="https://raw.githubusercontent.com/${REPO}/${SCRIPTS_REF}"

command -v docker >/dev/null 2>&1 || die "Docker is required. Install Docker Desktop or Docker Engine: https://docs.docker.com/get-docker/"
docker compose version >/dev/null 2>&1 || die "Docker Compose v2 is required (docker compose)."

generate_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
  else
    od -An -N32 -tx1 /dev/urandom | tr -d ' \n'
  fi
}

inplace_sed() {
  local file="$1"
  shift
  if sed --version 2>/dev/null | grep -q GNU; then
    sed -i "$@" "$file"
  else
    sed -i '' "$@" "$file"
  fi
}

set_env_value() {
  local key="$1"
  local value="$2"
  local file="$3"
  if grep -q "^${key}=" "$file"; then
    inplace_sed "$file" "s|^${key}=.*|${key}=${value}|"
  else
    echo "${key}=${value}" >>"$file"
  fi
}

uncomment_env_prefix() {
  local prefix="$1"
  local file="$2"
  inplace_sed "$file" "s/^#${prefix}/${prefix}/"
}

prompt_default() {
  local label="$1"
  local default="$2"
  local input
  printf '%s [%s]: ' "$label" "$default" >&2
  prompt_read input
  if [ -z "$input" ]; then
    echo "$default"
  else
    echo "$input"
  fi
}

prompt_secret() {
  local label="$1"
  local input
  printf '%s: ' "$label" >&2
  prompt_read_secret input
  printf '\n' >&2
  echo "$input"
}

prompt_required() {
  local label="$1"
  local value=""
  while [ -z "$value" ]; do
    value="$(prompt_default "$label" "")"
    if [ -z "$value" ]; then
      echo "This field is required." >&2
    fi
  done
  echo "$value"
}

prompt_yes_no() {
  local question="$1"
  local default="${2:-y}"
  local prompt hint input
  if [ "$default" = "y" ]; then
    hint="Y/n"
  else
    hint="y/N"
  fi
  while true; do
    printf '%s [%s]: ' "$question" "$hint" >&2
    prompt_read input
    input="$(echo "$input" | tr '[:upper:]' '[:lower:]')"
    if [ -z "$input" ]; then
      input="$default"
    fi
    case "$input" in
      y|yes) return 0 ;;
      n|no) return 1 ;;
      *) echo "Please answer y or n." >&2 ;;
    esac
  done
}

prompt_auth_mode() {
  echo "" >&2
  echo "🔒 Authentication mode:" >&2
  echo "  1) Local email/password" >&2
  echo "  2) OIDC (Okta / Microsoft Entra ID)" >&2
  echo "  3) SAML (Google Workspace — partial setup)" >&2
  local choice
  while true; do
    choice="$(prompt_default "  Choose 1-3" "1")"
    case "$choice" in
      1) echo "local"; return ;;
      2) echo "oidc"; return ;;
      3) echo "saml"; return ;;
      *) echo "Invalid choice. Enter 1, 2, or 3." >&2 ;;
    esac
  done
}

prompt_overwrite_or_abort() {
  echo "" >&2
  echo "Directory ${INSTALL_DIR}/ already contains a Bray Scenarios install." >&2
  if prompt_yes_no "Overwrite configuration and re-run setup?" "n"; then
    return 0
  fi
  die "Aborted."
}

prompt_instance_prefix() {
  local default="${1:-}"
  local prefix
  echo "Creates a subdirectory here and isolates Docker resources. Press Enter for current directory only." >&2
  while true; do
    prefix="$(prompt_default "Instance prefix (optional)" "$default")"
    if [ -z "$prefix" ] || [[ "$prefix" =~ ^[a-z0-9][a-z0-9-]{0,31}$ ]]; then
      echo "$prefix"
      return
    fi
    echo "Invalid prefix: use 1-32 lowercase alphanumeric/hyphen chars, starting with a letter or digit." >&2
  done
}

prepare_interactive_install() {
  local original_prefix="${APP_INSTANCE_PREFIX:-}"

  echo "" >&2
  echo -e "⭐️ Starting Bray Scenarios Setup Wizard..." >&2
  echo "" >&2

  if [ "$INSIDE_INSTALL_DIR" = true ]; then
    INSTALL_DIR="$START_DIR"
    if [ -f "${START_DIR}/.env" ]; then
      APP_INSTANCE_PREFIX="$(read_env_value "APP_INSTANCE_PREFIX" "${START_DIR}/.env")"
    fi
    echo "Using existing install in ${INSTALL_DIR}" >&2
    if [ -n "${APP_INSTANCE_PREFIX:-}" ]; then
      echo "Instance prefix: ${APP_INSTANCE_PREFIX} (from .env — locked during reconfigure)" >&2
    else
      echo "No instance prefix (from .env — locked during reconfigure)" >&2
    fi
    echo "" >&2
    return
  fi

  local prefix_default=""
  if [ "$RECONFIGURE" = true ] && [ -n "$original_prefix" ]; then
    prefix_default="$original_prefix"
  fi
  APP_INSTANCE_PREFIX="$(prompt_instance_prefix "$prefix_default")"
  if [ "$RECONFIGURE" = true ] && [ -n "$original_prefix" ] && [ "$APP_INSTANCE_PREFIX" != "$original_prefix" ]; then
    echo "" >&2
    echo "Changing the prefix will create a new install in ${START_DIR}/${APP_INSTANCE_PREFIX}/." >&2
    echo "The current install is left untouched." >&2
    prompt_yes_no "Continue?" "n" || die "Aborted."
  fi

  resolve_install_dir
  echo "" >&2
  echo "Install directory: ${INSTALL_DIR}" >&2

  if is_install_dir "$INSTALL_DIR"; then
    if [ "$RECONFIGURE" = true ]; then
      echo "Reconfiguring existing install in ${INSTALL_DIR}" >&2
    else
      prompt_overwrite_or_abort
    fi
  fi
  echo "" >&2
}

setup_install_location() {
  if [ "$INTERACTIVE" = true ] && { [ "$RECONFIGURE" = true ] || [ "$INSIDE_INSTALL_DIR" = false ] || [ ! -f "${START_DIR}/.env" ]; }; then
    prepare_interactive_install
  elif [ "$INSIDE_INSTALL_DIR" = true ]; then
    INSTALL_DIR="$START_DIR"
    if [ -f "${START_DIR}/.env" ]; then
      APP_INSTANCE_PREFIX="$(read_env_value "APP_INSTANCE_PREFIX" "${START_DIR}/.env")"
    fi
  else
    resolve_install_dir
  fi
}

copy_env_from_example() {
  if [ -f "$LOCAL_ENV_EXAMPLE" ]; then
    cp "$LOCAL_ENV_EXAMPLE" .env
    echo "🔄 Copied default .env from local .env.docker.example."
    echo ""
  else
    echo "🔄 Downloading .env.docker.example..."
    echo "" >&2

    curl -fsSL "${RAW_BASE}/${ENV_EXAMPLE_NAME}" -o .env
  fi
}

read_env_value() {
  local key="$1"
  local file="$2"
  grep "^${key}=" "$file" 2>/dev/null | cut -d= -f2- || true
}

setup_env_noninteractive() {
  copy_env_from_example
  local port="${PORT:-3001}"
  JWT_SECRET="$(generate_secret)"
  set_env_value "JWT_SECRET" "$JWT_SECRET" .env
  set_env_value "PORT" "$port" .env
  set_env_value "APP_URL" "http://localhost:${port}" .env
  if [ -n "${APP_INSTANCE_PREFIX:-}" ]; then
    set_env_value "APP_INSTANCE_PREFIX" "$APP_INSTANCE_PREFIX" .env
  fi
  echo "Created ${INSTALL_DIR}/.env with a generated JWT_SECRET."
}

run_interactive_wizard() {
  copy_env_from_example

  local port app_url log_level auth_mode
  echo "Enter the following details to configure your Bray Scenarios instance. Press Enter to use the default value."
  port="$(prompt_default "Server Port" "3001")"
  app_url="$(prompt_default "Application URL (public URL users open in the browser)" "http://localhost:${port}")"
  log_level="$(prompt_default "Logging Level (TRACE/DEBUG/INFO/WARN/ERROR)" "INFO")"
  case "$log_level" in
    TRACE|DEBUG|INFO|WARN|ERROR) ;;
    *) die "invalid LOG_LEVEL: ${log_level}" ;;
  esac

  auth_mode="$(prompt_auth_mode)"
  WIZARD_AUTH_PROTOCOL="$auth_mode"

  JWT_SECRET="$(generate_secret)"
  set_env_value "JWT_SECRET" "$JWT_SECRET" .env
  set_env_value "PORT" "$port" .env
  set_env_value "APP_URL" "$app_url" .env
  set_env_value "LOG_LEVEL" "$log_level" .env
  set_env_value "AUTH_PROTOCOL" "$auth_mode" .env
  if [ -n "${APP_INSTANCE_PREFIX:-}" ]; then
    set_env_value "APP_INSTANCE_PREFIX" "$APP_INSTANCE_PREFIX" .env
  fi

  case "$auth_mode" in
    local)
      if prompt_yes_no "Create an administrator account now?" "n"; then
        uncomment_env_prefix "ADMIN_EMAIL" .env
        uncomment_env_prefix "ADMIN_PASSWORD" .env
        local admin_email admin_password
        admin_email="$(prompt_required "Admin email")"
        while true; do
          admin_password="$(prompt_secret "Admin password (min 6 characters)")"
          if [ "${#admin_password}" -ge 6 ]; then
            break
          fi
          echo "Password must be at least 6 characters." >&2
        done
        set_env_value "ADMIN_EMAIL" "$admin_email" .env
        set_env_value "ADMIN_PASSWORD" "$admin_password" .env
      fi
      ;;
    oidc)
      uncomment_env_prefix "OIDC_" .env
      local client_id client_secret issuer_url provider_name
      client_id="$(prompt_required "OIDC_CLIENT_ID")"
      client_secret="$(prompt_required "OIDC_CLIENT_SECRET")"
      issuer_url="$(prompt_required "OIDC_ISSUER_URL")"
      provider_name="$(prompt_default "OIDC_PROVIDER_NAME (e.g. Microsoft, Okta)" "SSO")"
      WIZARD_OIDC_REDIRECT_URI="${app_url}/api/auth/oidc/callback"
      set_env_value "OIDC_CLIENT_ID" "$client_id" .env
      set_env_value "OIDC_CLIENT_SECRET" "$client_secret" .env
      set_env_value "OIDC_ISSUER_URL" "$issuer_url" .env
      set_env_value "OIDC_PROVIDER_NAME" "$provider_name" .env
      set_env_value "OIDC_REDIRECT_URI" "$WIZARD_OIDC_REDIRECT_URI" .env
      echo "" >&2
      ;;
    saml)
      SHOW_SAML_CHECKLIST=true
      echo "" >&2
      echo "SAML requires HTTPS for Google Workspace. Use a tunnel (e.g. ngrok) if testing locally." >&2
      echo "IdP metadata and Google Admin setup are completed after the stack starts." >&2
      ;;
  esac

  echo "" >&2
  echo "✅ Created ${INSTALL_DIR}/.env via interactive wizard."
  echo "" >&2
}

print_saml_checklist() {
  echo "SAML setup checklist:"
  echo "  1. Run a tunnel to port ${PORT} (e.g. ngrok http ${PORT})"
  echo "  2. Set APP_URL in ${INSTALL_DIR}/.env to your HTTPS tunnel URL"
  echo "  3. Register ACS URL and Entity ID in Google Admin (see docs)"
  echo "  4. Paste base64-encoded IdP metadata into SAML_IDP_METADATA in .env"
  echo "  5. Restart: cd ${INSTALL_DIR} && ${COMPOSE_ENV} --env-file .env -- docker compose -f ${COMPOSE_FILE} up -d"
  echo "  Docs: https://github.com/${REPO}/blob/main/docs/AUTHENTICATION.md"
}

print_completion() {
  local auth_protocol="${WIZARD_AUTH_PROTOCOL}"
  if [ -f .env ]; then
    auth_protocol="$(read_env_value "AUTH_PROTOCOL" .env)"
    [ -z "$auth_protocol" ] && auth_protocol="local"
    PORT="$(read_env_value "PORT" .env)"
    [ -z "$PORT" ] && PORT="3001"
    if [ -z "$WIZARD_OIDC_REDIRECT_URI" ]; then
      WIZARD_OIDC_REDIRECT_URI="$(read_env_value "OIDC_REDIRECT_URI" .env)"
    fi
  fi

  echo ""
  echo "--------------------------------------------------------------------------------------------"
  echo "🚀 Bray Scenarios has started."
  if [ -n "${APP_INSTANCE_PREFIX:-}" ]; then
    echo "   Prefix:  ${APP_INSTANCE_PREFIX}"
  fi
  echo "   URL:     http://localhost:${PORT}"
  echo "   Install: ${INSTALL_DIR}"
  echo "   Config:  ${INSTALL_DIR}/.env (edit to change settings)"
  echo "   Health:  curl http://localhost:${PORT}/api/health"
  echo ""
  echo "🐳 Docker commands:"
  echo "   Logs:    cd ${INSTALL_DIR} && ${COMPOSE_ENV} --env-file .env -- docker compose -f ${COMPOSE_FILE} logs -f app"
  echo "   Stop:    cd ${INSTALL_DIR} && ${COMPOSE_ENV} --env-file .env -- docker compose -f ${COMPOSE_FILE} down"
  echo "   Reset:   cd ${INSTALL_DIR} && ${COMPOSE_ENV} --env-file .env -- docker compose -f ${COMPOSE_FILE} down -v"
  echo "   Start:   cd ${INSTALL_DIR} && ${COMPOSE_ENV} --env-file .env -- docker compose -f ${COMPOSE_FILE} up -d"
  echo ""

  case "$auth_protocol" in
    local)
      echo "On first visit to /login, create the administrator account."
      ;;
    oidc)
      if [ -n "$WIZARD_OIDC_REDIRECT_URI" ]; then
        echo "‼️ You must register this OIDC redirect URI with your identity provider: ${WIZARD_OIDC_REDIRECT_URI} ‼️"
      fi
      ;;
    saml)
      print_saml_checklist
      ;;
    *)
      echo "Edit ${INSTALL_DIR}/.env for auth settings, then restart."
      ;;
  esac

  if [ "$SHOW_SAML_CHECKLIST" = true ] && [ "$auth_protocol" != "saml" ]; then
    print_saml_checklist
  fi

  echo "--------------------------------------------------------------------------------------------"

}

ensure_compose_env() {
  local dest="${INSTALL_DIR}/compose-env.sh"
  if [ -f "$dest" ]; then
    COMPOSE_ENV="$dest"
    return
  fi
  if [ -n "${LOCAL_COMPOSE_ENV:-}" ] && [ -f "$LOCAL_COMPOSE_ENV" ]; then
    cp "$LOCAL_COMPOSE_ENV" "$dest"
  else
    echo "🔄 Downloading compose-env.sh..."
    curl -fsSL "${RAW_BASE}/bin/compose-env.sh" -o "$dest"
  fi
  chmod +x "$dest"
  COMPOSE_ENV="$dest"
}

ensure_upgrade_backup() {
  local dest="${INSTALL_DIR}/upgrade-backup.sh"
  if [ -f "$dest" ]; then
    return
  fi
  if [ -n "${LOCAL_UPGRADE_BACKUP:-}" ] && [ -f "$LOCAL_UPGRADE_BACKUP" ]; then
    cp "$LOCAL_UPGRADE_BACKUP" "$dest"
  else
    echo "🔄 Downloading upgrade-backup.sh..."
    curl -fsSL "${RAW_BASE}/bin/upgrade-backup.sh" -o "$dest"
  fi
  chmod +x "$dest"
}

ensure_upgrade_verify() {
  local dest="${INSTALL_DIR}/upgrade-verify.sh"
  if [ -f "$dest" ]; then
    return
  fi
  if [ -n "${LOCAL_UPGRADE_VERIFY:-}" ] && [ -f "$LOCAL_UPGRADE_VERIFY" ]; then
    cp "$LOCAL_UPGRADE_VERIFY" "$dest"
  else
    echo "🔄 Downloading upgrade-verify.sh..."
    curl -fsSL "${RAW_BASE}/bin/upgrade-verify.sh" -o "$dest"
  fi
  chmod +x "$dest"
}

setup_install_location

mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"
ensure_compose_env
ensure_upgrade_backup
ensure_upgrade_verify

if [ ! -f "$COMPOSE_FILE" ]; then
  if [ -f "$LOCAL_COMPOSE" ]; then
    cp "$LOCAL_COMPOSE" "$COMPOSE_FILE"
    echo "🔄 Copied compose file from local repo."
  else
    echo "🔄 Downloading compose file..."
    curl -fsSL "${RAW_BASE}/docker/${COMPOSE_FILE}" -o "$COMPOSE_FILE"
  fi
fi

if [ -f .env ] && [ "$RECONFIGURE" = false ]; then
  echo "Using existing ${INSTALL_DIR}/.env"
elif [ "$INTERACTIVE" = true ]; then
  run_interactive_wizard
elif [ ! -f .env ]; then
  setup_env_noninteractive
else
  echo "Using existing ${INSTALL_DIR}/.env"
fi

PORT="$(read_env_value "PORT" .env)"
[ -z "$PORT" ] && PORT="3001"
if [ -z "${APP_INSTANCE_PREFIX:-}" ]; then
  APP_INSTANCE_PREFIX="$(read_env_value "APP_INSTANCE_PREFIX" .env)"
fi
BRAY_IMAGE_TAG="${BRAY_IMAGE_TAG:-latest}"
export BRAY_IMAGE_TAG PORT

compose() {
  "$COMPOSE_ENV" --env-file .env -- docker compose -f "$COMPOSE_FILE" "$@"
}

echo "🔄 Pulling images (tag: ${BRAY_IMAGE_TAG:-latest})..."
if ! compose pull; then
  die "Failed to pull images. If you see 401 or 403, the GHCR package may still be private - see docs/RELEASING.md"
fi

echo ""
echo -e "▶️ Starting Bray Scenarios..."
compose up -d

print_completion
