#!/bin/bash
# Build-time seeding script for self-hosted Fern docs
# This script runs during `docker build` (customer's Dockerfile) to:
# 1. Restore the pre-migrated database schema from the base image
# 2. Start all services (Postgres, SeaweedFS, MeiliSearch, FDR)
# 3. Run `fern generate --docs` to generate documentation
# 4. Start Next.js and run warmup to pre-populate the cache
# 5. Save all artifacts for runtime restoration
#
# Usage in customer Dockerfile:
#   FROM fernapi/fern-self-hosted:latest
#   COPY fern/ /fern/
#   RUN /scripts/generate.sh
#
# Options:
#   --only-deps    Start services (Postgres, SeaweedFS, FDR) but skip fern generate.
#                  Use this when you want to defer docs generation to runtime.
#                  The container will run fern generate --docs at startup.
#
# The seeded data is stored in /opt/fern-seed/ and will be restored at runtime.
# This allows the container to run in air-gapped environments without network access.

set -euo pipefail

# Parse command line arguments
ONLY_DEPS=false
INSTANCE_URL=""
while [[ $# -gt 0 ]]; do
    case $1 in
        --only-deps)
            ONLY_DEPS=true
            shift
            ;;
        --instance)
            INSTANCE_URL="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--only-deps] [--instance <url>]"
            exit 1
            ;;
    esac
done

# Base image artifacts (created during base image build)
BASE_SEED_DIR="/opt/fern-base"
BASE_SCHEMA_DUMP="$BASE_SEED_DIR/postgres-schema.dump"

# Customer seed artifacts (created by this script)
SEED_DIR="/opt/fern-seed"
SEED_SEAWEEDFS_DIR="$SEED_DIR/seaweedfs"
SEED_MEILI_DIR="$SEED_DIR/meilisearch"
SEED_POSTGRES_DUMP="$SEED_DIR/postgres.dump"
SEED_MARKER="$SEED_DIR/.seeded"
SEED_MEILI_KEY_FILE="$SEED_DIR/meili-master-key"

# Generate a random MeiliSearch master key at build time for security
# This ensures each deployment has a unique key instead of a hardcoded one
# Uses /dev/urandom which is available in all Linux environments
generate_random_key() {
    # Generate 32 random bytes, encode as base64, then take first 32 alphanumeric chars
    head -c 32 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 32
}

# Timestamp logging function
log() {
    echo "[SEED $(date '+%Y-%m-%d %H:%M:%S')] $*"
}

MEILI_MASTER_KEY=$(generate_random_key)
log "Generated random MeiliSearch master key for this build"

# Pipe filter that adds timestamps to each line
add_timestamps() {
    while IFS= read -r line; do
        echo "[SEED $(date '+%Y-%m-%d %H:%M:%S')] $line"
    done
}

# Helper to run PostgreSQL commands as postgres user when running as root
# This is needed because initdb refuses to run as root
run_as_postgres() {
    if [ "$(id -u)" = "0" ]; then
        su postgres -c "$*"
    else
        eval "$*"
    fi
}

# Cleanup function to ensure services are stopped on exit
cleanup() {
    log "Cleaning up services..."
    
    # Stop Next.js (if started for search indexing)
    if [ -n "${nextjs_pid:-}" ] && kill -0 "$nextjs_pid" 2>/dev/null; then
        log "Stopping Next.js (PID: $nextjs_pid)..."
        kill "$nextjs_pid" 2>/dev/null || true
        wait "$nextjs_pid" 2>/dev/null || true
    fi
    
    # Stop FDR
    if [ -n "${fdr_pid:-}" ] && kill -0 "$fdr_pid" 2>/dev/null; then
        log "Stopping FDR (PID: $fdr_pid)..."
        kill "$fdr_pid" 2>/dev/null || true
        wait "$fdr_pid" 2>/dev/null || true
    fi
    
    # Stop SeaweedFS
    if [ -n "${seaweed_pid:-}" ] && kill -0 "$seaweed_pid" 2>/dev/null; then
        log "Stopping SeaweedFS (PID: $seaweed_pid)..."
        kill "$seaweed_pid" 2>/dev/null || true
        wait "$seaweed_pid" 2>/dev/null || true
    fi
    
    # Stop MeiliSearch
    if [ -n "${meili_pid:-}" ] && kill -0 "$meili_pid" 2>/dev/null; then
        log "Stopping MeiliSearch (PID: $meili_pid)..."
        kill "$meili_pid" 2>/dev/null || true
        wait "$meili_pid" 2>/dev/null || true
    fi
    
    # Clean up MeiliSearch data directory to avoid leaving root-owned state
    if [ -n "${MEILI_DB_PATH:-}" ] && [ -d "$MEILI_DB_PATH" ]; then
        log "Cleaning up MeiliSearch data directory: $MEILI_DB_PATH"
        rm -rf "$MEILI_DB_PATH" 2>/dev/null || true
    fi
    
    # Clean up SeaweedFS S3 config file to avoid leaving root-owned file in /tmp
    # that would block runtime writes when running as a different UID
    if [ -n "${S3_CONFIG_FILE:-}" ] && [ -f "$S3_CONFIG_FILE" ]; then
        log "Cleaning up SeaweedFS S3 config: $S3_CONFIG_FILE"
        rm -f "$S3_CONFIG_FILE" 2>/dev/null || true
    fi
    
    # Stop PostgreSQL (must run as postgres user if we started as root)
    if [ -n "${PGDATA:-}" ] && [ -d "$PGDATA" ]; then
        log "Stopping PostgreSQL..."
        if [ "$(id -u)" = "0" ]; then
            su postgres -c "PGDATA=$PGDATA pg_ctl -D $PGDATA stop -m fast" 2>/dev/null || true
        else
            pg_ctl -D "$PGDATA" stop -m fast 2>/dev/null || true
        fi
    fi
    
    log "Cleanup complete"
}

