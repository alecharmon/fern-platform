#!/bin/bash

set -euo pipefail

check_http_endpoint() {
    local url=$1
    local service_name=$2
    local max_attempts=${3:-1}
    local timeout=${4:-5}
    
    for attempt in $(seq 1 $max_attempts); do
        if curl -f -s --max-time "$timeout" "$url" > /dev/null 2>&1; then
            echo "✓ $service_name is ready"
            return 0
        fi
        
        if [ $attempt -lt $max_attempts ]; then
            sleep 1
        fi
    done
    
    echo "✗ $service_name is not ready (URL: $url)"
    return 1
}

check_postgres() {
    # Read the PostgreSQL socket directory from the file written by run.sh
    # This supports UID-scoped directories used for non-root compatibility
    local pg_socket_dir="/tmp"
    if [ -f /tmp/postgres-socket-dir ]; then
        pg_socket_dir=$(cat /tmp/postgres-socket-dir)
    fi
    
    if pg_isready -h "$pg_socket_dir" -p 5432 > /dev/null 2>&1; then
        echo "✓ PostgreSQL is ready"
        return 0
    else
        echo "✗ PostgreSQL is not ready"
        return 1
    fi
}

check_warmup_complete() {
    local warmup_file="/tmp/warmup-complete"
    
    if [ -f "$warmup_file" ]; then
        echo "✓ Cache warmup is complete"
        return 0
    else
        echo "✗ Cache warmup not yet complete (waiting for $warmup_file)"
        return 1
    fi
}

check_docs_generation() {
    local status_file="/tmp/docs-generation-status"
    
    if [ ! -f "$status_file" ]; then
        echo "✗ Docs generation not yet complete (waiting for $status_file)"
        return 1
    fi
    
    local status=$(jq -r '.status' "$status_file" 2>/dev/null || echo "unknown")
    
    if [ "$status" = "success" ]; then
        echo "✓ Docs generation completed successfully"
        return 0
    elif [ "$status" = "failed" ]; then
        local reason=$(jq -r '.reason' "$status_file" 2>/dev/null || echo "unknown")
        echo "✗ Docs generation failed (reason: $reason)"
        echo "  Check container logs for details and troubleshooting steps"
        return 1
    else
        echo "✗ Docs generation status unknown: $status"
        return 1
    fi
}

FAILED=0

if ! check_postgres; then
    FAILED=1
fi

if ! check_http_endpoint "http://localhost:9000/minio/health/live" "MinIO"; then
    FAILED=1
fi

if ! check_http_endpoint "http://localhost:7700/health" "MeiliSearch"; then
    echo "WARNING: MeiliSearch is not ready (non-critical, search may not work)"
fi

# Only check Jaeger if ENABLE_JAEGER=true
if [ "${ENABLE_JAEGER:-false}" = "true" ]; then
    if ! check_http_endpoint "http://localhost:16686/" "Jaeger"; then
        echo "WARNING: Jaeger is not ready (non-critical, tracing may not work)"
    fi
fi

if ! check_http_endpoint "http://localhost:8080/health" "FDR"; then
    FAILED=1
fi

# Check if docs generation completed successfully
# This is critical - if docs generation failed (e.g., due to egress restrictions), the site won't work
if ! check_docs_generation; then
    FAILED=1
fi

# Check Next.js Docs with optional BASE_PATH
NEXTJS_URL="http://localhost:3000${NEXT_PUBLIC_BASE_PATH:-}"
if ! check_http_endpoint "$NEXTJS_URL" "Next.js Docs"; then
    FAILED=1
fi

# Note: Cache warmup runs in background and does not block readiness
# The container is ready for traffic as soon as core services are up
# Warmup is a performance optimization, not a requirement for readiness

if [ $FAILED -eq 1 ]; then
    echo "Readiness check FAILED: One or more critical services are not ready"
    exit 1
fi

echo "Readiness check PASSED: All critical services are ready"
exit 0
