#!/bin/bash
set -euo pipefail

# Static site export script for self-hosted Fern docs.
#
# Triggers the cache proxy to dump all cached HTML pages and Next.js static
# assets into a tar.gz archive suitable for uploading to S3 or any static host.
#
# The export runs asynchronously inside the cache proxy.  This script:
#   1. POSTs to start the export
#   2. Polls the status endpoint until complete
#   3. Verifies the archive exists on disk (written directly by the export job)
#
# Prerequisites:
#   - The container must be running with all services started
#   - Cache should be warmed (WARMUP=true or manually visit pages)
#
# Usage from outside the container:
#   docker exec <container> /scripts/export.sh
#   docker cp <container>:/tmp/fern-static-export.tar.gz ./export.tar.gz
#
# Usage from inside the container:
#   /scripts/export.sh
#
# The exported tar.gz can be extracted and uploaded to S3:
#   tar -xzf fern-static-export.tar.gz -C ./site
#   aws s3 sync ./site s3://my-bucket --delete

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [export] $*"
}

BASE_PATH="${NEXT_PUBLIC_BASE_PATH:-}"
CACHE_PROXY_PORT="${CACHE_PROXY_PORT:-3000}"
TOKEN_FILE="/tmp/.cache-admin-token"
if [ -f "$TOKEN_FILE" ]; then
    ADMIN_TOKEN=$(cat "$TOKEN_FILE")
else
    ADMIN_TOKEN=""
    log "WARNING: No admin token file found at $TOKEN_FILE"
fi
OUTPUT_FILE="/tmp/fern-static-export.tar.gz"

BASE_URL="http://localhost:${CACHE_PROXY_PORT}/__cache/export"

POLL_INTERVAL=3      # seconds between status polls
MAX_POLL_ATTEMPTS=200 # ~10 minutes at 3s intervals

log "Triggering static site export..."

# Helper: curl with optional auth header
acurl() {
    if [ -n "$ADMIN_TOKEN" ]; then
        curl -H "Authorization: Bearer $ADMIN_TOKEN" "$@"
    else
        curl "$@"
    fi
}

# Check if cache proxy is running
if ! acurl -f -s --max-time 5 "http://localhost:${CACHE_PROXY_PORT}/__cache/stats" > /dev/null 2>&1; then
    log "ERROR: Cache proxy is not running on port ${CACHE_PROXY_PORT}"
    log "Make sure the container is fully started before exporting."
    exit 1
fi

# Show cache stats before export
STATS=$(acurl -s "http://localhost:${CACHE_PROXY_PORT}/__cache/stats" 2>/dev/null)
log "Cache stats: $STATS"

# 1. Kick off the export (returns immediately)
START_RESPONSE=$(acurl -s --max-time 10 -X POST "$BASE_URL")
log "Export triggered: $START_RESPONSE"

# 2. Poll until complete
ATTEMPT=0
while [ "$ATTEMPT" -lt "$MAX_POLL_ATTEMPTS" ]; do
    ATTEMPT=$((ATTEMPT + 1))
    sleep "$POLL_INTERVAL"

    STATUS_JSON=$(acurl -s --max-time 10 "$BASE_URL/status" 2>/dev/null || echo '{"status":"unknown"}')
    STATUS=$(echo "$STATUS_JSON" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)

    case "$STATUS" in
        complete)
            log "Export finished: $STATUS_JSON"
            break
            ;;
        failed)
            log "ERROR: Export failed: $STATUS_JSON"
            exit 1
            ;;
        running)
            PHASE=$(echo "$STATUS_JSON" | grep -o '"phase":"[^"]*"' | head -1 | cut -d'"' -f4)
            log "Still running (phase: ${PHASE:-unknown})... ($ATTEMPT/$MAX_POLL_ATTEMPTS)"
            ;;
        *)
            log "Unexpected status '$STATUS' — retrying... ($ATTEMPT/$MAX_POLL_ATTEMPTS)"
            ;;
    esac
done

if [ "$STATUS" != "complete" ]; then
    log "ERROR: Export did not complete within $((MAX_POLL_ATTEMPTS * POLL_INTERVAL)) seconds"
    exit 1
fi

# 3. Verify the archive exists on disk (written directly by the export job)
if [ ! -f "$OUTPUT_FILE" ]; then
    log "ERROR: Export file not found at $OUTPUT_FILE"
    exit 1
fi

FILE_SIZE=$(stat -c %s "$OUTPUT_FILE" 2>/dev/null || stat -f %z "$OUTPUT_FILE" 2>/dev/null || echo "unknown")
log "Export complete: $OUTPUT_FILE ($FILE_SIZE bytes)"
log ""
log "To copy the export out of the container:"
log "  docker cp <container>:${OUTPUT_FILE} ./fern-static-export.tar.gz"
log ""
log "To extract and upload to S3:"
log "  tar -xzf fern-static-export.tar.gz -C ./site"
log "  aws s3 sync ./site s3://my-bucket --delete"