# Set up trap to ensure cleanup runs on exit
trap cleanup EXIT

log "=========================================="
log "Starting build-time docs seeding"
log "=========================================="

# Validate that /fern exists
if [ ! -d "/fern" ]; then
    log "ERROR: /fern directory not found. Please COPY your fern/ directory before running generate.sh"
    exit 1
fi

if [ ! -f "/fern/fern.config.json" ]; then
    log "ERROR: /fern/fern.config.json not found. Please ensure your Fern project is copied to /fern/"
    exit 1
fi

# -----------  Fix permissions on customer-provided directories  -----------
# Make all customer-copied directories readable by any UID.
# This is critical for Kubernetes environments that run containers as
# arbitrary non-root UIDs (e.g., via runAsNonRoot security context).
# Without this, files copied with restrictive permissions cause EACCES errors.
log "Ensuring customer directories are readable by all UIDs..."
chmod -R a+rX /fern 2>/dev/null || log "Warning: Could not fix permissions on /fern"
# /protos - protobuf dependencies (common for buf.build projects)
if [ -d "/protos" ]; then
    log "Found /protos directory, fixing permissions..."
    chmod -R a+rX /protos 2>/dev/null || log "Warning: Could not fix permissions on /protos"
fi
# /api - API specs directory (alternative location)
if [ -d "/api" ]; then
    log "Found /api directory, fixing permissions..."
    chmod -R a+rX /api 2>/dev/null || log "Warning: Could not fix permissions on /api"
fi
# -----------  End permission fixes  -----------

# Check for base image schema dump
if [ ! -f "$BASE_SCHEMA_DUMP" ]; then
    log "WARNING: Base image schema dump not found at $BASE_SCHEMA_DUMP"
    log "Will run Prisma migrations instead (slower)"
    USE_BASE_SCHEMA=false
else
    log "Found base image schema dump at $BASE_SCHEMA_DUMP"
    USE_BASE_SCHEMA=true
fi

# Create seed directory
mkdir -p "$SEED_DIR"

# Extract org name for bucket creation
export ORG_NAME=$(jq -r '.organization' < /fern/fern.config.json)
CUSTOM_DOMAIN=$(yq '.instances[0]."custom-domain"' /fern/docs.yml 2>/dev/null | tr -d '"')

# Check if custom domain is a valid value (not null, not empty, not a template placeholder like ${VAR})
is_valid_custom_domain() {
    local domain="$1"
    # Empty or null
    [ -z "$domain" ] && return 1
    [ "$domain" = "null" ] && return 1
    # Template placeholder (contains ${ or $()
    case "$domain" in
        *'${'*|*'$('*) return 1 ;;
    esac
    return 0
}

if is_valid_custom_domain "$CUSTOM_DOMAIN"; then
    export NEXT_PUBLIC_DOCS_DOMAIN_URL="$CUSTOM_DOMAIN"
else
    CUSTOM_DOMAIN=""  # Clear it so we don't try to use it later
    export NEXT_PUBLIC_DOCS_DOMAIN_URL="${ORG_NAME}.docs.buildwithfern.com"
fi

# Export BASE_PATH if set
export NEXT_PUBLIC_BASE_PATH="${NEXT_PUBLIC_BASE_PATH:-}"

log "Organization: $ORG_NAME"
log "Docs domain: $NEXT_PUBLIC_DOCS_DOMAIN_URL"
log "Base path: ${NEXT_PUBLIC_BASE_PATH:-'(none)'}"

# -----------  Start PostgreSQL  -----------
log "Starting PostgreSQL for seeding..."

# Use UID-scoped directories to avoid permission conflicts
# This prevents issues when build runs with different UIDs
CURRENT_UID=$(id -u)
export PGBASE="/tmp/postgresql-${CURRENT_UID}"
export PGDATA="${PGBASE}/data"
export PGHOST="${PGBASE}"

rm -rf "$PGBASE" 2>/dev/null || true
mkdir -p "$PGDATA"

# Ensure postgres user owns the data directory (needed when running as root)
if [ "$CURRENT_UID" = "0" ]; then
    chown -R postgres:postgres "$PGBASE"
fi

log "Initializing PostgreSQL cluster in $PGDATA (UID: $CURRENT_UID)..."
run_as_postgres "PGDATA=$PGDATA initdb -D $PGDATA --auth-local=trust --auth-host=trust --username=postgres" 2>&1 || {
    log "ERROR: Failed to initialize PostgreSQL"
    exit 1
}

run_as_postgres "PGDATA=$PGDATA pg_ctl -D $PGDATA -o \"-c listen_addresses='localhost' -c unix_socket_directories='$PGBASE' -c shared_buffers=128MB -c max_connections=200\" -l $PGDATA/logfile start" 2>&1 || {
    log "ERROR: Failed to start PostgreSQL"
    exit 1
}

# Wait for PostgreSQL to be ready (use UID-scoped socket directory)
for i in {1..30}; do
    if command -v pg_isready >/dev/null 2>&1; then
        if pg_isready -h "$PGBASE" -p 5432 2>/dev/null; then
            log "PostgreSQL is ready"
            break
        fi
    else
        if run_as_postgres "psql -h $PGBASE -p 5432 -U postgres -c 'SELECT 1'" >/dev/null 2>&1; then
            log "PostgreSQL is ready (verified via psql)"
            break
        fi
    fi
    log "Waiting for PostgreSQL... ($i/30)"
    sleep 1
done

# Create database (use UID-scoped socket directory)
if command -v createdb >/dev/null 2>&1; then
    run_as_postgres "createdb -h $PGBASE -p 5432 -U postgres fdr" 2>&1 || log "Database 'fdr' may already exist"
else
    log "createdb not found, using Prisma to create database..."
fi

