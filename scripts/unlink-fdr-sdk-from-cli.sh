#!/bin/bash
set -e

# Script to unlink local FDR SDK from the Fern CLI and restore published versions

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLATFORM_ROOT="$(dirname "$SCRIPT_DIR")"
CLI_ROOT="$(dirname "$PLATFORM_ROOT")/fern"

echo "🔗 Unlinking local FDR SDK from Fern CLI..."
echo ""
echo "CLI root: $CLI_ROOT"
echo ""

# Check if CLI directory exists
if [ ! -d "$CLI_ROOT" ]; then
    echo "❌ Error: Fern CLI directory not found at $CLI_ROOT"
    exit 1
fi

cd "$CLI_ROOT"

# Remove pnpm overrides from package.json
if command -v node > /dev/null 2>&1; then
    node -e "
const fs = require('fs');
const path = require('path');
const pkgPath = path.join('$CLI_ROOT', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

if (pkg.pnpm && pkg.pnpm.overrides) {
    delete pkg.pnpm.overrides['@fern-fern/fdr-cjs-sdk'];
    delete pkg.pnpm.overrides['@fern-api/fdr-sdk'];
    delete pkg.pnpm.overrides['@fern-api/ui-core-utils'];

    // Clean up empty objects
    if (Object.keys(pkg.pnpm.overrides).length === 0) {
        delete pkg.pnpm.overrides;
    }
    if (Object.keys(pkg.pnpm).length === 0) {
        delete pkg.pnpm;
    }
}

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log('✅ Removed pnpm overrides from package.json');
"
fi

# Reinstall dependencies to restore published versions
echo ""
echo "📥 Reinstalling CLI dependencies with published FDR SDK versions..."
pnpm install

# Clean up any temporary tarballs
echo ""
echo "🧹 Cleaning up temporary files..."
rm -f /tmp/fern-api-fdr-sdk-*.tgz
rm -f /tmp/fern-api-ui-core-utils-*.tgz
rm -f /tmp/fern-fern-fdr-cjs-sdk-*.tgz

echo ""
echo "✅ Successfully unlinked local FDR SDK from CLI!"
echo "   CLI is now using published versions from npm."
