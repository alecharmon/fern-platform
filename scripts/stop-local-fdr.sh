#!/bin/bash
set -e

# Script to stop local FDR infrastructure

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLATFORM_ROOT="$(dirname "$SCRIPT_DIR")"
FDR_DIR="$PLATFORM_ROOT/servers/fdr"

echo "🛑 Stopping local FDR infrastructure..."
echo ""

cd "$FDR_DIR"

# Stop Docker infrastructure
docker compose -f docker-compose.local.yml down

echo ""
echo "✅ Local FDR infrastructure stopped!"
echo ""
echo "📝 Stopped services:"
echo "  - PostgreSQL"
echo "  - Redis"
echo "  - S3 Mock"
echo ""
echo "💡 To start again, run: pnpm fdr:dev"
