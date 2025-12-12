#!/bin/bash

set -euo pipefail

check_http_endpoint() {
    local url=$1
    local service_name=$2
    local max_attempts=${3:-1}
    
    for attempt in $(seq 1 $max_attempts); do
        if curl -f -s --max-time 30 "$url" > /dev/null 2>&1; then
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
    if pg_isready -h /tmp -p 5432 > /dev/null 2>&1; then
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

# Check Next.js Docs with optional BASE_PATH
NEXTJS_URL="http://localhost:3000${NEXT_PUBLIC_BASE_PATH:-}"
if ! check_http_endpoint "$NEXTJS_URL" "Next.js Docs"; then
    FAILED=1
fi

# Check if cache warmup is complete (ensures first request after ready is fast)
# Skip warmup check if SKIP_WARMUP is set
if [ "${SKIP_WARMUP:-false}" != "true" ]; then
    if ! check_warmup_complete; then
        FAILED=1
    fi
fi

if [ $FAILED -eq 1 ]; then
    echo "Readiness check FAILED: One or more critical services are not ready"
    exit 1
fi

echo "Readiness check PASSED: All critical services are ready"
exit 0
