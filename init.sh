#!/usr/bin/env bash
# init.sh -- Verify the project builds cleanly before starting work.
# Run this after cloning or when resuming work.
set -euo pipefail

echo "=== Project 06 Capstone Init ==="
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
