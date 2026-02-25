#!/bin/bash
set -e

# Script to start FDR server locally for testing
# This sets up the full local FDR environment (Postgres, Redis, S3 Mock, FDR server)
# Usage: ./start-local-fdr.sh [log_level]
#   log_level: optional, defaults to "info" (options: error, warn, info, debug, verbose, silly)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLATFORM_ROOT="$(dirname "$SCRIPT_DIR")"
FDR_DIR="$PLATFORM_ROOT/servers/fdr"

# Get log level from first argument, default to "info"
LOG_LEVEL="${1:-info}"

echo "🚀 Starting local FDR server..."
echo ""
echo "Platform root: $PLATFORM_ROOT"
echo "FDR directory: $FDR_DIR"
echo ""

# Check if FDR directory exists
if [ ! -d "$FDR_DIR" ]; then
    echo "❌ Error: FDR directory not found at $FDR_DIR"
    exit 1
fi

cd "$FDR_DIR"

# Step 1: Start Docker infrastructure
echo "📦 Starting Docker infrastructure (Postgres, Redis, S3 Mock)..."
docker compose -f docker-compose.local.yml up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 5

# Step 1.5: Ensure local SQS queue exists (LocalStack)
echo ""
echo "📨 Ensuring local SQS queue exists (LocalStack)..."
if docker ps --format '{{.Names}}' | grep -q '^fdr-localstack-1$'; then
    # LocalStack can take a moment to become ready after container start.
    for i in {1..10}; do
        if docker exec fdr-localstack-1 awslocal sqs create-queue \
            --queue-name pdf-export-queue.fifo \
            --attributes FifoQueue=true,ContentBasedDeduplication=false >/dev/null 2>&1; then
            echo "✅ SQS queue ready: pdf-export-queue.fifo"
            break
        fi
        if [ "$i" -eq 10 ]; then
            echo "⚠️  Failed to create SQS queue in LocalStack after retries. PDF export enqueuing may fail locally."
        else
            sleep 1
        fi
    done
else
    echo "⚠️  LocalStack container not found (fdr-localstack-1). PDF export enqueuing may fail locally."
fi

# Step 2: Check if migrations are needed
echo ""
echo "🔧 Running database migrations..."
pnpm db:migrate:local

# Step 3: Start FDR server
echo ""
echo "✅ Infrastructure is ready!"
echo ""
echo "📝 Services running:"
echo "  - PostgreSQL:     localhost:5432"
echo "  - Redis:          localhost:6379"
echo "  - S3 Mock:        localhost:9090 (API), localhost:9191 (UI)"
echo "  - Python Lambda:  localhost:9001"
echo ""
echo "🚀 Starting FDR server on http://localhost:8080..."
echo ""
echo "💡 To stop infrastructure, run: cd $FDR_DIR && docker compose -f docker-compose.local.yml down"
echo ""

# Start FDR in development mode
# Set environment variables for local mode (using S3 Mock)
export LOCAL_MODE_OVERRIDE=true
export DATABASE_URL="postgresql://fdr:fdr1!@localhost:5432/fdr?schema=public"
export S3_ACCESS_KEY=fern_admin
export S3_SECRET_KEY=fern_admin
export S3_ENDPOINT=http://localhost:9090
export S3_BUCKET_NAME=fdr
export S3_FORCE_PATH_STYLE=true
export LOG_LEVEL="$LOG_LEVEL"

# Python library docs Lambda (local Docker RIE)
export PYTHON_LIBRARY_DOCS_LAMBDA_FUNCTION_NAME=function
export PYTHON_LIBRARY_DOCS_LAMBDA_REGION=us-east-1
export PYTHON_LIBRARY_DOCS_LAMBDA_ENDPOINT=http://localhost:9001
# Dummy AWS credentials for local Lambda invocation (Docker RIE doesn't verify)
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test

export RESEND_API_KEY=dummy

# PDF export (SQS + internal callbacks)
export PDF_EXPORT_SQS_REGION=us-east-1
export PDF_EXPORT_SQS_QUEUE_URL=http://localhost:4566/000000000000/pdf-export-queue.fifo
# Used to validate service-to-service JWTs on callback endpoints (local/dev only)
export PDF_EXPORT_JWT_SECRET_KEY=local-dev-pdf-export-jwt-secret

echo "🔍 Log level set to: $LOG_LEVEL"
echo ""

# Build CJS bundle (required due to ESM/tsx compatibility issues with generated code)
echo "📦 Building CJS bundle..."
pnpm build:tsup:cjs

echo ""
echo "🚀 Starting server..."
node cjs/server.cjs
