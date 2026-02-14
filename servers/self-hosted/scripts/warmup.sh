#!/bin/bash

set -euo pipefail

# Warmup script: Fetches all pages to populate the cache proxy's LRU cache
# Warms both HTML responses and RSC (React Server Component) payloads so that
# the first real request (full page load or client-side navigation) is fast

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [self-hosted warmup] $*"
}

WARMUP_FILE="/tmp/warmup-complete"
WARMUP_ROUTES_FILE="/tmp/warmup-routes.txt"
BASE_PATH="${NEXT_PUBLIC_BASE_PATH:-}"
DOCS_URL="http://localhost:3000${BASE_PATH}"
TIMEOUT=${WARMUP_TIMEOUT:-5}
WARMUP_DELAY=${WARMUP_DELAY:-0.5}
WARMUP_BATCH_SIZE=${WARMUP_BATCH_SIZE:-5}
WARMUP_BATCH_PAUSE=${WARMUP_BATCH_PAUSE:-2}

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

# Count routes before filtering
ALL_ROUTE_COUNT=$(wc -l < "$WARMUP_ROUTES_FILE" 2>/dev/null | tr -d ' ')
log "Found $ALL_ROUTE_COUNT total routes from sitemap"

# Filter out non-default version routes (only warm the latest version)
VERSION_PREFIXES_FILE="/tmp/warmup-version-prefixes.txt"
log "Detecting API version prefixes..."
node /scripts/get-version-prefixes.js > "$VERSION_PREFIXES_FILE" 2>/dev/null || true

if [ -s "$VERSION_PREFIXES_FILE" ]; then
    FILTERED_FILE="/tmp/warmup-routes-filtered.txt"
    cp "$WARMUP_ROUTES_FILE" "$FILTERED_FILE"
    while IFS= read -r prefix; do
        [ -z "$prefix" ] && continue
        FULL_PREFIX="${BASE_PATH}/${prefix}"
        log "  Excluding version prefix: $FULL_PREFIX"
        grep -v "^${FULL_PREFIX}/" "$FILTERED_FILE" | grep -v "^${FULL_PREFIX}$" > "$FILTERED_FILE.tmp" || true
        mv "$FILTERED_FILE.tmp" "$FILTERED_FILE"
    done < "$VERSION_PREFIXES_FILE"
    mv "$FILTERED_FILE" "$WARMUP_ROUTES_FILE"
    FILTERED_COUNT=$(wc -l < "$WARMUP_ROUTES_FILE" 2>/dev/null | tr -d ' ')
    log "Filtered to $FILTERED_COUNT routes (skipped $((ALL_ROUTE_COUNT - FILTERED_COUNT)) non-default version routes)"
else
    log "No version prefixes found (unversioned site or single version)"
fi

ROUTE_COUNT=$(wc -l < "$WARMUP_ROUTES_FILE" 2>/dev/null | tr -d ' ')

if [ "$ROUTE_COUNT" -eq 0 ]; then
    log "No routes found, adding root only..."
    echo "/" > "$WARMUP_ROUTES_FILE"
    ROUTE_COUNT=1
fi

log "Warming $ROUTE_COUNT routes"
log "Warmup settings: delay=${WARMUP_DELAY}s, batch_size=${WARMUP_BATCH_SIZE}, batch_pause=${WARMUP_BATCH_PAUSE}s"

log "Sample routes:"
head -5 "$WARMUP_ROUTES_FILE" | while read -r path; do
    log "  - $path"
done
if [ "$ROUTE_COUNT" -gt 5 ]; then
    log "  ... and $((ROUTE_COUNT - 5)) more"
fi

# The cache proxy caches HTML and RSC responses separately (cache key includes "rsc" header).
# RSC (React Server Component) payloads are what Next.js returns for client-side navigations,
# so warming them ensures instant page transitions for the first user.
WARMED=0
FAILED=0
RSC_WARMED=0
RSC_FAILED=0
START_TIME=$(date +%s)
BATCH_COUNT=0

log "Warming up cache (HTML + RSC) with gentle pacing..."

while IFS= read -r path; do
    [ -z "$path" ] && continue
    
    FULL_URL="http://localhost:3000${path}"
    
    # --- HTML warmup ---
    ANY_SUCCESS=false
    for try_domain in $DOMAINS_TO_TRY; do
        HTTP_STATUS=$(curl -s \
            --max-time "$TIMEOUT" \
            -H "x-fern-host: $try_domain" \
            -o /dev/null \
            -w "%{http_code}" \
            "$FULL_URL" 2>/dev/null || echo "000")
        
        if [ "$HTTP_STATUS" -ge 200 ] && [ "$HTTP_STATUS" -lt 400 ]; then
            ANY_SUCCESS=true
            break
        fi
    done
    
    if [ "$ANY_SUCCESS" = true ]; then
        WARMED=$((WARMED + 1))
    else
        FAILED=$((FAILED + 1))
    fi

    # Delay between HTML and RSC request
    sleep "$WARMUP_DELAY"

    # --- RSC warmup ---
    # Send "RSC: 1" header to trigger an RSC response (text/x-component) from Next.js.
    # The cache proxy includes this header in the cache key, so RSC responses are stored
    # separately from HTML responses.
    ANY_RSC_SUCCESS=false
    for try_domain in $DOMAINS_TO_TRY; do
        HTTP_STATUS=$(curl -s \
            --max-time "$TIMEOUT" \
            -H "x-fern-host: $try_domain" \
            -H "RSC: 1" \
            -o /dev/null \
            -w "%{http_code}" \
            "$FULL_URL" 2>/dev/null || echo "000")
        
        if [ "$HTTP_STATUS" -ge 200 ] && [ "$HTTP_STATUS" -lt 400 ]; then
            ANY_RSC_SUCCESS=true
            break
        fi
    done
    
    if [ "$ANY_RSC_SUCCESS" = true ]; then
        RSC_WARMED=$((RSC_WARMED + 1))
    else
        RSC_FAILED=$((RSC_FAILED + 1))
    fi
    
    BATCH_COUNT=$((BATCH_COUNT + 1))
    TOTAL=$((WARMED + FAILED))

    # Delay between each route
    sleep "$WARMUP_DELAY"

    # Longer pause after each batch to let the container breathe
    if [ $((BATCH_COUNT % WARMUP_BATCH_SIZE)) -eq 0 ]; then
        log "Progress: $TOTAL/$ROUTE_COUNT (HTML: $WARMED ok/$FAILED fail, RSC: $RSC_WARMED ok/$RSC_FAILED fail)"
        sleep "$WARMUP_BATCH_PAUSE"
    fi
done < "$WARMUP_ROUTES_FILE"

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

log "Warmup complete!"
log "  Total routes: $ROUTE_COUNT"
log "  HTML warmed: $WARMED (failed: $FAILED)"
log "  RSC warmed: $RSC_WARMED (failed: $RSC_FAILED)"
log "  Duration: ${DURATION}s"

# Create warmup complete marker
cat > "$WARMUP_FILE" << EOF
{
  "timestamp": "$(date -Iseconds)",
  "routes_total": $ROUTE_COUNT,
  "html_warmed": $WARMED,
  "html_failed": $FAILED,
  "rsc_warmed": $RSC_WARMED,
  "rsc_failed": $RSC_FAILED,
  "duration_seconds": $DURATION
}
EOF

log "Warmup marker created at $WARMUP_FILE"

exit 0
