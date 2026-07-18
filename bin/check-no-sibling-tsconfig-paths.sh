#!/usr/bin/env bash
# Fail if tsconfig paths alias into a sibling repo checkout (splits @heybray singletons).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

FOUND=0

while IFS= read -r line; do
  [ -z "$line" ] && continue
  echo "ERROR: $line"
  FOUND=1
done < <(
  grep -rn --include='tsconfig*.json' -E '\.\./bray-' . --exclude-dir=node_modules 2>/dev/null || true
)

if [ -f tsconfig.json ]; then
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    echo "ERROR: $line"
    FOUND=1
  done < <(
    grep -nE '"\.\./' tsconfig.json 2>/dev/null || true
  )
fi

if [ "$FOUND" -ne 0 ]; then
  echo ""
  echo "Remove tsconfig paths into sibling repos — resolve @heybray/* via node_modules (npm pin or yalc copy)."
  exit 1
fi

echo "OK: no sibling-repo tsconfig paths"
