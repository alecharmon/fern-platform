#!/bin/bash
# Build-time seeding script for self-hosted Fern docs
# This script runs during `docker build` (customer's Dockerfile) to:
# 1. Restore the pre-migrated database schema from the base image
# 2. Start all services (Postgres, MinIO, MeiliSearch, FDR)
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
#   --only-deps    Start services (Postgres, MinIO, FDR) but skip fern generate.
#                  Use this when you want to defer docs generation to runtime.
#                  The container will run fern generate --docs at startup.
#
# The seeded data is stored in /opt/fern-seed/ and will be restored at runtime.
# This allows the container to run in air-gapped environments without network access.

set -euo pipefail

# Parse command line arguments
ONLY_DEPS=false
while [[ $# -gt 0 ]]; do
    case $1 in
        --only-deps)
            ONLY_DEPS=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--only-deps]"
            exit 1
            ;;
    esac
done

# Base image artifacts (created during base image build)
BASE_SEED_DIR="/opt/fern-base"
BASE_SCHEMA_DUMP="$BASE_SEED_DIR/postgres-schema.dump"

# Customer seed artifacts (created by this script)
SEED_DIR="/opt/fern-seed"
SEED_MINIO_DIR="$SEED_DIR/minio"
SEED_POSTGRES_DUMP="$SEED_DIR/postgres.dump"
SEED_MARKER="$SEED_DIR/.seeded"

# Timestamp logging function
log() {
    echo "[SEED $(date '+%Y-%m-%d %H:%M:%S')] $*"
}

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
    
    # Stop FDR
    if [ -n "${fdr_pid:-}" ] && kill -0 "$fdr_pid" 2>/dev/null; then
        log "Stopping FDR (PID: $fdr_pid)..."
        kill "$fdr_pid" 2>/dev/null || true
        wait "$fdr_pid" 2>/dev/null || true
    fi
    
    # Stop MinIO
    if [ -n "${minio_pid:-}" ] && kill -0 "$minio_pid" 2>/dev/null; then
        log "Stopping MinIO (PID: $minio_pid)..."
        kill "$minio_pid" 2>/dev/null || true
        wait "$minio_pid" 2>/dev/null || true
    fi
    
    # Stop MeiliSearch
    if [ -n "${meili_pid:-}" ] && kill -0 "$meili_pid" 2>/dev/null; then
        log "Stopping MeiliSearch (PID: $meili_pid)..."
        kill "$meili_pid" 2>/dev/null || true
        wait "$meili_pid" 2>/dev/null || true
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

export PGDATA=/tmp/postgresql/data
export PGHOST=/tmp

rm -rf "$PGDATA" 2>/dev/null || true
mkdir -p "$PGDATA"

# Ensure postgres user owns the data directory (needed when running as root)
if [ "$(id -u)" = "0" ]; then
    chown -R postgres:postgres "$PGDATA"
    chown postgres:postgres /tmp
fi

log "Initializing PostgreSQL cluster..."
run_as_postgres "PGDATA=$PGDATA initdb -D $PGDATA --auth-local=trust --auth-host=trust --username=postgres" 2>&1 || {
    log "ERROR: Failed to initialize PostgreSQL"
    exit 1
}

run_as_postgres "PGDATA=$PGDATA pg_ctl -D $PGDATA -o \"-c listen_addresses='localhost' -c unix_socket_directories='/tmp' -c shared_buffers=128MB -c max_connections=200\" -l $PGDATA/logfile start" 2>&1 || {
    log "ERROR: Failed to start PostgreSQL"
    exit 1
}

# Wait for PostgreSQL to be ready
for i in {1..30}; do
    if pg_isready -h /tmp -p 5432 2>/dev/null; then
        log "PostgreSQL is ready"
        break
    fi
    log "Waiting for PostgreSQL... ($i/30)"
    sleep 1
done

