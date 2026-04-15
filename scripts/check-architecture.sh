#!/usr/bin/env bash
#
# check-architecture.sh — Verify Electron layer boundaries for Agent Profile.
#
# Enforces the contract documented in docs/ARCHITECTURE.md:
#
#   1. Renderer (src/renderer/) — no Node core, no `electron`, no main/preload imports.
#   2. Main     (src/main/)     — no React, no renderer imports.
#   3. Shared   (src/shared/)   — pure TypeScript: no Node, no electron, no React.
#   4. Preload  (src/preload/)  — only `electron` + relative shared/ imports.
#
# Exit 0 = all checks pass. Exit 1 = violations found.

set -euo pipefail

cd "$(dirname "$0")/.."

VIOLATIONS=0

report() {
  echo "  [FAIL] $1"
  VIOLATIONS=$((VIOLATIONS + 1))
}

scan_files() {
  # Usage: scan_files <root> <pattern...>
  local root="$1"
  shift
  find "$root" -type f \( "$@" \) ! -path '*/node_modules/*' 2>/dev/null || true
}

echo "=== Architecture Boundary Checks ==="
echo ""

# ---------------------------------------------------------------------------
# 1. Renderer — browser context, never touches Node APIs or main/preload.
# ---------------------------------------------------------------------------
echo "[1/4] Renderer (src/renderer/)"
RENDERER=$(scan_files src/renderer -name '*.ts' -o -name '*.tsx')
if [ -n "$RENDERER" ]; then
  while IFS= read -r file; do
    if grep -nE "from[[:space:]]+['\"](fs|path|os|child_process|fs/promises|node:[a-z_]+)['\"]" "$file" >/dev/null; then
      report "$file imports Node core module (renderer must use window.electronAPI)"
    fi
    if grep -nE "from[[:space:]]+['\"]electron['\"]" "$file" >/dev/null; then
      report "$file imports 'electron' directly (use callElectron + electronAPI)"
    fi
    if grep -nE "from[[:space:]]+['\"](\.\./)+main(/|['\"])" "$file" >/dev/null; then
      report "$file reaches into src/main/ (cross the IPC boundary instead)"
    fi
    if grep -nE "from[[:space:]]+['\"](\.\./)+preload(/|['\"])" "$file" >/dev/null; then
      report "$file reaches into src/preload/ (import from @shared/types instead)"
    fi
  done <<< "$RENDERER"
fi

# ---------------------------------------------------------------------------
# 2. Main — Node.js process, never imports React or renderer files.
# ---------------------------------------------------------------------------
echo "[2/4] Main (src/main/)"
MAIN=$(scan_files src/main -name '*.ts')
if [ -n "$MAIN" ]; then
  while IFS= read -r file; do
    if grep -nE "from[[:space:]]+['\"]react(-dom)?(/[a-z-]+)?['\"]" "$file" >/dev/null; then
      report "$file imports React (main is a Node.js process)"
    fi
    if grep -nE "from[[:space:]]+['\"](\.\./)+renderer(/|['\"])" "$file" >/dev/null; then
      report "$file reaches into src/renderer/ (cross the IPC boundary instead)"
    fi
  done <<< "$MAIN"
fi

# ---------------------------------------------------------------------------
# 3. Shared — pure TypeScript: no runtime libraries, no sibling layers.
#    Tests under __tests__/ are excluded so they can use vitest utilities.
# ---------------------------------------------------------------------------
echo "[3/4] Shared (src/shared/)"
SHARED=$(find src/shared -type f -name '*.ts' ! -path '*/__tests__/*' 2>/dev/null || true)
if [ -n "$SHARED" ]; then
  while IFS= read -r file; do
    if grep -nE "from[[:space:]]+['\"](fs|path|os|child_process|fs/promises|node:[a-z_]+|electron|react(-dom)?)['\"]" "$file" >/dev/null; then
      report "$file breaks shared/ purity (no Node/Electron/React allowed)"
    fi
    if grep -nE "from[[:space:]]+['\"](\.\./)+(renderer|main|preload)(/|['\"])" "$file" >/dev/null; then
      report "$file imports from a sibling layer (shared must stand alone)"
    fi
  done <<< "$SHARED"
fi

# ---------------------------------------------------------------------------
# 4. Preload — only `electron` and relative shared/ imports.
# ---------------------------------------------------------------------------
echo "[4/4] Preload (src/preload/)"
PRELOAD=$(scan_files src/preload -name '*.ts')
if [ -n "$PRELOAD" ]; then
  while IFS= read -r file; do
    if grep -nE "from[[:space:]]+['\"](fs|path|os|child_process|fs/promises|node:[a-z_]+|react(-dom)?)['\"]" "$file" >/dev/null; then
      report "$file imports Node core or React (preload must stay minimal)"
    fi
    # Any import that is not 'electron' and not a relative path is suspicious.
    BAD=$(grep -nE "^[[:space:]]*import[[:space:]].*from[[:space:]]+['\"][^.'\"]*['\"]" "$file" \
          | grep -vE "from[[:space:]]+['\"]electron['\"]" || true)
    if [ -n "$BAD" ]; then
      while IFS= read -r line; do
        [ -z "$line" ] || report "$file has non-electron absolute import — ${line}"
      done <<< "$BAD"
    fi
  done <<< "$PRELOAD"
fi

echo ""
echo "=== Summary ==="
if [ "$VIOLATIONS" -gt 0 ]; then
  echo "FAIL: $VIOLATIONS violation(s) found"
  exit 1
fi
echo "PASS: All architecture boundary checks passed"
exit 0
