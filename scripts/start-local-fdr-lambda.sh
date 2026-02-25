#!/bin/bash
set -e

# Script to start FDR Lambda server locally for testing
# This runs the Lambda endpoints as a local Express server

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLATFORM_ROOT="$(dirname "$SCRIPT_DIR")"
FDR_LAMBDA_DIR="$PLATFORM_ROOT/servers/fdr-lambda"

echo "🚀 Starting local FDR Lambda server..."
echo ""
echo "Platform root: $PLATFORM_ROOT"
echo "FDR Lambda directory: $FDR_LAMBDA_DIR"
echo ""

# Check if FDR Lambda directory exists
if [ ! -d "$FDR_LAMBDA_DIR" ]; then
    echo "❌ Error: FDR Lambda directory not found at $FDR_LAMBDA_DIR"
    exit 1
fi

cd "$FDR_LAMBDA_DIR"

# Set environment variables for local mode (same as FDR)
export LOCAL_MODE_OVERRIDE=true
export DATABASE_URL="postgresql://fdr:fdr1!@localhost:5432/fdr?schema=public"
export AWS_ACCESS_KEY_ID=fern_admin
export AWS_SECRET_ACCESS_KEY=fern_admin
export PUBLIC_DOCS_S3_BUCKET_NAME=fdr
export PUBLIC_DOCS_S3_BUCKET_REGION=us-east-1
export PRIVATE_DOCS_S3_BUCKET_NAME=fdr
export PRIVATE_DOCS_S3_BUCKET_REGION=us-east-1
export DB_DOCS_DEFINITION_BUCKET_NAME=fdr
export DB_DOCS_DEFINITION_BUCKET_REGION=us-east-1
export PUBLIC_DOCS_CDN_URL=http://localhost:9090
export AWS_REGION=us-east-1

echo "✅ Environment configured!"
echo ""
echo "🚀 Starting FDR Lambda server on http://localhost:8081..."
echo ""
echo "💡 Make sure the following are running:"
echo "  - FDR server on http://localhost:8080 (run: pnpm fdr:dev)"
echo "  - Docker infrastructure (PostgreSQL, Redis, S3 Mock)"
echo ""

# Start FDR Lambda in development mode (exec replaces shell to keep logs streaming)
exec pnpm dev:server
