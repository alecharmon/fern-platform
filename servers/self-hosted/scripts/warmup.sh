#!/bin/bash

set -euo pipefail

# Warmup script: Fetches all pages to populate the Next.js cache
# This ensures the first real request after container startup is fast

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [self-hosted warmup] $*"
}

WARMUP_FILE="/tmp/warmup-complete"
WARMUP_ROUTES_FILE="/tmp/warmup-routes.txt"
BASE_PATH="${NEXT_PUBLIC_BASE_PATH:-}"
DOCS_URL="http://localhost:3000${BASE_PATH}"
TIMEOUT=${WARMUP_TIMEOUT:-5}

# Remove any existing warmup complete flag
rm -f "$WARMUP_FILE"

log "Starting cache warmup..."
log "Docs URL: $DOCS_URL"
log "Base Path: ${BASE_PATH:-'(none)'}"

# Wait for Next.js to be ready
log "Waiting for Next.js to be ready..."
ATTEMPTS=0
MAX_ATTEMPTS=60
until curl -f -s --max-time 10 "$DOCS_URL" > /dev/null 2>&1; do
    ATTEMPTS=$((ATTEMPTS + 1))
    if [ $ATTEMPTS -ge $MAX_ATTEMPTS ]; then
        log "ERROR: Next.js not ready after $MAX_ATTEMPTS attempts"
        exit 1
    fi
    log "Next.js not ready yet, waiting... ($ATTEMPTS/$MAX_ATTEMPTS)"
    sleep 2
done
log "Next.js is ready!"

# Get the domain from environment
DOMAIN="${NEXT_PUBLIC_DOCS_DOMAIN_URL:-localhost}"
log "Domain: $DOMAIN"

# Try multiple domains - sometimes x-fern-host needs to match exactly
DOMAINS_TO_TRY="$DOMAIN localhost:3000 localhost"
log "Will try domains: $DOMAINS_TO_TRY"

# Get all routes from sitemap.xml
log "Fetching routes from sitemap.xml..."
SITEMAP_URL="${DOCS_URL}/sitemap.xml"

log "Fetching: $SITEMAP_URL"
SITEMAP_RESPONSE=$(curl -s --max-time 30 -H "x-fern-host: $DOMAIN" "$SITEMAP_URL" 2>/dev/null || echo "")

if [ -z "$SITEMAP_RESPONSE" ]; then
    log "WARNING: Could not fetch sitemap.xml, falling back to root-only warmup"
    echo "/" > "$WARMUP_ROUTES_FILE"
else
    log "Parsing sitemap.xml for URLs..."
    
    # Extract URLs from sitemap XML using sed (BusyBox compatible)
    # Format: <loc>https://domain.com/path</loc>
    echo "$SITEMAP_RESPONSE" | sed -n 's/.*<loc>\([^<]*\)<\/loc>.*/\1/p' | while read -r url; do
        # Extract just the path from the full URL
        # Remove protocol and domain, keep the path
        path=$(echo "$url" | sed -E 's|^https?://[^/]+||')
        
        # Default to / if path is empty
        if [ -z "$path" ]; then
            echo "/"
        else
            echo "$path"
        fi
    done | sort -u > "$WARMUP_ROUTES_FILE"
    
    # If sitemap was empty or parsing failed, add root
    if [ ! -s "$WARMUP_ROUTES_FILE" ]; then
        log "Sitemap empty, adding root only..."
        echo "/" > "$WARMUP_ROUTES_FILE"
    fi
fi

# Count routes
ROUTE_COUNT=$(wc -l < "$WARMUP_ROUTES_FILE" 2>/dev/null | tr -d ' ')

if [ "$ROUTE_COUNT" -eq 0 ]; then
    log "No routes found, adding root only..."
    echo "/" > "$WARMUP_ROUTES_FILE"
    ROUTE_COUNT=1
fi

log "Found $ROUTE_COUNT routes to warm up"

# Display first few routes for debugging
log "Sample routes:"
head -5 "$WARMUP_ROUTES_FILE" | while read -r path; do
    log "  - $path"
done
if [ "$ROUTE_COUNT" -gt 5 ]; then
    log "  ... and $((ROUTE_COUNT - 5)) more"
fi

# Warm up each route
WARMED=0
FAILED=0
START_TIME=$(date +%s)

# Process routes sequentially
log "Warming up cache..."

while IFS= read -r path; do
    [ -z "$path" ] && continue
    
    # Build full URL (same as revalidate: origin + path)
    FULL_URL="http://localhost:3000${path}"
    
    log "Warming: $FULL_URL"
    
    # Try all domains to ensure cache is warm for each
    ANY_SUCCESS=false
    for try_domain in $DOMAINS_TO_TRY; do
        HTTP_STATUS=$(curl -s \
            --max-time "$TIMEOUT" \
            -H "x-fern-host: $try_domain" \
            -o /dev/null \
            -w "%{http_code}" \
            "$FULL_URL" 2>/dev/null || echo "000")
        
        # Consider 200-399 as success (includes redirects)
        if [ "$HTTP_STATUS" -ge 200 ] && [ "$HTTP_STATUS" -lt 400 ]; then
            log "  OK ($HTTP_STATUS) with x-fern-host: $try_domain"
            ANY_SUCCESS=true
        else
            log "  FAILED ($HTTP_STATUS) with x-fern-host: $try_domain"
        fi
    done
    
    if [ "$ANY_SUCCESS" = true ]; then
        WARMED=$((WARMED + 1))
    else
        FAILED=$((FAILED + 1))
    fi
    
    # Progress update every 10 routes
    TOTAL=$((WARMED + FAILED))
    if [ $((TOTAL % 10)) -eq 0 ] && [ $TOTAL -gt 0 ]; then
        log "Progress: $TOTAL/$ROUTE_COUNT (warmed: $WARMED, failed: $FAILED)"
    fi
done < "$WARMUP_ROUTES_FILE"

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

log "Warmup complete!"
log "  Total routes: $ROUTE_COUNT"
log "  Warmed successfully: $WARMED"
log "  Failed: $FAILED"
log "  Duration: ${DURATION}s"

# Create warmup complete marker
cat > "$WARMUP_FILE" << EOF
{
  "timestamp": "$(date -Iseconds)",
  "routes_total": $ROUTE_COUNT,
  "routes_warmed": $WARMED,
  "routes_failed": $FAILED,
  "duration_seconds": $DURATION
}
EOF

log "Warmup marker created at $WARMUP_FILE"

exit 0