# Restore schema from base image dump or run migrations
if [ "$USE_BASE_SCHEMA" = "true" ]; then
    if command -v pg_restore >/dev/null 2>&1; then
        log "Restoring database schema from base image dump..."
        run_as_postgres "pg_restore -h $PGBASE -p 5432 -U postgres -d fdr --clean --if-exists $BASE_SCHEMA_DUMP" 2>&1 || {
            log "Warning: pg_restore had some errors (this may be normal for clean restore)"
        }
        log "Schema restored from base image dump"
    else
        log "pg_restore not found, falling back to Prisma migrations..."
        USE_BASE_SCHEMA=false
    fi
fi

if [ "$USE_BASE_SCHEMA" != "true" ]; then
    log "Running Prisma migrations..."
    DATABASE_URL="postgresql://postgres:postgres@localhost:5432/fdr?host=${PGBASE}" \
        prisma migrate deploy --schema /prisma/schema.prisma 2>&1 | add_timestamps || {
        log "ERROR: Prisma migrations failed"
        exit 1
    }
fi

# -----------  Start MeiliSearch  -----------
log "Starting MeiliSearch for seeding..."
export MEILI_HTTP_ADDR=0.0.0.0:7700

# Use UID-scoped directory for MeiliSearch data to avoid leaving root-owned state in /tmp
# This prevents permission issues at runtime when container runs as a different UID
MEILI_DB_PATH="/tmp/meilisearch-seed-${CURRENT_UID}"
rm -rf "$MEILI_DB_PATH" 2>/dev/null || true
mkdir -p "$MEILI_DB_PATH"

# Change to the MeiliSearch data directory before starting
# MeiliSearch may use relative paths for dumps, snapshots, and other files
cd "$MEILI_DB_PATH"

/meilisearch --master-key="$MEILI_MASTER_KEY" --db-path "$MEILI_DB_PATH" 2>&1 &
meili_pid=$!
log "MeiliSearch PID: $meili_pid (db-path: $MEILI_DB_PATH)"

# Wait for MeiliSearch
for i in {1..30}; do
    if curl -f -s -H "Authorization: Bearer $MEILI_MASTER_KEY" http://localhost:7700/health 2>/dev/null; then
        log "MeiliSearch is ready"
        break
    fi
    log "Waiting for MeiliSearch... ($i/30)"
    sleep 1
done

log "MeiliSearch is ready"

# -----------  Start SeaweedFS  -----------
log "Starting SeaweedFS for seeding..."

export AWS_ACCESS_KEY_ID=fern_admin
export AWS_SECRET_ACCESS_KEY=fern_admin
export S3_ACCESS_KEY=fern_admin
export S3_SECRET_KEY=fern_admin

S3_CONFIG_FILE="/tmp/seaweedfs-s3.json"
cat > "$S3_CONFIG_FILE" <<'SEAWEED_S3_CONFIG'
{
  "identities": [
    {
      "name": "admin",
      "credentials": [
        { "accessKey": "fern_admin", "secretKey": "fern_admin" }
      ],
      "actions": ["Admin", "Read", "List", "Tagging", "Write"]
    },
    {
      "name": "anonymous",
      "actions": ["Read", "List"]
    }
  ]
}
SEAWEED_S3_CONFIG
weed mini -dir=/data -s3.config="$S3_CONFIG_FILE" > /dev/null 2>&1 &
seaweed_pid=$!
log "SeaweedFS PID: $seaweed_pid"

for i in {1..30}; do
    if curl -s -o /dev/null http://localhost:8333/ 2>/dev/null; then
        log "SeaweedFS is ready"
        break
    fi
    log "Waiting for SeaweedFS... ($i/30)"
    sleep 1
done

log "Creating S3 buckets..."
echo "s3.bucket.create -name ${ORG_NAME}.docs.buildwithfern.com" | weed shell -master=localhost:9333 > /dev/null 2>&1 || log "Bucket may already exist"
export S3_BUCKET_NAME=${ORG_NAME}.docs.buildwithfern.com

if [ -n "$CUSTOM_DOMAIN" ]; then
    CUSTOM_DOMAIN_CLEANED=$(echo "$CUSTOM_DOMAIN" | sed -E 's#^https?://##' | cut -d'/' -f1 | tr -d ':')
    if echo "s3.bucket.create -name ${CUSTOM_DOMAIN_CLEANED}" | weed shell -master=localhost:9333 > /dev/null 2>&1; then
        export S3_BUCKET_NAME=${CUSTOM_DOMAIN_CLEANED}
        log "Using custom domain bucket: ${CUSTOM_DOMAIN_CLEANED}"
    else
        log "WARNING: Failed to create custom domain bucket, using default bucket"
    fi
fi

export S3_ENDPOINT="http://localhost:8333"

# Pre-warm SeaweedFS by forcing volume allocation for the bucket.
# Without this, the first PUT via presigned URL can return 500 because
# SeaweedFS lazily allocates volumes and the allocation may not finish
# before the upload request arrives.
#
# We use multiple strategies because weed mini (master:9333, volume:9340,
# filer:8888, S3:8333) may need time for internal component registration:
#   1. weed shell volume.grow - explicitly tells the master to allocate volumes
#   2. Filer upload - forces the full filer→volume pipeline to execute
#   3. /vol/assign - original approach as final validation
log "Pre-warming SeaweedFS volumes for bucket ${S3_BUCKET_NAME}..."
PREWARM_OK=false

# Strategy 1: Use weed shell to explicitly grow volumes for the collection
log "  Trying volume.grow via weed shell..."
for i in {1..10}; do
    if echo "volume.grow -count=1 -collection=${S3_BUCKET_NAME}" | weed shell -master=localhost:9333 2>&1 | grep -qi "created"; then
        log "  volume.grow succeeded on attempt $i"
        PREWARM_OK=true
        break
    fi
    sleep 2
done

