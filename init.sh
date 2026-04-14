#!/usr/bin/env bash
# init.sh -- Verify the project builds cleanly before starting work.
# Run this after cloning or when resuming work.
set -euo pipefail

echo "=== Project 06 Capstone Init ==="
echo ""

echo "[1/5] Installing dependencies..."
bun install
echo ""

echo "[2/5] Running type checks..."
bun run typecheck
echo ""

echo "[3/5] Building project..."
bun run build
echo ""
