#!/bin/bash
# Comprehensive TypeScript type check script
# Checks key packages that should have no TypeScript errors
#
# Options:
#   --clean       Force clean stale build caches before checking
#   --no-clean    Skip cleaning (default on CI)
#
# By default, cleans caches when running locally but not on CI.

set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Detect CI environment (GitHub Actions, GitLab CI, CircleCI, Jenkins, etc.)
is_ci() {
    [[ -n "${CI:-}" ]] || [[ -n "${GITHUB_ACTIONS:-}" ]]
}

# Parse arguments
CLEAN_CACHES=""
for arg in "$@"; do
    case $arg in
        --clean)
            CLEAN_CACHES="true"
            ;;
        --no-clean)
            CLEAN_CACHES="false"
            ;;
    esac
done

# Default: clean locally, don't clean on CI
if [[ -z "$CLEAN_CACHES" ]]; then
    if is_ci; then
        CLEAN_CACHES="false"
    else
        CLEAN_CACHES="true"
    fi
fi

if [[ "$CLEAN_CACHES" == "true" ]]; then
    echo "🧹 Cleaning stale build caches..."

    # Remove .next directories (auto-generated types can become stale)
    rm -rf "$REPO_ROOT/packages/fern-dashboard/.next"
    rm -rf "$REPO_ROOT/packages/fern-docs/bundle/.next"

    # Recompile dependencies to ensure types are up to date
    echo "📦 Recompiling packages..."
    cd "$REPO_ROOT"
    pnpm compile > /dev/null 2>&1 || {
        echo "⚠️  pnpm compile had issues, continuing anyway..."
    }

    # Remove TypeScript incremental build caches AFTER compile
    # (compile may recreate them with stale project reference info)
    # Search entire repo but exclude node_modules
    find "$REPO_ROOT" -path "*/node_modules" -prune -o -name "tsconfig.tsbuildinfo" -type f -delete 2>/dev/null || true
    find "$REPO_ROOT" -path "*/node_modules" -prune -o -name ".tsbuildinfo" -type f -delete 2>/dev/null || true
    rm -rf "$REPO_ROOT/node_modules/.cache" 2>/dev/null || true

    echo "✓ Caches cleaned and packages recompiled"
fi
echo ""

echo "🔍 Running TypeScript type checks..."
# Check dashboard
echo "Checking @fern-dashboard/ui..."
cd "$REPO_ROOT/packages/fern-dashboard"
if pnpm tsc --noEmit 2>&1 | grep -E "error TS"; then
    echo "❌ Dashboard has TypeScript errors"
    exit 1
fi
echo "✓ Dashboard: No errors"
echo ""

echo "Checking @fern-docs/bundle"
cd "$REPO_ROOT/packages/fern-docs/bundle"
if pnpm tsc --noEmit 2>&1 | grep -E "error TS"; then
    echo "❌ Bundle has TypeScript errors"
    exit 1
fi
echo "✓ Bundle: No errors"
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

# Check search-ui
echo "Checking @fern-docs/search-ui..."
cd "$REPO_ROOT/packages/fern-docs/search-ui"
if pnpm tsc --noEmit 2>&1 | grep -E "error TS"; then
    echo "❌ Search UI has TypeScript errors"
    exit 1
fi
echo "✓ Search UI: No errors"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All TypeScript checks passed!"
