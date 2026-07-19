#!/usr/bin/env bash
# Bust Vite's optimizeDeps cache when yalc-linked @heybray/* content changes under an
# unchanged version — `yalc push` doesn't touch package-lock.json, so Vite's normal
# lockfile-hash cache key never moves. No-op if nothing is yalc-linked.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

STAMP=".vite-yalc-sig"
SIG=""
if [ -d .yalc ]; then
  for pj in .yalc/@heybray/*/package.json; do
    [ -f "$pj" ] || continue
    s=$(node -p "require('./${pj}').yalcSig || ''" 2>/dev/null || echo "")
    [ -n "$s" ] && SIG="${SIG}${pj}=${s};"
  done
fi

if [ -n "$SIG" ] && [ "$(cat "$STAMP" 2>/dev/null || true)" != "$SIG" ]; then
  rm -rf node_modules/.vite
  echo "$SIG" > "$STAMP"
elif [ -z "$SIG" ] && [ -f "$STAMP" ]; then
  rm -f "$STAMP"
fi