# Strategy 2: Upload a test file through the filer (port 8888) to force
# the full write pipeline (filer → volume server) to be exercised
if [ "$PREWARM_OK" = "false" ]; then
    log "  volume.grow did not confirm, trying filer upload..."
    for i in {1..10}; do
        FILER_RESULT=$(curl -s -o /dev/null -w "%{http_code}" \
            -F "filename=@/dev/null" \
            "http://localhost:8888/buckets/${S3_BUCKET_NAME}/__prewarm_test" 2>/dev/null || echo "000")
        if [ "$FILER_RESULT" = "200" ] || [ "$FILER_RESULT" = "201" ]; then
            log "  Filer upload succeeded (HTTP $FILER_RESULT) on attempt $i"
            PREWARM_OK=true
            break
        fi
        log "  Filer upload returned HTTP $FILER_RESULT, retrying... ($i/10)"
        sleep 2
    done
fi

# Strategy 3: Fall back to /vol/assign on the master API
if [ "$PREWARM_OK" = "false" ]; then
    log "  Trying /vol/assign on master API..."
    for i in {1..10}; do
        ASSIGN_RESULT=$(curl -s "http://localhost:9333/vol/assign?count=1&collection=${S3_BUCKET_NAME}" 2>/dev/null || echo "")
        if echo "$ASSIGN_RESULT" | grep -q '"fid"'; then
            log "  /vol/assign succeeded on attempt $i"
            PREWARM_OK=true
            break
        fi
        log "  /vol/assign response: $ASSIGN_RESULT ($i/10)"
        sleep 2
    done
fi

if [ "$PREWARM_OK" = "true" ]; then
    log "SeaweedFS volume pre-warming completed successfully"
else
    log "WARNING: SeaweedFS volume pre-warming did not confirm success"
    log "WARNING: Asset uploads may fail with 500 errors"
fi

# -----------  Start FDR  -----------
log "Starting FDR for seeding..."

export LOCAL_MODE_OVERRIDE=true
export S3_FORCE_PATH_STYLE=true
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/fdr

node /fdr/server.cjs 2>&1 &
fdr_pid=$!
log "FDR PID: $fdr_pid"

# Wait for FDR health check
for i in {1..30}; do
    if curl -f -s http://localhost:8080/health 2>/dev/null; then
        log "FDR health check passed"
        break
    fi
    log "Waiting for FDR... ($i/30)"
    sleep 1
done

# Wait for FDR oRPC routes to be fully mounted.
# The /health endpoint can pass before route handlers are registered,
# causing "no matching procedure found" errors and upload failures.
log "Verifying FDR API routes are ready..."
for i in {1..15}; do
    # Send a minimal POST to the docs init endpoint; a 400 (bad request) or 401/403
    # means the route is mounted and rejecting our dummy payload, which is fine.
    # A 404 or connection error means routes are not yet registered.
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -d '{}' \
        "http://localhost:8080/v2/registry/docs/v2/init" 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" != "000" ] && [ "$HTTP_CODE" != "404" ]; then
        log "FDR API routes are ready (status: $HTTP_CODE)"
        break
    fi
    log "Waiting for FDR API routes... ($i/15, status: $HTTP_CODE)"
    sleep 1
done

log "FDR is ready"

