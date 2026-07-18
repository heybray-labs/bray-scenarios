#!/usr/bin/env bash
set -euo pipefail

fail() { echo "GUARD FAILED: $1" >&2; exit 1; }

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# 1. yalc must never reach committed manifests (package.json AND lockfile)
if grep -rn --include='package.json' --include='package-lock.json' \
     -e '\.yalc' . --exclude-dir=node_modules --exclude-dir=.yalc -l >/dev/null 2>&1; then
  fail "yalc reference in a committed manifest — run: yalc remove --all && npm install"
fi

# 2. no deep imports bypassing package exports
if grep -rn --include='*.ts' --include='*.tsx' \
     -E "from ['\"][^'\"]*node_modules/@heybray|import\\(['\"][^'\"]*node_modules/@heybray" \
     --exclude-dir=node_modules . >/dev/null 2>&1; then
  fail "deep import into node_modules/@heybray — use the package's public exports"
fi

# 3. shipped migrations are immutable (new files fine; edits to pre-existing ones fail)
BASE_REF="origin/${GITHUB_BASE_REF:-main}"
git fetch -q origin "${GITHUB_BASE_REF:-main}" 2>/dev/null || true
BASE=$(git merge-base HEAD "$BASE_REF" 2>/dev/null || echo "")
if [ -n "$BASE" ]; then
  for dir in server/drizzle drizzle; do
    [ -d "$dir" ] || continue
    while IFS= read -r f; do
      [ -z "$f" ] && continue
      if git cat-file -e "$BASE:$f" 2>/dev/null; then
        fail "shipped migration modified: $f (migrations are append-only)"
      fi
    done < <(git diff --name-only --diff-filter=M "$BASE" -- "$dir"/*.sql 2>/dev/null)
  done
fi

# 4. feature packages must not import app shell
if grep -rn --include='*.ts' --include='*.tsx' \
     -e '@shared' \
     packages/*/src >/dev/null 2>&1; then
  fail "packages/*/src imports @shared — feature packages must not depend on app shell"
fi

for pattern in \
  'from "server/' "from 'server/" \
  'from "client/' "from 'client/" \
  'from "src/' "from 'src/"; do
  if grep -rn --include='*.ts' --include='*.tsx' \
       -e "$pattern" \
       packages/*/src >/dev/null 2>&1; then
    fail "packages/*/src imports app shell path ($pattern)"
  fi
done

echo "guards: OK"