# Create database
run_as_postgres "createdb -h /tmp -p 5432 -U postgres fdr" 2>&1 | add_timestamps || log "Database 'fdr' may already exist"

# Restore schema from base image dump or run migrations
if [ "$USE_BASE_SCHEMA" = "true" ]; then
    log "Restoring database schema from base image dump..."
    run_as_postgres "pg_restore -h /tmp -p 5432 -U postgres -d fdr --clean --if-exists $BASE_SCHEMA_DUMP" 2>&1 | add_timestamps || {
        log "Warning: pg_restore had some errors (this may be normal for clean restore)"
    }
    log "Schema restored from base image dump"
else
    log "Running Prisma migrations..."
    DATABASE_URL=postgresql://postgres:postgres@localhost:5432/fdr \
        prisma migrate deploy --schema /prisma/schema.prisma 2>&1 | add_timestamps || {
        log "ERROR: Prisma migrations failed"
        exit 1
    }
fi

# -----------  Start MeiliSearch  -----------
log "Starting MeiliSearch for seeding..."
export MEILI_HTTP_ADDR=0.0.0.0:7700

cd /tmp
/meilisearch --master-key="fern123!" 2>&1 &
meili_pid=$!
log "MeiliSearch PID: $meili_pid"

# Wait for MeiliSearch
for i in {1..30}; do
    if curl -f -s -H "Authorization: Bearer fern123!" http://localhost:7700/health 2>/dev/null; then
        log "MeiliSearch is ready"
        break
    fi
    log "Waiting for MeiliSearch... ($i/30)"
    sleep 1
done

# -----------  Start MinIO  -----------
log "Starting MinIO for seeding..."

# Use /data for MinIO (will be copied to seed dir later)
minio server /data --console-address ":9001" 2>&1 &
minio_pid=$!
log "MinIO PID: $minio_pid"

# Wait for MinIO
for i in {1..30}; do
    if curl -f -s http://localhost:9000/minio/health/live 2>/dev/null; then
        log "MinIO is ready"
        break
    fi
    log "Waiting for MinIO... ($i/30)"
    sleep 1
done

# Initialize MinIO buckets
mc alias set minio http://localhost:9000 minioadmin minioadmin 2>&1

# Create the .docs.buildwithfern.com bucket
mc mb minio/${ORG_NAME}.docs.buildwithfern.com 2>&1 || log "Bucket may already exist"
mc anonymous set download minio/${ORG_NAME}.docs.buildwithfern.com 2>&1
export MINIO_BUCKET_NAME=${ORG_NAME}.docs.buildwithfern.com

# Create custom domain bucket if specified (CUSTOM_DOMAIN is cleared if invalid)
if [ -n "$CUSTOM_DOMAIN" ]; then
    CUSTOM_DOMAIN_CLEANED=$(echo "$CUSTOM_DOMAIN" | sed -E 's#^https?://##' | cut -d'/' -f1 | tr -d ':')
    if mc mb minio/${CUSTOM_DOMAIN_CLEANED} 2>&1; then
        log "Created custom domain bucket: ${CUSTOM_DOMAIN_CLEANED}"
    else
        log "Custom domain bucket may already exist or failed to create"
    fi
    if mc anonymous set download minio/${CUSTOM_DOMAIN_CLEANED} 2>&1; then
        export MINIO_BUCKET_NAME=${CUSTOM_DOMAIN_CLEANED}
        log "Using custom domain bucket: ${CUSTOM_DOMAIN_CLEANED}"
    else
        log "WARNING: Failed to set anonymous download on custom domain bucket, using default bucket"
    fi
fi

export MINIO_URL="http://localhost:9000"
export MINIO_ROOT_USER="minioadmin"
export MINIO_ROOT_PASSWORD="minioadmin"

# -----------  Start FDR  -----------
log "Starting FDR for seeding..."

export LOCAL_MODE_OVERRIDE=true
export S3_FORCE_PATH_STYLE=true
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/fdr

