#!/bin/bash
set -e

# Script to link local FDR SDK to the Fern CLI for local testing
# This allows you to test FDR SDK changes in the CLI without publishing

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLATFORM_ROOT="$(dirname "$SCRIPT_DIR")"
CLI_ROOT="$(dirname "$PLATFORM_ROOT")/fern"
FDR_SDK_PATH="$PLATFORM_ROOT/packages/fdr-sdk"
UI_CORE_UTILS_PATH="$PLATFORM_ROOT/packages/commons/core-utils"

echo "🔗 Linking local FDR SDK to Fern CLI..."
echo ""
echo "Platform root: $PLATFORM_ROOT"
echo "CLI root: $CLI_ROOT"
echo "FDR SDK path: $FDR_SDK_PATH"
echo ""

# Check if CLI directory exists
if [ ! -d "$CLI_ROOT" ]; then
    echo "❌ Error: Fern CLI directory not found at $CLI_ROOT"
    exit 1
fi

# Step 1: Build the local FDR SDK and ui-core-utils
echo "📦 Building local FDR SDK and dependencies..."
cd "$PLATFORM_ROOT"
pnpm turbo --filter=@fern-api/ui-core-utils compile
pnpm turbo --filter=@fern-api/fdr-sdk compile

# Step 2: Pack ui-core-utils first
echo ""
echo "📦 Creating ui-core-utils package tarball..."
cd "$UI_CORE_UTILS_PATH"

# Clean up any old tarballs first
rm -f /tmp/fern-api-ui-core-utils-*.tgz

# Use npm pack instead of pnpm pack
npm pack --pack-destination /tmp > /dev/null 2>&1

# Find the created tarball
UI_CORE_UTILS_TARBALL=$(ls -t /tmp/fern-api-ui-core-utils-*.tgz 2>/dev/null | head -1)

if [ -z "$UI_CORE_UTILS_TARBALL" ]; then
    echo "❌ Error: Failed to create ui-core-utils tarball"
    exit 1
fi

echo "✅ Created ui-core-utils tarball: $UI_CORE_UTILS_TARBALL"

# Step 3: Temporarily rewrite FDR SDK's package.json to use the tarball
echo ""
echo "🔧 Rewriting FDR SDK package.json to use tarball dependency..."
cd "$FDR_SDK_PATH"

# Backup the original package.json
cp package.json package.json.backup

# Rewrite the workspace dependency to use the tarball
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.dependencies['@fern-api/ui-core-utils'] = 'file:$UI_CORE_UTILS_TARBALL';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"

# Step 4: Pack the FDR SDK into a tarball
echo ""
echo "📦 Creating FDR SDK package tarball..."

# Clean up any old tarballs first
rm -f /tmp/fern-api-fdr-sdk-*.tgz

# Use npm pack
npm pack --pack-destination /tmp > /dev/null 2>&1

# Restore the original package.json
mv package.json.backup package.json

# Find the created tarball
TARBALL=$(ls -t /tmp/fern-api-fdr-sdk-*.tgz 2>/dev/null | head -1)

if [ -z "$TARBALL" ]; then
    echo "❌ Error: Failed to create FDR SDK tarball"
    exit 1
fi

echo "✅ Created FDR SDK tarball: $TARBALL"

# Step 5: Generate and pack fdr-cjs-sdk
echo ""
echo "📦 Generating fdr-cjs-sdk locally..."
bash "$SCRIPT_DIR/generate-fdr-cjs-sdk-local.sh"

echo ""
echo "📦 Creating fdr-cjs-sdk package tarball..."
cd "$PLATFORM_ROOT/.local-sdk-output/fdr-cjs-sdk"

# Clean up any old tarballs
rm -f /tmp/fern-fern-fdr-cjs-sdk-*.tgz

# Pack the SDK
npm pack --pack-destination /tmp > /dev/null 2>&1

# Find the created tarball
CJS_TARBALL=$(ls -t /tmp/fern-fern-fdr-cjs-sdk-*.tgz 2>/dev/null | head -1)

if [ -z "$CJS_TARBALL" ]; then
    echo "❌ Error: Failed to create fdr-cjs-sdk tarball"
    exit 1
fi

echo "✅ Created fdr-cjs-sdk tarball: $CJS_TARBALL"

# Step 6: Create or update pnpm overrides in CLI
echo ""
echo "🔧 Configuring pnpm overrides in CLI..."
cd "$CLI_ROOT"

# Create or update pnpm overrides in package.json
if command -v node > /dev/null 2>&1; then
    node -e "
const fs = require('fs');
const path = require('path');
const pkgPath = path.join('$CLI_ROOT', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

if (!pkg.pnpm) {
    pkg.pnpm = {};
}
if (!pkg.pnpm.overrides) {
    pkg.pnpm.overrides = {};
}

pkg.pnpm.overrides['@fern-fern/fdr-cjs-sdk'] = 'file:$CJS_TARBALL';
pkg.pnpm.overrides['@fern-api/fdr-sdk'] = 'file:$TARBALL';
pkg.pnpm.overrides['@fern-api/ui-core-utils'] = 'file:$UI_CORE_UTILS_TARBALL';

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log('✅ Updated pnpm overrides in package.json');
"
fi

# Step 4: Reinstall dependencies in CLI
echo ""
echo "📥 Reinstalling CLI dependencies with local FDR SDK..."
pnpm install

echo ""
echo "✅ Successfully linked local FDR SDK to CLI!"
echo ""
echo "📝 Next steps:"
echo "  1. Make changes to FDR SDK in: $FDR_SDK_PATH"
echo "  2. Relink SDK: cd $PLATFORM_ROOT && pnpm fdr:link-to-cli"
echo "  3. Rebuild CLI: cd $CLI_ROOT && pnpm build"
echo "  4. Test your changes in the CLI"
echo ""
echo "⚠️  To unlink, run: $SCRIPT_DIR/unlink-fdr-sdk-from-cli.sh"
