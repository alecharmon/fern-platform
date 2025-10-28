#!/bin/bash
set -e

# Script to generate fdr-cjs-sdk locally for testing

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLATFORM_ROOT="$(dirname "$SCRIPT_DIR")"
OUTPUT_DIR="$PLATFORM_ROOT/.local-sdk-output/fdr-cjs-sdk"

echo "🏗️  Generating fdr-cjs-sdk locally..."
echo ""
echo "Platform root: $PLATFORM_ROOT"
echo "Output directory: $OUTPUT_DIR"
echo ""

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Generate using the local-fdr-cjs-sdk group
echo "📦 Running Fern generate..."
cd "$PLATFORM_ROOT"
pnpm fern generate --api fdr --group local-fdr-cjs-sdk --local

# Create package.json for the generated SDK
echo ""
echo "📝 Creating package.json..."
cat > "$OUTPUT_DIR/package.json" << 'EOF'
{
  "name": "@fern-fern/fdr-cjs-sdk",
  "version": "0.0.0-local",
  "private": false,
  "main": "./index.js",
  "types": "./index.d.ts",
  "dependencies": {
    "url-join": "4.0.1",
    "form-data": "^4.0.0",
    "formdata-node": "^6.0.3",
    "node-fetch": "^2.7.0",
    "qs": "^6.13.1",
    "readable-stream": "^4.5.2",
    "js-base64": "3.7.7"
  },
  "devDependencies": {
    "typescript": "~5.7.2"
  }
}
EOF

echo ""
echo "✅ Generated fdr-cjs-sdk to: $OUTPUT_DIR"
