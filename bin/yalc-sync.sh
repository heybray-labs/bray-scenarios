#!/usr/bin/env bash
# yalc publish @heybray/scenarios-* feature packages. See docs/dev-workflow.md.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TARGETS_FILE=".yalc-targets.local"

FEATURE_PKGS=(scenarios-server scenarios-client)

YALC_REMINDER_PRINTED=0

die() {
  echo "error: $*" >&2
  exit 1
}

usage() {
  cat <<EOF
Usage:
  bin/yalc-sync.sh                       # publish + push all scenarios feature packages
  bin/yalc-sync.sh <pkg> [<pkg>…]        # publish named package(s) only
  bin/yalc-sync.sh --link <path>         # yalc add scenarios-server + scenarios-client
  bin/yalc-sync.sh --unlink <path>       # yalc remove --all && npm install
  bin/yalc-sync.sh --status <path>       # list yalc-linked packages in consumer

Path may be a directory or shortcut from ${TARGETS_FILE} (typically premium=...).
EOF
}

print_yalc_reminder() {
  if [ "$YALC_REMINDER_PRINTED" -eq 1 ]; then
    return 0
  fi
  YALC_REMINDER_PRINTED=1
  if grep -rn --include='package.json' --include='package-lock.json' \
       -e '\.yalc' "$ROOT" --exclude-dir=node_modules --exclude-dir=.yalc -l >/dev/null 2>&1; then
    echo "note: yalc references detected under $ROOT"
  fi
  echo "remember to --unlink every target before committing — guards will reject a push with yalc residue."
}

resolve_target_path() {
  local arg="$1"
  if [ -d "$arg" ]; then
    (cd "$arg" && pwd)
    return 0
  fi
  if [ -f "$TARGETS_FILE" ]; then
    local line name path
    while IFS= read -r line || [ -n "$line" ]; do
      line="${line%%#*}"
      line="${line#"${line%%[![:space:]]*}"}"
      [ -z "$line" ] && continue
      name="${line%%=*}"
      path="${line#*=}"
      path="${path#"${path%%[![:space:]]*}"}"
      if [ "$name" = "$arg" ]; then
        [ -d "$path" ] || die "target path missing for ${name}: ${path}"
        (cd "$path" && pwd)
        return 0
      fi
    done < "$TARGETS_FILE"
  fi
  die "unknown target '${arg}' — pass a directory or add name=path to ${TARGETS_FILE}"
}

is_feature_pkg() {
  local pkg="$1"
  local known
  for known in "${FEATURE_PKGS[@]}"; do
    if [ "$known" = "$pkg" ]; then
      return 0
    fi
  done
  return 1
}

publish_pkg() {
  local pkg="$1"
  local dir="packages/${pkg}"
  [ -d "$dir" ] || die "missing ${dir}"
  print_yalc_reminder
  echo "→ yalc publish --push @heybray/${pkg}"
  (cd "$dir" && yalc publish --push)
}

sync_all() {
  local pkg
  for pkg in "${FEATURE_PKGS[@]}"; do
    publish_pkg "$pkg"
  done
}

sync_named() {
  local pkg
  for pkg in "$@"; do
    is_feature_pkg "$pkg" || die "unknown feature package '${pkg}' (expected: ${FEATURE_PKGS[*]})"
    publish_pkg "$pkg"
  done
}

cmd_link() {
  local target
  target="$(resolve_target_path "$1")"
  echo "Linking scenarios-server + scenarios-client into ${target}"
  (
    cd "$target"
    yalc add @heybray/scenarios-server @heybray/scenarios-client
    npm install
  )
}

cmd_unlink() {
  local target
  target="$(resolve_target_path "$1")"
  (
    cd "$target"
    yalc remove --all
    npm install
  )
}

cmd_status() {
  local target
  target="$(resolve_target_path "$1")"
  echo "Consumer: ${target}"
  if grep -qE '\.yalc|file:\.yalc' "$target/package.json" 2>/dev/null; then
    echo "package.json yalc entries:"
    grep -E '@heybray/scenarios-|\.yalc|file:\.yalc' "$target/package.json" || true
  else
    echo "package.json: no yalc-linked scenarios packages"
  fi
  if [ -d "$target/.yalc" ]; then
    echo ".yalc/:"
    ls -1 "$target/.yalc" 2>/dev/null || true
  else
    echo ".yalc/: (absent)"
  fi
}

main() {
  case "${1:-}" in
    -h|--help)
      usage
      ;;
    --link)
      [ $# -ge 2 ] || die "--link requires a path or shortcut name"
      cmd_link "$2"
      ;;
    --unlink)
      [ $# -ge 2 ] || die "--unlink requires a path or shortcut name"
      cmd_unlink "$2"
      ;;
    --status)
      [ $# -ge 2 ] || die "--status requires a path or shortcut name"
      cmd_status "$2"
      ;;
    "")
      sync_all
      ;;
    *)
      sync_named "$@"
      ;;
  esac
}

main "$@"
