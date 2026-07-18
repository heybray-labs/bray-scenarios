#!/usr/bin/env bash
# Fail if yalc local links leaked into committed npm manifests.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# yalc add rewrites package.json; stale lockfile sections can linger after remove.
MANIFESTS=(package.json package-lock.json)
PATTERN='\.yalc/|file:\.yalc|"\.yalc|yalc\.lock'

FOUND=0
for file in "${MANIFESTS[@]}"; do
  if [[ ! -f "$file" ]]; then
    continue
  fi
  if grep -qE "$PATTERN" "$file"; then
    echo "ERROR: yalc reference in $file"
    grep -nE "$PATTERN" "$file" || true
    FOUND=1
  fi
done

if [[ "$FOUND" -ne 0 ]]; then
  echo ""
  echo "Remove yalc links before commit: yalc remove <package> && npm install"
  exit 1
fi

echo "OK: no yalc references in package.json / package-lock.json"