node /fdr/server.cjs 2>&1 &
fdr_pid=$!
log "FDR PID: $fdr_pid"

# Wait for FDR
for i in {1..30}; do
    if curl -f -s http://localhost:8080/health 2>/dev/null; then
        log "FDR is ready"
        break
    fi
    log "Waiting for FDR... ($i/30)"
    sleep 1
done

# -----------  Generate Docs  -----------
if [ "$ONLY_DEPS" = "true" ]; then
    log "=========================================="
    log "--only-deps mode: Skipping fern generate --docs"
    log "=========================================="
    log "Services (Postgres, MinIO, FDR) have been started and are ready."
    log "Docs generation will happen at runtime instead."
    log ""
    log "Note: If your project uses BSR dependencies (buf.build modules),"
    log "you may need to vendor them locally for air-gapped environments."
    log "=========================================="
    
    # Clean up services before exiting
    log "Cleaning up services..."
    rm -rf /data/* /data/.minio.sys 2>/dev/null || true
    
    # Cleanup is handled by trap
    exit 0
fi

log "=========================================="
log "Running fern generate --docs"
log "=========================================="

cd /fern

FERN_SELF_HOSTED=true \
FERN_TOKEN=dummy \
OVERRIDE_FDR_ORIGIN=http://localhost:8080 \
FERN_NO_VERSION_REDIRECTION=true \
fern generate --docs --log-level debug --no-prompt 2>&1 || {
    log "ERROR: fern generate --docs failed"
    log "This may be due to network issues fetching dependencies."
    log "Ensure your build environment has network access."
    exit 1
}

log "Docs generated successfully!"

# -----------  Save Seeded Data  -----------
log "=========================================="
log "Saving seeded data to $SEED_DIR"
log "=========================================="

# Dump PostgreSQL database (full data, not just schema)
log "Dumping PostgreSQL database..."
run_as_postgres "pg_dump -h /tmp -p 5432 -U postgres -Fc fdr" > "$SEED_POSTGRES_DUMP" || {
    log "ERROR: Failed to dump PostgreSQL database"
    exit 1
}
log "PostgreSQL dump saved to $SEED_POSTGRES_DUMP"

# Copy MinIO data
log "Copying MinIO data..."
mkdir -p "$SEED_MINIO_DIR"
cp -r /data/* "$SEED_MINIO_DIR/" 2>/dev/null || true
log "MinIO data saved to $SEED_MINIO_DIR"

# Create marker file with metadata
log "Creating seed marker..."
cat > "$SEED_MARKER" << EOF
{
    "timestamp": "$(date -Iseconds)",
    "org_name": "$ORG_NAME",
    "docs_domain": "$NEXT_PUBLIC_DOCS_DOMAIN_URL",
    "base_path": "${NEXT_PUBLIC_BASE_PATH:-}",
    "fern_version": "$(fern --version 2>/dev/null || echo 'unknown')"
}
EOF

# Make seed directory readable by all (for arbitrary UID runtime)
chmod -R 755 "$SEED_DIR"

# Clean up /data to avoid MinIO overlay filesystem issues at runtime
# MinIO creates .minio.sys which can cause "rename across devices" errors
# if it's baked into the image layer and MinIO tries to manipulate it at runtime
log "Cleaning up /data to avoid overlay filesystem issues..."
rm -rf /data/* /data/.minio.sys 2>/dev/null || true

log "=========================================="
log "Build-time seeding complete!"
log "=========================================="
log "Seeded data location: $SEED_DIR"
log "  - PostgreSQL dump: $SEED_POSTGRES_DUMP"
log "  - MinIO data: $SEED_MINIO_DIR"
log "  - Marker: $SEED_MARKER"
log ""
log "The container will automatically use this seeded data at runtime."
log "No network access will be required for docs generation."
log "=========================================="

# Cleanup is handled by trap
exit 0
