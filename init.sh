#!/usr/bin/env bash
# init.sh -- Verify the project builds cleanly before starting work.
# Run this after cloning or when resuming work.
set -euo pipefail

echo "=== Project 06 Capstone Init ==="
echo ""

# ── [0/6] Harness state check ──────────────────────────────────────────────
echo "[0/6] Harness state check..."
_missing=0
for _f in AGENTS.md feature_list.json; do
  if [[ ! -f "$_f" ]]; then
    echo "  ✗ MISSING: $_f" >&2
    _missing=1
  else
    echo "  ✓ $_f"
  fi
done
if [[ $_missing -eq 1 ]]; then
  echo "" >&2
  echo "ERROR: Required harness file(s) missing — cannot continue." >&2
  exit 1
fi
if [[ -f progress.md ]]; then
  echo ""
  echo "  ── 上次結束點 ──"
  awk '/^## 上次 Session 結束點/{f=1;next} f && /^---/{exit} f{if(NF) print "  " $0; else print ""}' progress.md
fi
echo ""

echo "[1/6] Installing dependencies..."
bun install
echo ""

echo "[2/6] Running type checks..."
bun run typecheck
echo ""

echo "[3/6] Building project..."
bun run build
echo ""

echo "[4/6] Running tests..."
bun run test
echo ""

echo "[5/6] Running lint..."
bun run lint
echo ""

echo "[6/6] Checking architecture boundaries..."
bash scripts/check-architecture.sh
echo ""

echo "=== Init complete — project is clean ==="