# -----------  Generate Docs  -----------
if [ "$ONLY_DEPS" = "true" ]; then
    log "=========================================="
    log "--only-deps mode: Caching buf dependencies only"
    log "=========================================="
    log "This will fetch and cache buf.build dependencies for air-gapped use."
    log "Docs generation will happen at runtime."
    log "=========================================="
    
    cd /fern
    
    # Set buf cache to a known location that persists and is accessible by all users
    export BUF_CACHE_DIR=/opt/buf-cache
    mkdir -p "$BUF_CACHE_DIR"
    
    # =========================================================================
    # PHASE 1: Process proto directories that already have buf.yaml files
    # =========================================================================
    log "Searching for proto directories with buf.yaml..."
    PROTO_DIRS=$(find . -name "buf.yaml" -type f -exec dirname {} \; 2>/dev/null || true)
    
    if [ -n "$PROTO_DIRS" ]; then
        for proto_dir in $PROTO_DIRS; do
            cd "/fern/$proto_dir"
            
            # Check if buf.yaml has dependencies (skip empty or no-deps buf.yaml files)
            if [ ! -s "buf.yaml" ]; then
                log "Skipping $proto_dir - buf.yaml is empty"
                continue
            fi
            
            # Check if buf.yaml has a deps section
            if ! grep -q "deps:" "buf.yaml" 2>/dev/null; then
                log "Skipping $proto_dir - buf.yaml has no dependencies"
                continue
            fi
            
            log "Caching buf dependencies in $proto_dir..."
            
            # First run buf dep update to ensure lock file is up to date
            buf dep update 2>&1 || {
                log "WARNING: buf dep update failed in $proto_dir"
                log "This may be due to network issues or invalid buf.yaml"
            }
            
            # Then run buf build to actually populate the buf cache
            # This is what fern does internally, so we need to do the same
            log "Running buf build to populate cache..."
            buf build 2>&1 || {
                log "WARNING: buf build failed in $proto_dir"
                log "This may be due to invalid proto files"
            }
            
            # Fix permissions on buf.lock file created by buf dep update
            # This is critical for runtime when container runs as arbitrary UID
            if [ -f "buf.lock" ]; then
                chmod 644 "buf.lock" 2>/dev/null || true
                log "Fixed permissions on $proto_dir/buf.lock"
            fi
        done
        log "Buf dependencies cached successfully!"
        log "Buf cache location: $BUF_CACHE_DIR"
    else
        log "No proto directories with buf.yaml found"
    fi
    
    # =========================================================================
    # PHASE 2: Introspect generators.yml for proto specs WITHOUT buf.yaml
    # This replicates the fern CLI behavior of creating a temporary buf.yaml
    # when one doesn't exist but dependencies are specified in generators.yml
    # =========================================================================
    log ""
    log "=========================================="
    log "Introspecting generators.yml for proto specs without buf.yaml..."
    log "=========================================="
    
    cd /fern
    
    # Find all generators.yml files in the fern directory tree
    GENERATORS_YML_FILES=$(find . -name "generators.yml" -type f 2>/dev/null || true)
    
    if [ -n "$GENERATORS_YML_FILES" ]; then
        for generators_yml in $GENERATORS_YML_FILES; do
            # Get the directory containing this generators.yml
            GENERATORS_DIR=$(dirname "$generators_yml")
            GENERATORS_DIR_ABS=$(cd "$GENERATORS_DIR" && pwd)
            
            log "Processing $generators_yml..."
            
            # Extract proto specs from generators.yml using yq
            PROTO_SPECS_COUNT=$(yq '.api.specs | length' "$generators_yml" 2>/dev/null || echo "0")
            
            if [ "$PROTO_SPECS_COUNT" = "0" ] || [ "$PROTO_SPECS_COUNT" = "null" ]; then
                log "  -> No specs found in $generators_yml"
                continue
            fi
            
            for i in $(seq 0 $((PROTO_SPECS_COUNT - 1))); do
                # Check if this spec has a proto section
                PROTO_ROOT=$(yq ".api.specs[$i].proto.root // \"\"" "$generators_yml" 2>/dev/null | tr -d '"')
                
                if [ -z "$PROTO_ROOT" ] || [ "$PROTO_ROOT" = "null" ]; then
                    continue
                fi
                
                # Resolve the proto root path relative to the generators.yml location
                # This handles paths like "../../../protos/" correctly
                PROTO_ROOT_ABS=$(cd "$GENERATORS_DIR_ABS" && cd "$PROTO_ROOT" 2>/dev/null && pwd) || {
                    log "  -> WARNING: Could not resolve proto root path: $PROTO_ROOT"
                    continue
                }
                
                # Get a display-friendly relative path from /fern
                PROTO_ROOT_DISPLAY="${PROTO_ROOT_ABS#/fern/}"
                
                log "Found proto spec with root: $PROTO_ROOT_DISPLAY"
                
                # Check if buf.yaml already exists in this directory
                if [ -f "$PROTO_ROOT_ABS/buf.yaml" ]; then
                    log "  -> buf.yaml already exists, skipping introspection"
                    continue
                fi
                
                # Extract dependencies from generators.yml
                DEPS=$(yq ".api.specs[$i].proto.dependencies // []" "$generators_yml" 2>/dev/null)
                DEPS_COUNT=$(echo "$DEPS" | yq 'length' 2>/dev/null || echo "0")
                
                if [ "$DEPS_COUNT" = "0" ] || [ "$DEPS_COUNT" = "null" ]; then
                    log "  -> No dependencies specified in generators.yml, skipping"
                    continue
                fi
                
                log "  -> Found $DEPS_COUNT dependencies in generators.yml, creating temporary buf.yaml"
                
                # Create a temporary buf.yaml with the dependencies
                cd "$PROTO_ROOT_ABS"
                
                # Build the buf.yaml content
                cat > buf.yaml << 'BUFYAML_HEADER'
