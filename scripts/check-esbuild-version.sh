#!/bin/bash
set -e

EXPECTED_VERSION="0.27.3"
PACKAGE_JSON="packages/fern-docs/bundle/package.json"

echo "Checking esbuild version in $PACKAGE_JSON..."

# Extract esbuild version from package.json
ACTUAL_VERSION=$(node -e "const pkg = require('./packages/fern-docs/bundle/package.json'); console.log(pkg.dependencies.esbuild || pkg.devDependencies.esbuild || '')")

if [ -z "$ACTUAL_VERSION" ]; then
    echo "❌ ERROR: esbuild not found in $PACKAGE_JSON"
    exit 1
fi

# Remove any version prefix characters (^, ~, etc.) for comparison
ACTUAL_VERSION_CLEAN=$(echo "$ACTUAL_VERSION" | sed 's/^[\^~]//')

if [ "$ACTUAL_VERSION_CLEAN" != "$EXPECTED_VERSION" ]; then
    echo "❌ ERROR: esbuild version mismatch!"
    echo ""
    echo "Expected: $EXPECTED_VERSION"
    echo "Found:    $ACTUAL_VERSION"
    echo ""
    echo "⚠️  IMPORTANT: The esbuild version is hard-coded in multiple locations:"
    echo "  - packages/fern-docs/bundle/package.json (dependencies.esbuild)"
    echo "  - packages/fern-docs/bundle/package.json (scripts.docs:rewrite:local:esbuild)"
    echo "  - servers/self-hosted/Dockerfile.self_hosted (npm i -g esbuild@...)"
    echo ""
    echo "If you need to update esbuild, you must update ALL of these locations."
    exit 1
fi

echo "✅ esbuild version is correctly pinned at $EXPECTED_VERSION"
