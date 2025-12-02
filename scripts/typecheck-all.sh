#!/bin/bash
# Comprehensive TypeScript type check script for CI
# Checks key packages that should have no TypeScript errors

set -e

echo "🔍 Running TypeScript type checks..."
echo ""

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Check dashboard
echo "Checking @fern-dashboard/ui..."
cd "$REPO_ROOT/packages/fern-dashboard"
if pnpm tsc --noEmit 2>&1 | grep -E "error TS"; then
    echo "❌ Dashboard has TypeScript errors"
    exit 1
fi
echo "✓ Dashboard: No errors"
echo ""

# Check bundle (excluding search-ui and .next generated files)
echo "Checking @fern-docs/bundle (excluding search-ui and .next)..."
cd "$REPO_ROOT/packages/fern-docs/bundle"
if pnpm tsc --noEmit 2>&1 | grep -v "^../search-ui/" | grep -v "^\.next/" | grep -E "error TS"; then
    echo "❌ Bundle has TypeScript errors"
    exit 1
fi
echo "✓ Bundle: No errors (excluding search-ui and .next)"
echo ""

# Check components
echo "Checking @fern-docs/components..."
cd "$REPO_ROOT/packages/fern-docs/components"
if pnpm tsc --noEmit 2>&1 | grep -E "error TS"; then
    echo "❌ Components has TypeScript errors"
    exit 1
fi
echo "✓ Components: No errors"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All TypeScript checks passed!"
