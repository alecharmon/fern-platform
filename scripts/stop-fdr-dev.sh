#!/bin/bash
set -e

# Script to stop the full FDR dev environment started by `pnpm fdr:dev`
# 1. Tears down all Docker Compose services from docker-compose.dev.yml
# 2. Kills any remaining host processes (e.g. tsx --watch on port 8080)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLATFORM_ROOT="$(dirname "$SCRIPT_DIR")"
FDR_DIR="$PLATFORM_ROOT/servers/fdr"

echo "Stopping FDR dev environment..."
echo ""

# Step 1: Tear down Docker Compose services (graceful)
echo "Stopping Docker Compose services..."
cd "$FDR_DIR"
docker compose -f docker-compose.dev.yml down 2>/dev/null || echo "No Docker Compose services to stop."

# Step 2: Kill any remaining host FDR server process (tsx --watch on port 8080)
echo ""
FDR_PIDS=$(lsof -ti :8080 2>/dev/null || true)
if [ -n "$FDR_PIDS" ]; then
    echo "Killing remaining process(es) on port 8080 (PIDs: $FDR_PIDS)..."
    echo "$FDR_PIDS" | xargs kill 2>/dev/null || true
    sleep 1
    # Force kill if still running
    REMAINING=$(lsof -ti :8080 2>/dev/null || true)
    if [ -n "$REMAINING" ]; then
        echo "Force killing remaining process(es) on port 8080..."
        echo "$REMAINING" | xargs kill -9 2>/dev/null || true
    fi
else
    echo "No remaining process found on port 8080."
fi

echo ""
echo "FDR dev environment stopped."