version: v1
deps:
BUFYAML_HEADER
                
                # Add each dependency
                for j in $(seq 0 $((DEPS_COUNT - 1))); do
                    DEP=$(echo "$DEPS" | yq ".[$j]" 2>/dev/null | tr -d '"')
                    echo "  - $DEP" >> buf.yaml
                    log "  -> Added dependency: $DEP"
                done
                
                log "  -> Created temporary buf.yaml in $PROTO_ROOT_DISPLAY"
                
                # Run buf dep update to fetch dependencies
                log "  -> Running buf dep update..."
                buf dep update 2>&1 || {
                    log "WARNING: buf dep update failed in $PROTO_ROOT_DISPLAY"
                    log "This may be due to network issues or invalid dependencies"
                }
                
                # Run buf build to populate the cache
                log "  -> Running buf build to populate cache..."
                buf build 2>&1 || {
                    log "WARNING: buf build failed in $PROTO_ROOT_DISPLAY"
                    log "This may be due to invalid proto files"
                }
                
                # Fix permissions on generated files
                if [ -f "buf.lock" ]; then
                    chmod 644 "buf.lock" 2>/dev/null || true
                    log "  -> Fixed permissions on buf.lock"
                fi
                chmod 644 "buf.yaml" 2>/dev/null || true
                
                log "  -> Dependencies cached for $PROTO_ROOT_DISPLAY"
                
                # Return to /fern for the next iteration
                cd /fern
            done
        done
    else
        log "No generators.yml files found, skipping introspection"
    fi
    
    log ""
    log "Buf dependency caching complete!"
    
    # Make buf cache readable by all (for arbitrary UID runtime)
    chmod -R 755 "$BUF_CACHE_DIR" 2>/dev/null || true
    
    # Re-fix permissions on /fern directory after buf dep update
    # buf dep update may have created/modified files with restrictive permissions
    log "Re-fixing permissions on /fern directory..."
    chmod -R a+rX /fern 2>/dev/null || log "Warning: Could not fix permissions on /fern"
    
    # Clean up services before exiting
    log "Cleaning up services..."
    rm -rf /data/* 2>/dev/null || true
    
    # Ensure nonroot user exists in /etc/passwd (safeguard for readOnlyRootFilesystem)
    if ! grep -q '^[^:]*:[^:]*:65532:' /etc/passwd 2>/dev/null; then
        log "UID 65532 not found in /etc/passwd, re-adding..."
        echo "nonroot:x:65532:65532:Nonroot User:/tmp:/bin/bash" >> /etc/passwd 2>/dev/null || true
        echo "nonroot:x:65532:" >> /etc/group 2>/dev/null || true
    fi
    
    log "=========================================="
    log "--only-deps mode complete!"
    log "=========================================="
    log "Buf dependencies have been cached in $BUF_CACHE_DIR"
    log "At runtime, set BUF_CACHE_DIR=$BUF_CACHE_DIR to use the cached dependencies."
    log "=========================================="
    
    # Cleanup is handled by trap
    exit 0
fi

log "=========================================="
log "Running fern generate --docs"
log "=========================================="

cd /fern

# Normalize FERN_LOG_LEVEL to lowercase and validate against allowed values
FERN_LOG_LEVEL_LOWER=$(echo "${FERN_LOG_LEVEL:-warn}" | tr '[:upper:]' '[:lower:]')
case "$FERN_LOG_LEVEL_LOWER" in
    trace|debug|info|warn|error) ;;
    *) log "WARNING: Invalid FERN_LOG_LEVEL '${FERN_LOG_LEVEL}', defaulting to 'warn'. Valid values: trace, debug, info, warn, error"
       FERN_LOG_LEVEL_LOWER="warn" ;;
esac

# Build the list of instances to generate.
# Priority: explicit --instance flag > auto-detect from docs.yml
INSTANCE_URLS=()
if [ -n "$INSTANCE_URL" ]; then
    # User explicitly passed --instance
    INSTANCE_URLS=("$INSTANCE_URL")
    log "Using explicitly provided instance: $INSTANCE_URL"
else
    # Auto-detect instances from docs.yml
    INSTANCE_COUNT=$(yq '.instances | length' /fern/docs.yml 2>/dev/null || echo "0")
    log "Found $INSTANCE_COUNT docs instance(s) in docs.yml"
    if [ "$INSTANCE_COUNT" -gt 1 ]; then
        for i in $(seq 0 $((INSTANCE_COUNT - 1))); do
            url=$(yq ".instances[$i].url" /fern/docs.yml 2>/dev/null | tr -d '"')
            if [ -n "$url" ] && [ "$url" != "null" ]; then
                INSTANCE_URLS+=("$url")
            fi
        done
        log "Will generate docs for instances: ${INSTANCE_URLS[*]}"
    fi
fi

# If we have specific instances, generate each one separately with --instance;
# otherwise run without --instance for backwards compatibility (single instance).
if [ ${#INSTANCE_URLS[@]} -ge 1 ]; then
    GENERATE_SUCCESS=true
    for instance_url in "${INSTANCE_URLS[@]}"; do
        log "Generating docs for instance: $instance_url"
        INSTANCE_SUCCESS=false
        for attempt in 1 2; do
            if FERN_TOKEN=dummy \
               FERN_FDR_ORIGIN=http://localhost:8080 \
               FERN_DISABLE_TELEMETRY=true \
               FERN_NO_VERSION_REDIRECTION=true \
               fern generate --docs --instance "$instance_url" --log-level "$FERN_LOG_LEVEL_LOWER" --no-prompt 2>&1; then
                INSTANCE_SUCCESS=true
                break
            fi
            if [ "$attempt" -eq 1 ]; then
                log "WARNING: fern generate --docs --instance $instance_url failed on attempt $attempt, retrying in 2s..."
                sleep 2
            fi
        done
        if [ "$INSTANCE_SUCCESS" != "true" ]; then
            log "ERROR: fern generate --docs --instance $instance_url failed after 2 attempts"
            GENERATE_SUCCESS=false
        fi
    done
else
    GENERATE_SUCCESS=false
    for attempt in 1 2; do
        if FERN_TOKEN=dummy \
           FERN_FDR_ORIGIN=http://localhost:8080 \
           FERN_DISABLE_TELEMETRY=true \
           FERN_NO_VERSION_REDIRECTION=true \
           fern generate --docs --log-level "$FERN_LOG_LEVEL_LOWER" --no-prompt 2>&1; then
            GENERATE_SUCCESS=true
            break
        fi
        if [ "$attempt" -eq 1 ]; then
            log "WARNING: fern generate --docs failed on attempt $attempt, retrying in 2s..."
            sleep 2
        fi
    done
fi

if [ "$GENERATE_SUCCESS" != "true" ]; then
    log "ERROR: fern generate --docs failed after 2 attempts"
    log "This may be due to network issues fetching dependencies."
    log "Ensure your build environment has network access."
    exit 1
fi

log "Docs generated successfully!"

# -----------  Save Seeded Data  -----------
log "=========================================="
log "Saving seeded data to $SEED_DIR"
log "=========================================="

# Dump PostgreSQL database (full data, not just schema)
log "Dumping PostgreSQL database..."
if command -v pg_dump >/dev/null 2>&1; then
    run_as_postgres "pg_dump -h $PGBASE -p 5432 -U postgres -Fc fdr" > "$SEED_POSTGRES_DUMP" || {
        log "ERROR: Failed to dump PostgreSQL database"
        exit 1
    }
    log "PostgreSQL dump saved to $SEED_POSTGRES_DUMP"
else
    log "ERROR: pg_dump not found - cannot create database dump for seeding"
    log "Please ensure postgresql-client is installed in the Docker image"
    exit 1
fi

# Copy SeaweedFS data
log "Copying SeaweedFS data..."
mkdir -p "$SEED_SEAWEEDFS_DIR"
cp -r /data/* "$SEED_SEAWEEDFS_DIR/" 2>/dev/null || true
log "SeaweedFS data saved to $SEED_SEAWEEDFS_DIR"

# -----------  Index and Export MeiliSearch  -----------
log "Indexing and exporting MeiliSearch data..."

# If NEXT_PUBLIC_BASE_PATH is known at build time, we'll patch the placeholder
# into the bundle after seeding is complete. For the temporary Next.js startup
# below, we always use the placeholder as the basePath.
_GEN_BASE_PATH="/__FERN_BP__"

# We need to start Next.js temporarily to call the reindex endpoint
log "Starting Next.js temporarily for search indexing..."
cd /nextapp/packages/fern-docs/bundle

HOSTNAME="127.0.0.1" \
PORT=3001 \
NEXT_PUBLIC_FDR_ORIGIN_PORT=8080 \
NEXT_PUBLIC_FDR_ORIGIN="http://localhost:8080" \
NEXT_PUBLIC_FDR_LAMBDA_ORIGIN="http://localhost:8080" \
S3_ENDPOINT="http://localhost:8333" \
NEXT_PUBLIC_FILES_ORIGIN="http://localhost:8333/${S3_BUCKET_NAME}" \
NEXT_PUBLIC_ASSET_HOSTING="1" \
NEXT_PUBLIC_DOCS_DOMAIN=${NEXT_PUBLIC_DOCS_DOMAIN_URL} \
NEXT_PUBLIC_IS_SELF_HOSTED=1 \
NEXT_PUBLIC_BASE_PATH="${_GEN_BASE_PATH}" \
NEXT_PUBLIC_FAI_ORIGIN="http://localhost:8482" \
NEXT_TELEMETRY_DISABLED=1 \
MEILISEARCH_ORIGIN="http://localhost:7700" \
MEILISEARCH_MASTER_KEY="${MEILI_MASTER_KEY}" \
NEXT_SERVER_ACTIONS_ENCRYPTION_KEY="C2EQHj06esR8k1JjOjQ/j4qfS3q9mRHukR+66RzDwq0=" \
NODE_OPTIONS="--max-old-space-size=4096" \
node server.js 2>&1 &
nextjs_pid=$!
log "Next.js PID: $nextjs_pid"

# Wait for Next.js to be ready
for i in {1..60}; do
    if curl -s --max-time 5 -o /dev/null "http://127.0.0.1:3001${_GEN_BASE_PATH}/_next/static/" 2>/dev/null; then
        log "Next.js is ready"
        break
    fi
    log "Waiting for Next.js... ($i/60)"
    sleep 2
done

# Call the meilisearch reindex endpoint
log "Calling meilisearch reindex endpoint..."
REINDEX_URL="http://127.0.0.1:3001${_GEN_BASE_PATH}/api/fern-docs/search/v2/reindex/meilisearch"
REINDEX_RESPONSE=$(curl -s --max-time 600 \
    -H "x-fern-host: ${NEXT_PUBLIC_DOCS_DOMAIN_URL}" \
    -H "Authorization: Bearer ${MEILI_MASTER_KEY}" \
    -H "Accept: application/json" \
    -X GET "$REINDEX_URL" 2>&1)
REINDEX_EXIT=$?

REINDEX_SUCCESS=false
if [ $REINDEX_EXIT -eq 0 ] && echo "$REINDEX_RESPONSE" | grep -q '"added"'; then
    # Extract the number of documents added
    DOCS_ADDED=$(echo "$REINDEX_RESPONSE" | jq -r '.added // 0' 2>/dev/null || echo "0")
    if [ "$DOCS_ADDED" -gt 0 ] 2>/dev/null; then
        log "MeiliSearch reindex completed successfully!"
        log "Reindex result: $REINDEX_RESPONSE"
        log "Documents indexed: $DOCS_ADDED"
        REINDEX_SUCCESS=true
    else
        log "WARNING: MeiliSearch reindex returned 0 documents"
        log "Response: $REINDEX_RESPONSE"
        log "This may indicate an issue with FDR data or domain resolution"
    fi
else
    log "WARNING: MeiliSearch reindex may have failed"
    log "Response: $REINDEX_RESPONSE"
    log "curl exit code: $REINDEX_EXIT"
    # Check if response is HTML (error page) instead of JSON
    if echo "$REINDEX_RESPONSE" | grep -q "<!DOCTYPE\|<html"; then
        log "ERROR: Received HTML response instead of JSON - this indicates the API route may not be working"
    fi
fi

# Stop Next.js
log "Stopping Next.js..."
kill "$nextjs_pid" 2>/dev/null || true
wait "$nextjs_pid" 2>/dev/null || true

# Create MeiliSearch dump for restoration at runtime - only if reindex succeeded
mkdir -p "$SEED_MEILI_DIR"

if [ "$REINDEX_SUCCESS" = "true" ]; then
    log "Creating MeiliSearch dump (reindex succeeded with $DOCS_ADDED documents)..."
    
    # Request a dump from MeiliSearch
    DUMP_RESPONSE=$(curl -s -X POST \
        -H "Authorization: Bearer $MEILI_MASTER_KEY" \
        -H "Content-Type: application/json" \
        "http://localhost:7700/dumps" 2>&1)
    DUMP_TASK_UID=$(echo "$DUMP_RESPONSE" | jq -r '.taskUid // empty' 2>/dev/null)

    if [ -n "$DUMP_TASK_UID" ]; then
        log "MeiliSearch dump task started (taskUid: $DUMP_TASK_UID)"
        
        # Wait for dump to complete
        for i in {1..60}; do
            TASK_STATUS=$(curl -s -H "Authorization: Bearer $MEILI_MASTER_KEY" \
                "http://localhost:7700/tasks/$DUMP_TASK_UID" 2>/dev/null)
            STATUS=$(echo "$TASK_STATUS" | jq -r '.status // "unknown"' 2>/dev/null)
            
            if [ "$STATUS" = "succeeded" ]; then
                log "MeiliSearch dump completed successfully"
                break
            elif [ "$STATUS" = "failed" ]; then
                log "WARNING: MeiliSearch dump failed"
                echo "$TASK_STATUS" | jq . 2>/dev/null || echo "$TASK_STATUS"
                break
            fi
            
            log "Waiting for MeiliSearch dump... ($i/60, status: $STATUS)"
            sleep 1
        done
        
        # Copy dump file from MeiliSearch's dump directory
        # MeiliSearch creates dumps in its db-path/dumps/ directory
        if [ -d "$MEILI_DB_PATH/dumps" ]; then
            DUMP_FILE=$(ls -t "$MEILI_DB_PATH/dumps/"*.dump 2>/dev/null | head -1)
            if [ -n "$DUMP_FILE" ] && [ -f "$DUMP_FILE" ]; then
                cp "$DUMP_FILE" "$SEED_MEILI_DIR/search.dump"
                log "MeiliSearch dump saved to $SEED_MEILI_DIR/search.dump"
                log "Dump size: $(du -h "$SEED_MEILI_DIR/search.dump" | cut -f1)"
            else
                log "WARNING: Could not find MeiliSearch dump file"
            fi
        else
            log "WARNING: MeiliSearch dumps directory not found at $MEILI_DB_PATH/dumps"
        fi
    else
        log "WARNING: Failed to start MeiliSearch dump"
        log "Response: $DUMP_RESPONSE"
    fi
else
    log "Skipping MeiliSearch dump creation (reindex did not succeed)"
    log "Search will be indexed at container startup instead"
fi

cd /fern

# Save the MeiliSearch master key for runtime use
# This allows run.sh to use the same key that was generated at build time
log "Saving MeiliSearch master key for runtime..."
echo "$MEILI_MASTER_KEY" > "$SEED_MEILI_KEY_FILE"
chmod 600 "$SEED_MEILI_KEY_FILE"

# Create marker file with metadata
log "Creating seed marker..."
MEILI_DUMP_SIZE="none"
if [ -f "$SEED_MEILI_DIR/search.dump" ]; then
    MEILI_DUMP_SIZE=$(du -h "$SEED_MEILI_DIR/search.dump" | cut -f1)
fi
cat > "$SEED_MARKER" << EOF
{
    "timestamp": "$(date -Iseconds)",
    "org_name": "$ORG_NAME",
    "docs_domain": "$NEXT_PUBLIC_DOCS_DOMAIN_URL",
    "base_path": "${NEXT_PUBLIC_BASE_PATH:-}",
    "fern_version": "$(fern --version 2>/dev/null || echo 'unknown')",
    "meilisearch_dump": "$MEILI_DUMP_SIZE"
}
EOF

# Make seed directory readable by all (for arbitrary UID runtime)
chmod -R 755 "$SEED_DIR"

# -----------  Patch basePath at build time  -----------
# Always patch basePath placeholder at build time.
# This removes the /__FERN_BP__ placeholder from the Next.js bundle, either
# replacing it with the configured NEXT_PUBLIC_BASE_PATH or removing it entirely
# for root serving. This is required for readOnlyRootFilesystem deployments
# where runtime file modifications are not possible.
if [ -n "${NEXT_PUBLIC_BASE_PATH:-}" ]; then
    log "Patching basePath placeholder at build time (NEXT_PUBLIC_BASE_PATH=${NEXT_PUBLIC_BASE_PATH})..."
else
    log "Patching basePath placeholder at build time (root serving, no basePath)..."
fi
source /scripts/patch-basepath.sh
log "basePath patching complete at build time"
# -----------  End basePath patching  -----------

# Clean up /data to avoid overlay filesystem issues at runtime
log "Cleaning up /data to avoid overlay filesystem issues..."
rm -rf /data/* 2>/dev/null || true

# -----------  Ensure nonroot user exists in /etc/passwd  -----------
# Re-verify and re-add the nonroot user entry (UID 65532) to /etc/passwd.
# This is a safeguard in case any build step inadvertently modified /etc/passwd.
# Required for readOnlyRootFilesystem deployments where /etc/passwd cannot be
# modified at runtime.
if ! grep -q '^[^:]*:[^:]*:65532:' /etc/passwd 2>/dev/null; then
    log "UID 65532 not found in /etc/passwd after generate, re-adding..."
    echo "nonroot:x:65532:65532:Nonroot User:/tmp:/bin/bash" >> /etc/passwd 2>/dev/null || true
    echo "nonroot:x:65532:" >> /etc/group 2>/dev/null || true
else
    log "UID 65532 confirmed in /etc/passwd"
fi

# If FERN_RUN_AS_UID is set, add that UID to /etc/passwd at build time.
# This is required for readOnlyRootFilesystem deployments with arbitrary UIDs.
# Customers set this as an env var or build arg in their Dockerfile:
#   ENV FERN_RUN_AS_UID=1000
#   RUN /scripts/generate.sh
if [ -n "${FERN_RUN_AS_UID:-}" ] && [ "${FERN_RUN_AS_UID}" != "65532" ] && [ "${FERN_RUN_AS_UID}" != "0" ]; then
    if ! grep -q "^[^:]*:[^:]*:${FERN_RUN_AS_UID}:" /etc/passwd 2>/dev/null; then
        echo "fern:x:${FERN_RUN_AS_UID}:0:Fern User:/tmp:/bin/bash" >> /etc/passwd 2>/dev/null || true
        echo "fern:x:${FERN_RUN_AS_UID}:" >> /etc/group 2>/dev/null || true
        log "Added custom user (UID ${FERN_RUN_AS_UID}) to /etc/passwd"
    else
        log "UID ${FERN_RUN_AS_UID} already exists in /etc/passwd"
    fi
fi
# -----------  End nonroot user safeguard  -----------

log "=========================================="
log "Build-time seeding complete!"
log "=========================================="
log "Seeded data location: $SEED_DIR"
log "  - PostgreSQL dump: $SEED_POSTGRES_DUMP"
log "  - SeaweedFS data: $SEED_SEAWEEDFS_DIR"
if [ -f "$SEED_MEILI_DIR/search.dump" ]; then
    log "  - MeiliSearch dump: $SEED_MEILI_DIR/search.dump ($MEILI_DUMP_SIZE)"
else
    log "  - MeiliSearch dump: (not created - search will be indexed at runtime)"
fi
log "  - Marker: $SEED_MARKER"
log ""
log "The container will automatically use this seeded data at runtime."
log "No network access will be required for docs generation."
if [ -f "$SEED_MEILI_DIR/search.dump" ]; then
    log "Search will be available immediately (pre-indexed at build time)."
else
    log "Search will be indexed at container startup (may take several minutes)."
fi
log "=========================================="

# Cleanup is handled by trap
exit 0
