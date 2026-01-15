#!/bin/bash

set -euo pipefail

PID_FILE="/tmp/fern-services.json"

if [ ! -f "$PID_FILE" ]; then
    echo "ERROR: PID file not found at $PID_FILE"
    exit 1
fi

# Read PIDs from JSON file using jq
POSTGRES_PID=$(jq -r '.postgres_pid' "$PID_FILE")
MEILI_PID=$(jq -r '.meili_pid' "$PID_FILE")
MINIO_PID=$(jq -r '.minio_pid' "$PID_FILE")
JAEGER_PID=$(jq -r '.jaeger_pid' "$PID_FILE")
FDR_PID=$(jq -r '.fdr_pid' "$PID_FILE")
DOCS_PID=$(jq -r '.docs_pid' "$PID_FILE")
CACHE_PROXY_PID=$(jq -r '.cache_proxy_pid // 0' "$PID_FILE")

is_process_alive() {
    local pid=$1
    local service_name=$2

    if [ -z "$pid" ] || [ "$pid" = "0" ]; then
        echo "ERROR: No PID found for $service_name"
        return 1
    fi

    # Use kill -0 to check if process exists (more portable than ps -p)
    if kill -0 "$pid" 2>/dev/null; then
        return 0
    else
        echo "ERROR: $service_name (PID: $pid) is not running"
        return 1
    fi
}

FAILED=0

if ! is_process_alive "$POSTGRES_PID" "PostgreSQL"; then
    FAILED=1
fi

if [ -n "${MEILI_PID:-}" ]; then
    if ! is_process_alive "$MEILI_PID" "MeiliSearch"; then
        echo "WARNING: MeiliSearch is not running (non-critical)"
    fi
fi

# Only check Jaeger if ENABLE_JAEGER=true and PID is set
if [ "${ENABLE_JAEGER:-false}" = "true" ] && [ -n "${JAEGER_PID:-}" ] && [ "$JAEGER_PID" != "0" ]; then
    if ! is_process_alive "$JAEGER_PID" "Jaeger"; then
        echo "WARNING: Jaeger is not running (non-critical, tracing may not work)"
    fi
fi

if ! is_process_alive "$MINIO_PID" "MinIO"; then
    FAILED=1
fi

if ! is_process_alive "$FDR_PID" "FDR"; then
    FAILED=1
fi

if ! is_process_alive "$DOCS_PID" "Next.js Docs"; then
    FAILED=1
fi

if [ -n "${CACHE_PROXY_PID:-}" ] && [ "$CACHE_PROXY_PID" != "0" ]; then
    if ! is_process_alive "$CACHE_PROXY_PID" "Cache Proxy"; then
        FAILED=1
    fi
fi

if [ $FAILED -eq 1 ]; then
    echo "Liveness check FAILED: One or more critical services are not running"
    exit 1
fi

echo "Liveness check PASSED: All critical services are running"
exit 0
