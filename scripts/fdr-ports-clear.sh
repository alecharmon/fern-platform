#!/bin/bash

# Kill all processes running on ports used by `pnpm fdr:dev`
# This is a nuclear option to free up all FDR dev ports.
#
# Ports:
#   3100  auth0-mock
#   4566  localstack (SQS)
#   5432  fdr-postgres
#   5433  venus-postgres
#   6379  redis
#   8078  edge-config mock
#   8079  upstash REST mock
#   8080  FDR server (host)
#   8081  redis-commander
#   8089  venus
#   9001  python library docs parser
#   9002  cpp library docs parser
#   9090  s3-mock (API)
#   9191  s3-mock (UI)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLATFORM_ROOT="$(dirname "$SCRIPT_DIR")"
FDR_DIR="$PLATFORM_ROOT/servers/fdr"

FDR_DEV_PORTS=(3100 4566 5432 5433 6379 8078 8079 8080 8081 8089 9001 9002 9090 9191)

echo "Clearing all FDR dev ports..."
echo ""

# First, try to gracefully stop Docker Compose services
echo "Stopping Docker Compose services..."
cd "$FDR_DIR"
docker compose -f docker-compose.dev.yml down 2>/dev/null || true
echo ""

# Then kill any remaining processes on each port
KILLED=0
for PORT in "${FDR_DEV_PORTS[@]}"; do
    PIDS=$(lsof -ti :"$PORT" 2>/dev/null || true)
    if [ -n "$PIDS" ]; then
        PROC_INFO=$(lsof -i :"$PORT" -sTCP:LISTEN -P -n 2>/dev/null | tail -n +2 | head -1 | awk '{print $1}')
        echo "Killing process(es) on port $PORT (${PROC_INFO:-unknown}): PIDs $PIDS"
        echo "$PIDS" | xargs kill 2>/dev/null || true
        KILLED=$((KILLED + 1))
    fi
done

if [ "$KILLED" -eq 0 ]; then
    echo "No processes found on any FDR dev ports."
else
    # Give processes a moment to exit
    sleep 2

    # Force kill anything still hanging around
    FORCE_KILLED=0
    for PORT in "${FDR_DEV_PORTS[@]}"; do
        PIDS=$(lsof -ti :"$PORT" 2>/dev/null || true)
        if [ -n "$PIDS" ]; then
            echo "Force killing remaining process(es) on port $PORT: PIDs $PIDS"
            echo "$PIDS" | xargs kill -9 2>/dev/null || true
            FORCE_KILLED=$((FORCE_KILLED + 1))
        fi
    done

    echo ""
    echo "Killed processes on $KILLED port(s)."
fi

echo ""
echo "All FDR dev ports cleared."
