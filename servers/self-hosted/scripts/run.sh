#!/bin/bash
set -euo pipefail

# Timestamp logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

# Pipe filter that adds timestamps to each line
add_timestamps() {
    while IFS= read -r line; do
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] $line"
    done
}

# Check for build-time seeded data
SEED_DIR="/opt/fern-seed"
SEED_MARKER="$SEED_DIR/.seeded"
SEED_MINIO_DIR="$SEED_DIR/minio"
SEED_POSTGRES_DUMP="$SEED_DIR/postgres.dump"
USE_SEEDED_DATA=false

if [ -f "$SEED_MARKER" ]; then
    log "=========================================="
    log "Detected build-time seeded data at $SEED_DIR"
    log "=========================================="
    cat "$SEED_MARKER" 2>/dev/null | while IFS= read -r line; do log "  $line"; done
    USE_SEEDED_DATA=true
    log "Will restore seeded data instead of running fern generate --docs"
    log "=========================================="
fi

if [ ! -d "/fern" ]; then
    log "Fern folder not found. Please ensure you are mounting yours in."
    exit 1
fi

# -----------  Fix permissions on customer-provided directories  -----------
# When running as a non-root UID (common in Kubernetes), directories copied
# during build time may have restrictive permissions (e.g., owned by root).
# This makes them readable by the runtime UID to avoid EACCES errors.
# Only attempt chmod if running as root (which can change any permissions).
CURRENT_UID=$(id -u)
if [ "$CURRENT_UID" = "0" ]; then
    log "Running as root, ensuring customer directories are readable..."
    # /fern - main Fern project directory
    chmod -R a+rX /fern 2>/dev/null || log "Warning: Could not fix permissions on /fern"
    # /protos - protobuf dependencies (if exists)
    if [ -d "/protos" ]; then
        chmod -R a+rX /protos 2>/dev/null || log "Warning: Could not fix permissions on /protos"
    fi
    # /api - API specs (if exists)
    if [ -d "/api" ]; then
        chmod -R a+rX /api 2>/dev/null || log "Warning: Could not fix permissions on /api"
    fi
fi
# -----------  End permission fixes  -----------

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

# Export BASE_PATH if set (for health checks and other scripts)
export NEXT_PUBLIC_BASE_PATH="${NEXT_PUBLIC_BASE_PATH:-}"

# -----------  Start Postgres setup  -----------
log "Starting PostgreSQL service..."

# Function to start PostgreSQL - always initializes at runtime to avoid permission conflicts
start_postgresql() {
    local CURRENT_UID=$(id -u)

    # Use UID-scoped directories to avoid permission conflicts when container
    # is restarted with a different UID (e.g., root -> non-root or vice versa)
    # This prevents "Permission denied" errors from stale directories owned by other UIDs
    export PGBASE="/tmp/postgresql-${CURRENT_UID}"
    export PGDATA="${PGBASE}/data"
    export PGHOST="${PGBASE}"

    # Clean up any previous attempts for THIS UID
    rm -rf "$PGDATA" 2>/dev/null || true
    rm -rf "$PGBASE" 2>/dev/null || true
    mkdir -p "$PGDATA"

    log "Initializing PostgreSQL cluster in $PGDATA (UID: $CURRENT_UID)..."

    # Verify we have proper access to the directory
    if [ ! -w "$PGDATA" ] || [ ! -x "$PGDATA" ]; then
        log "ERROR: Cannot write to or execute in $PGDATA"
        ls -ld "$PGBASE" "$PGDATA" 2>&1 | add_timestamps || true
        return 1
    fi

    # Check if running as root - root cannot run initdb directly
    if [ "$CURRENT_UID" -eq 0 ]; then
        log "Running as root, using 'su - postgres' to initialize and run PostgreSQL..."

        # Change ownership of the data directory to postgres user
        chown -R postgres:postgres "$PGBASE"

        # Initialize as postgres user
        if ! su - postgres -c "initdb -D $PGDATA --auth-local=trust --auth-host=trust --username=postgres" 2>&1 | add_timestamps; then
            log "ERROR: Failed to initialize PostgreSQL as postgres user"
            return 1
        fi

        # Start PostgreSQL as postgres user with UID-scoped socket directory
        # Use mmap for dynamic shared memory to avoid /dev/shm size issues in Kubernetes
        if ! su - postgres -c "pg_ctl -D $PGDATA -o \"-c listen_addresses='localhost' -c unix_socket_directories='$PGBASE' -c shared_buffers=128MB -c max_connections=200 -c logging_collector=on -c log_line_prefix='%t ' -c dynamic_shared_memory_type=mmap\" -l $PGDATA/logfile start" 2>&1 | add_timestamps; then
            log "ERROR: Failed to start PostgreSQL"
            cat "$PGDATA/logfile" 2>/dev/null | add_timestamps
            return 1
        fi
    else
        log "Running as UID $CURRENT_UID, initializing PostgreSQL directly..."

        # Non-root can run initdb directly
        if ! initdb -D "$PGDATA" --auth-local=trust --auth-host=trust --username=postgres 2>&1 | add_timestamps; then
            log "ERROR: Failed to initialize PostgreSQL"
            return 1
        fi

        # Start PostgreSQL with UID-scoped socket directory
        # Use mmap for dynamic shared memory to avoid /dev/shm size issues in Kubernetes
        if ! pg_ctl -D "$PGDATA" \
            -o "-c listen_addresses='localhost' -c unix_socket_directories='$PGBASE' -c shared_buffers=128MB -c max_connections=200 -c logging_collector=on -c log_line_prefix='%t ' -c dynamic_shared_memory_type=mmap" \
            -l "$PGDATA/logfile" \
            start 2>&1 | add_timestamps; then
            log "ERROR: Failed to start PostgreSQL"
            cat "$PGDATA/logfile" 2>/dev/null | add_timestamps
            return 1
        fi
    fi

    log "PostgreSQL started successfully"

    # Wait for PostgreSQL to be ready (use UID-scoped socket directory)
    for i in {1..30}; do
        if pg_isready -h "$PGBASE" -p 5432 2>/dev/null; then
            log "PostgreSQL is ready"
            break
        fi
        log "Waiting for PostgreSQL to start... ($i/30)"
        sleep 1
    done

    # Create the database (use UID-scoped socket directory)
    log "Creating database 'fdr'..."
    if [ "$CURRENT_UID" -eq 0 ]; then
        su - postgres -c "createdb -h $PGBASE -U postgres fdr" 2>&1 | add_timestamps || true
    else
        createdb -h "$PGBASE" -U postgres fdr 2>&1 | add_timestamps || true
    fi

    # Update DATABASE_URL for Prisma to use the UID-scoped Unix socket
    export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/fdr?host=${PGBASE}"
    log "DATABASE_URL configured for Unix socket in $PGBASE"

    # Write PGBASE to a known file so health check scripts can find the socket directory
    echo "$PGBASE" > /tmp/postgres-socket-dir

    return 0
}

# Start PostgreSQL with appropriate method
start_postgresql

log "PostgreSQL service started."

# Use pidof or ps to get postgres PID (pgrep might not be available)
postgres_pid=$(pidof postgres || ps aux | grep postgres | grep -v grep | awk '{print $2}' | head -1 || true)
log "PostgreSQL PID: $postgres_pid"

log "Creating Postgres database..."

log "Running database migrations..."

# Handle Prisma migrations with fallback for write permissions
run_prisma_migrations() {
    # First try the standard migration
    if DATABASE_URL=${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/fdr} \
        prisma migrate deploy --schema /prisma/schema.prisma 2>&1 | add_timestamps; then
        log "Prisma migrations completed successfully"
        return 0
    fi

    log "Standard Prisma migration failed, trying with alternative engine location..."

    # Set alternative Prisma engine locations if we don't have write access
    export PRISMA_QUERY_ENGINE_BINARY="${PRISMA_QUERY_ENGINE_BINARY:-/opt/prisma-engines/query-engine}"
    export PRISMA_MIGRATION_ENGINE_BINARY="${PRISMA_MIGRATION_ENGINE_BINARY:-/opt/prisma-engines/migration-engine}"
    export PRISMA_INTROSPECTION_ENGINE_BINARY="${PRISMA_INTROSPECTION_ENGINE_BINARY:-/opt/prisma-engines/introspection-engine}"
    export PRISMA_FMT_BINARY="${PRISMA_FMT_BINARY:-/opt/prisma-engines/prisma-fmt}"

    # Try again with the alternative locations
    DATABASE_URL=${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/fdr} \
        prisma migrate deploy --schema /prisma/schema.prisma 2>&1 | add_timestamps || {
        log "Warning: Prisma migrations failed, but continuing..."
        return 1
    }
}

# If seeded data exists, restore from dump instead of running migrations
if [ "$USE_SEEDED_DATA" = "true" ] && [ -f "$SEED_POSTGRES_DUMP" ]; then
    log "Restoring PostgreSQL from seeded dump..."
    CURRENT_UID=$(id -u)
    if [ "$CURRENT_UID" -eq 0 ]; then
        su - postgres -c "pg_restore -h $PGBASE -p 5432 -U postgres -d fdr --clean --if-exists '$SEED_POSTGRES_DUMP'" 2>&1 | add_timestamps || {
            log "Warning: pg_restore had some errors (this may be normal for clean restore)"
        }
    else
        pg_restore -h "$PGBASE" -p 5432 -U postgres -d fdr --clean --if-exists "$SEED_POSTGRES_DUMP" 2>&1 | add_timestamps || {
            log "Warning: pg_restore had some errors (this may be normal for clean restore)"
        }
    fi
    log "PostgreSQL restored from seeded dump"
else
    run_prisma_migrations
fi
# -----------  End Postgres setup  -----------

# -----------  Start MeiliSearch setup  -----------
export MEILI_HTTP_ADDR=0.0.0.0:7700

# Use UID-scoped directory for MeiliSearch data to avoid permission conflicts
# When running as an arbitrary UID (e.g., 65532), we can't use directories
# that may have been created by root during build time due to /tmp sticky bit
CURRENT_UID=$(id -u)
MEILI_DB_PATH="/tmp/meilisearch-${CURRENT_UID}"

# Clean up any previous MeiliSearch data for this UID and create fresh directory
rm -rf "$MEILI_DB_PATH" 2>/dev/null || true
mkdir -p "$MEILI_DB_PATH"

# Change to the MeiliSearch data directory before starting
# MeiliSearch may use relative paths for dumps, snapshots, and other files
# so we need to ensure the working directory is writable by the current UID
cd "$MEILI_DB_PATH"

log "Starting MeiliSearch with db-path: $MEILI_DB_PATH..."
/meilisearch --master-key="fern123!" --db-path "$MEILI_DB_PATH" 2>&1 | tee /tmp/meilisearch.log | add_timestamps &
meili_pid=$!
log "MeiliSearch PID: $meili_pid"

# Wait for MeiliSearch to be ready
log "Waiting for MeiliSearch to start..."
MEILI_ATTEMPTS=0
MAX_MEILI_ATTEMPTS=30
until curl -f -H "Authorization: Bearer fern123!" http://localhost:7700/health 2>/dev/null; do
    MEILI_ATTEMPTS=$((MEILI_ATTEMPTS + 1))
    if [ $MEILI_ATTEMPTS -ge $MAX_MEILI_ATTEMPTS ]; then
        log "WARNING: MeiliSearch failed to start after $MAX_MEILI_ATTEMPTS attempts"
        log "WARNING: Search functionality will not work"
        log "MeiliSearch logs:"
        cat /tmp/meilisearch.log 2>/dev/null || log "No log file found"
        break
    fi
    log "MeiliSearch not ready yet, waiting 2 seconds... ($MEILI_ATTEMPTS/$MAX_MEILI_ATTEMPTS)"
    sleep 2
done

if [ $MEILI_ATTEMPTS -lt $MAX_MEILI_ATTEMPTS ]; then
    log "MeiliSearch is ready!"
fi

export MEILISEARCH_URL="http://localhost:7700"
# -----------  End MeiliSearch setup  -----------

# -----------  Start Jaeger setup (optional, for debugging)  -----------
# Jaeger is only started if ENABLE_JAEGER=true was set during docker build
jaeger_pid=0
if [ "${ENABLE_JAEGER:-false}" = "true" ]; then
    log "Starting Jaeger (ENABLE_JAEGER=true)..."
    # Start Jaeger all-in-one for tracing
    # Ports: 16686 (UI), 4317 (OTLP gRPC), 4318 (OTLP HTTP)
    /usr/local/bin/jaeger 2>&1 | tee /tmp/jaeger.log | add_timestamps &
    jaeger_pid=$!
    log "Jaeger PID: $jaeger_pid"

    # Wait for Jaeger to be ready
    log "Waiting for Jaeger to start..."
    JAEGER_ATTEMPTS=0
    MAX_JAEGER_ATTEMPTS=30
    until curl -f http://localhost:16686/ 2>/dev/null; do
        JAEGER_ATTEMPTS=$((JAEGER_ATTEMPTS + 1))
        if [ $JAEGER_ATTEMPTS -ge $MAX_JAEGER_ATTEMPTS ]; then
            log "WARNING: Jaeger failed to start after $MAX_JAEGER_ATTEMPTS attempts"
            log "WARNING: Tracing functionality will not work"
            log "Jaeger logs:"
            cat /tmp/jaeger.log 2>/dev/null || log "No log file found"
            break
        fi
        log "Jaeger not ready yet, waiting 2 seconds... ($JAEGER_ATTEMPTS/$MAX_JAEGER_ATTEMPTS)"
        sleep 2
    done

    if [ $JAEGER_ATTEMPTS -lt $MAX_JAEGER_ATTEMPTS ]; then
        log "Jaeger is ready!"
        log "Jaeger UI available at http://localhost:16686"
    fi

    # Set OTEL environment variables to send traces to Jaeger
    export OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:4318"
    export OTEL_TRACES_EXPORTER="otlp"
    export OTEL_SERVICE_NAME="fern-self-hosted"
    log "OTEL traces configured to send to Jaeger at $OTEL_EXPORTER_OTLP_ENDPOINT"
else
    log "Skipping Jaeger startup (ENABLE_JAEGER not set to true)"
fi

# -----------  End Jaeger setup  -----------

# -----------  Start MINIO setup  -----------

# Configure MinIO client (mc) to use a writable config directory
# When running as an arbitrary UID (e.g., 65532) that doesn't exist in /etc/passwd,
# $HOME may default to "/" which isn't writable, causing "mc alias set" to fail.
# Setting MC_CONFIG_DIR ensures mc can write its config regardless of the UID.
# Use UID-scoped directory to avoid permission conflicts in Kubernetes environments
# where /tmp/mc-config might exist but be owned by a different user from build time.
CURRENT_UID=$(id -u)
export MC_CONFIG_DIR="/tmp/mc-config-${CURRENT_UID}"
mkdir -p "$MC_CONFIG_DIR"
chmod 700 "$MC_CONFIG_DIR" 2>/dev/null || true

# Determine MinIO data directory - use UID-scoped directory to avoid permission conflicts
# When running as an arbitrary UID (e.g., 65532), /data may not be writable if:
# 1. It's a mounted volume with restrictive permissions
# 2. Seeded data was copied with restrictive permissions
# Fall back to /data only if it's writable, otherwise use UID-scoped /tmp directory
# Note: CURRENT_UID is already set above when configuring MC_CONFIG_DIR
MINIO_DATA_DIR="/tmp/minio-data-${CURRENT_UID}"

# Check if /data is writable by trying to create a test file
if touch /data/.write-test 2>/dev/null; then
    rm -f /data/.write-test
    MINIO_DATA_DIR="/data"
    log "Using /data for MinIO (writable)"
else
    log "Using UID-scoped directory for MinIO: $MINIO_DATA_DIR (/data is not writable)"
    mkdir -p "$MINIO_DATA_DIR"
fi

# Clean up any existing MinIO system files to avoid overlay filesystem issues
# MinIO's .minio.sys can cause "rename across devices" errors if it exists from a previous layer
log "Cleaning up MinIO system files..."
rm -rf "$MINIO_DATA_DIR/.minio.sys" 2>/dev/null || true

# If seeded data exists, restore MinIO data before starting
if [ "$USE_SEEDED_DATA" = "true" ] && [ -d "$SEED_MINIO_DIR" ]; then
    log "Restoring MinIO data from seeded backup..."
    # Copy seeded data to MinIO data directory (use /. to include hidden files if any)
    if cp -r "$SEED_MINIO_DIR"/. "$MINIO_DATA_DIR/" 2>&1 | add_timestamps; then
        log "MinIO data restored from $SEED_MINIO_DIR to $MINIO_DATA_DIR"
    else
        log "WARNING: Failed to restore MinIO data from $SEED_MINIO_DIR"
    fi
    # Remove .minio.sys again in case it was in the seed (it shouldn't be, but just in case)
    rm -rf "$MINIO_DATA_DIR/.minio.sys" 2>/dev/null || true
fi

# Update MINIO_VOLUMES to use the determined data directory
export MINIO_VOLUMES="$MINIO_DATA_DIR"

log "Starting MinIO server with data directory: $MINIO_DATA_DIR..."
minio server ${MINIO_VOLUMES} --console-address ":9001" 2>&1 | tee /tmp/minio.log | add_timestamps &
minio_pid=$!
log "MinIO PID: $minio_pid"

# Wait for MinIO to be ready
log "Waiting for MinIO to start..."
until curl -f ${MINIO_URL}/minio/health/live 2>/dev/null; do
    log "MinIO not ready yet, waiting 2 seconds..."
    sleep 2
done
log "MinIO is ready!"

# Initialize MinIO
mc alias set minio ${MINIO_URL} ${MINIO_USERNAME} ${MINIO_PASSWORD} 2>&1 | add_timestamps

# Create buckets (use || true to handle case where bucket already exists from seeded data)
mc mb minio/${ORG_NAME}.docs.buildwithfern.com 2>&1 | add_timestamps || true
mc anonymous set download minio/${ORG_NAME}.docs.buildwithfern.com 2>&1 | add_timestamps
export MINIO_BUCKET_NAME=${ORG_NAME}.docs.buildwithfern.com

# Also create the custom domain bucket if specified (CUSTOM_DOMAIN is cleared if invalid)
if [ -n "$CUSTOM_DOMAIN" ]; then
    # Remove any slashes from the custom domain bucket name
    # Only grab the host part of the custom domain (strip protocol and path)
    CUSTOM_DOMAIN_CLEANED=$(echo "$CUSTOM_DOMAIN" | sed -E 's#^https?://##' | cut -d'/' -f1 | tr -d ':')
    # Use the cleaned custom domain for bucket creation and export (use || true for seeded case)
    mc mb minio/${CUSTOM_DOMAIN_CLEANED} 2>&1 | add_timestamps || true
    if mc anonymous set download minio/${CUSTOM_DOMAIN_CLEANED} 2>&1 | add_timestamps; then
        export MINIO_BUCKET_NAME=${CUSTOM_DOMAIN_CLEANED}
        log "Using custom domain bucket: ${CUSTOM_DOMAIN_CLEANED}"
    else
        log "WARNING: Failed to set anonymous download on custom domain bucket, using default bucket"
    fi
fi

# Always use path-style S3 access for self-hosted mode (simpler and more reliable)
# This tells the AWS SDK to generate URLs like http://localhost:9000/bucket/file
# instead of http://bucket.localhost:9000/file
export S3_FORCE_PATH_STYLE=true

# Configure FILES_ORIGIN for the Next.js app
# Use path-based routing for consistency with FDR
NEXT_PUBLIC_FILES_ORIGIN="http://localhost:9000/${MINIO_BUCKET_NAME}"

# -----------  End MINIO setup  -----------

# Enable local mode for FDR to skip external auth calls (Venus)
# This is required for air-gapped environments where external network access is not available
export LOCAL_MODE_OVERRIDE=true

log "Starting FDR server..."
node /fdr/server.cjs 2>&1 | tee /tmp/fdr.log | add_timestamps &
fdr_pid=$!
log "FDR server PID: $fdr_pid"

log "Waiting for FDR to start at localhost:8080/health..."
until curl -f http://localhost:8080/health 2>/dev/null; do
    log "FDR not ready yet, waiting 2 seconds..."
    sleep 2
done
log "FDR is up and running at localhost:8080/health"


# --------------  Generate docs and insert into MinIO via FDR --------------

# Track docs generation status for readiness checks
DOCS_GENERATION_STATUS_FILE="/tmp/docs-generation-status"

# Skip docs generation if using seeded data (docs were pre-generated at build time)
if [ "$USE_SEEDED_DATA" = "true" ]; then
    log "=========================================="
    log "Skipping fern generate --docs (using seeded data)"
    log "=========================================="
    log "Docs were pre-generated at build time and restored from seeded data."
    log "No network access required for docs generation."
    echo '{"timestamp": "'$(date -Iseconds)'", "status": "success", "source": "seeded"}' > "$DOCS_GENERATION_STATUS_FILE"
else
    log "running fern generate --docs"

    # Ensure buf cache directory exists and is writable
    # This is needed when running as non-root user (e.g., UID 65532)
    # The directory may already exist from build time (generate.sh --only-deps)
    if [ ! -d "/opt/buf-cache" ]; then
        log "Creating buf cache directory at /opt/buf-cache..."
        mkdir -p /opt/buf-cache 2>/dev/null || {
            log "WARNING: Could not create /opt/buf-cache (permission denied)"
            log "Using /tmp/buf-cache as fallback for buf cache"
            export BUF_CACHE_DIR=/tmp/buf-cache
            mkdir -p /tmp/buf-cache
        }
    fi

    log "Disk usage before fern generate:"
    df -h 2>&1 | add_timestamps || true
    log "Inode usage:"
    df -i 2>&1 | add_timestamps || true
    log "MinIO data directory size:"
    du -sh /data 2>&1 | add_timestamps || true

    # Run fern generate --docs - if this fails, the container will exit
    # FERN_LOG_LEVEL can be set to control verbosity (debug, info, warn, error). Defaults to debug for backwards compatibility.
    # BUF_CACHE_DIR is set to use cached buf dependencies from build time (if available)
    # Use the BUF_CACHE_DIR set above (either /opt/buf-cache or /tmp/buf-cache fallback)
    set +e
    FERN_GENERATE_OUTPUT=$(BUF_CACHE_DIR="${BUF_CACHE_DIR:-/opt/buf-cache}" FERN_SELF_HOSTED=true FERN_TOKEN=dummy OVERRIDE_FDR_ORIGIN=http://localhost:8080 FERN_NO_VERSION_REDIRECTION=true fern generate --docs --log-level "${FERN_LOG_LEVEL:-debug}" --no-prompt 2>&1)
    FERN_GENERATE_EXIT_CODE=$?
    echo "$FERN_GENERATE_OUTPUT" | add_timestamps
    set -e

    if [ $FERN_GENERATE_EXIT_CODE -eq 0 ]; then
        log "Docs generated successfully"
        echo '{"timestamp": "'$(date -Iseconds)'", "status": "success"}' > "$DOCS_GENERATION_STATUS_FILE"
    else
        log "ERROR: fern generate --docs failed with exit code $FERN_GENERATE_EXIT_CODE"
        
        # Check if the error is related to network/egress issues (Buf BSR, remote URLs, etc.)
        if echo "$FERN_GENERATE_OUTPUT" | grep -qi "server hosted at that remote is unavailable\|buf.build\|api.buf.build\|network\|ECONNREFUSED\|ETIMEDOUT\|getaddrinfo"; then
            log "============================================================"
            log "NETWORK/EGRESS ERROR DETECTED"
            log "============================================================"
            log "The docs generation failed due to network connectivity issues."
            log "This is common in air-gapped or egress-restricted environments."
            log ""
            log "Possible causes:"
            log "  1. Your Fern project has protobuf dependencies that reference buf.build"
            log "     (e.g., buf.build/googleapis/googleapis in your buf.yaml deps)"
            log "  2. Your API specs reference remote URLs (https://...) instead of local files"
            log "  3. Egress to external services is blocked by network policies"
            log ""
            log "Solutions:"
            log "  1. Vendor protobuf dependencies locally in your repo"
            log "  2. Use local file paths instead of URLs for API specs"
            log "  3. Pre-generate docs at build time using /scripts/generate.sh"
            log "  4. Add required Buf modules to BUF_BSR_MODULES build-arg when building the image"
            log "============================================================"
            echo '{"timestamp": "'$(date -Iseconds)'", "status": "failed", "reason": "network_egress_error", "exit_code": '$FERN_GENERATE_EXIT_CODE'}' > "$DOCS_GENERATION_STATUS_FILE"
        else
            log "Docs generation failed for a non-network reason. Check the logs above for details."
            echo '{"timestamp": "'$(date -Iseconds)'", "status": "failed", "reason": "generation_error", "exit_code": '$FERN_GENERATE_EXIT_CODE'}' > "$DOCS_GENERATION_STATUS_FILE"
        fi
        
        log "FATAL: Docs generation failed. Container will exit."
        log "FATAL: There is no point in running a docs server without docs."
        exit 1
    fi
fi

# --------------  Finish generate docs --------------

# --------------  Start nextapp --------------

# Next.js runs on internal port 3001, cache proxy runs on external port 3000
NEXTJS_INTERNAL_PORT=3001
CACHE_PROXY_PORT=3000

log "Starting Next.js on internal port ${NEXTJS_INTERNAL_PORT}..."

cd /nextapp/packages/fern-docs/bundle
HOSTNAME="127.0.0.1" \
PORT=${NEXTJS_INTERNAL_PORT} \
NEXT_PUBLIC_FDR_ORIGIN_PORT=8080 \
NEXT_PUBLIC_FDR_ORIGIN="http://localhost:8080" \
NEXT_PUBLIC_FDR_LAMBDA_ORIGIN="http://localhost:8080" \
NEXT_PUBLIC_MINIO_BUCKET_HOST=${MINIO_URL} \
NEXT_PUBLIC_MINIO_ACCESS_KEY=${MINIO_ROOT_USER} \
NEXT_PUBLIC_MINIO_SECRET_KEY=${MINIO_ROOT_PASSWORD} \
NEXT_PUBLIC_FILES_ORIGIN="${NEXT_PUBLIC_FILES_ORIGIN}" \
NEXT_PUBLIC_ASSET_HOSTING="1" \
NEXT_PUBLIC_DOCS_DOMAIN=${NEXT_PUBLIC_DOCS_DOMAIN_URL} \
NEXT_PUBLIC_IS_SELF_HOSTED=1 \
NEXT_PUBLIC_BASE_PATH="${NEXT_PUBLIC_BASE_PATH:-}" \
NEXT_TELEMETRY_DISABLED=1 \
NEXT_PUBLIC_MEILISEARCH_ORIGIN="http://localhost:7700" \
NEXT_PUBLIC_MEILISEARCH_API_KEY="fern123!" \
NEXT_SERVER_ACTIONS_ENCRYPTION_KEY="C2EQHj06esR8k1JjOjQ/j4qfS3q9mRHukR+66RzDwq0=" \
node server.js 2>&1 | tee /tmp/nextjs.log | add_timestamps &
docs_pid=$!
if [ $? -ne 0 ]; then
    log "Warning: Failed to start docs server (server.js), continuing anyway."
else
    log "Next.js docs_pid: $docs_pid"
fi

# Wait for Next.js to be ready before starting cache proxy
log "Waiting for Next.js to start on port ${NEXTJS_INTERNAL_PORT}..."
NEXTJS_ATTEMPTS=0
MAX_NEXTJS_ATTEMPTS=30
until curl -f -s --max-time 5 "http://127.0.0.1:${NEXTJS_INTERNAL_PORT}/" > /dev/null 2>&1; do
    NEXTJS_ATTEMPTS=$((NEXTJS_ATTEMPTS + 1))
    if [ $NEXTJS_ATTEMPTS -ge $MAX_NEXTJS_ATTEMPTS ]; then
        log "WARNING: Next.js not ready after $MAX_NEXTJS_ATTEMPTS attempts, starting cache proxy anyway"
        break
    fi
    log "Next.js not ready yet, waiting... ($NEXTJS_ATTEMPTS/$MAX_NEXTJS_ATTEMPTS)"
    sleep 2
done
if [ $NEXTJS_ATTEMPTS -lt $MAX_NEXTJS_ATTEMPTS ]; then
    log "Next.js is ready on port ${NEXTJS_INTERNAL_PORT}"
fi

# --------------  Start cache proxy --------------
log "Starting cache proxy on port ${CACHE_PROXY_PORT}..."

# Cache proxy configuration
# CACHE_MAX_ENTRIES: Maximum number of pages to cache (default: 1000)
# CACHE_MAX_ENTRY_SIZE: Maximum size per cached entry in bytes (default: 5MB)
# CACHE_DEFAULT_TTL: Default cache TTL in seconds (default: 3600 = 1 hour)
# CACHE_PROXY_DEBUG: Set to "1" for verbose logging
CACHE_PROXY_PORT=${CACHE_PROXY_PORT} \
NEXTJS_PORT=${NEXTJS_INTERNAL_PORT} \
NEXTJS_HOST="127.0.0.1" \
CACHE_MAX_ENTRIES="${CACHE_MAX_ENTRIES:-1000}" \
CACHE_MAX_ENTRY_SIZE="${CACHE_MAX_ENTRY_SIZE:-5242880}" \
CACHE_DEFAULT_TTL="${CACHE_DEFAULT_TTL:-3600}" \
CACHE_PROXY_DEBUG="${CACHE_PROXY_DEBUG:-0}" \
node /scripts/cache-proxy.js 2>&1 | tee /tmp/cache-proxy.log | add_timestamps &
cache_proxy_pid=$!
log "Cache proxy PID: $cache_proxy_pid"

# Wait for cache proxy to be ready
log "Waiting for cache proxy to start on port ${CACHE_PROXY_PORT}..."
PROXY_ATTEMPTS=0
MAX_PROXY_ATTEMPTS=15
until curl -f -s --max-time 5 "http://127.0.0.1:${CACHE_PROXY_PORT}/__cache/stats" > /dev/null 2>&1; do
    PROXY_ATTEMPTS=$((PROXY_ATTEMPTS + 1))
    if [ $PROXY_ATTEMPTS -ge $MAX_PROXY_ATTEMPTS ]; then
        log "WARNING: Cache proxy not ready after $MAX_PROXY_ATTEMPTS attempts"
        break
    fi
    log "Cache proxy not ready yet, waiting... ($PROXY_ATTEMPTS/$MAX_PROXY_ATTEMPTS)"
    sleep 1
done
if [ $PROXY_ATTEMPTS -lt $MAX_PROXY_ATTEMPTS ]; then
    log "Cache proxy is ready on port ${CACHE_PROXY_PORT}"
fi

log "Docs available at http://localhost:${CACHE_PROXY_PORT} (with caching)"
log "Cache stats available at http://localhost:${CACHE_PROXY_PORT}/__cache/stats"

# --------------  Finish nextapp --------------

# --------------  Save PIDs for health checks --------------
PID_FILE="/tmp/fern-services.json"
log "Saving service PIDs to $PID_FILE for health checks..."

# Get last PID for postgres (the parent/main process)
postgres_main_pid=$(echo "$postgres_pid" | tr ' ' '\n' | tail -1)

# Create JSON file with PIDs using jq
jq -n \
  --arg postgres "${postgres_main_pid:-0}" \
  --arg meili "${meili_pid:-0}" \
  --arg minio "${minio_pid:-0}" \
  --arg jaeger "${jaeger_pid:-0}" \
  --arg fdr "${fdr_pid:-0}" \
  --arg docs "${docs_pid:-0}" \
  --arg cache_proxy "${cache_proxy_pid:-0}" \
  '{
    postgres_pid: ($postgres | tonumber),
    meili_pid: ($meili | tonumber),
    minio_pid: ($minio | tonumber),
    jaeger_pid: ($jaeger | tonumber),
    fdr_pid: ($fdr | tonumber),
    docs_pid: ($docs | tonumber),
    cache_proxy_pid: ($cache_proxy | tonumber)
  }' > "$PID_FILE"

log "PIDs saved to $PID_FILE"
log "PID file contents:"
cat "$PID_FILE" | while IFS= read -r line; do log "  $line"; done

# --------------  Start health check server --------------
log "Starting health check server on port 8081..."
HEALTH_CHECK_PORT=8081 node /scripts/health-server.js 2>&1 | tee /tmp/health-server.log | add_timestamps &
health_server_pid=$!
log "Health check server PID: $health_server_pid"

log "Health check endpoints available at:"
log "  - http://localhost:8081/liveness  - Check if processes are alive"
log "  - http://localhost:8081/readiness - Check if services are ready"
log "  - http://localhost:8081/health    - Legacy health endpoint"

log "Calling /api/fern-docs/search/v2/reindex/meilisearch route..."
# Try to reindex search, but don't block startup if it fails
# This is non-critical - docs will work without search
REINDEX_ATTEMPTS=0
MAX_REINDEX_ATTEMPTS=10
REINDEX_URL="http://localhost:3000${NEXT_PUBLIC_BASE_PATH:-}/api/fern-docs/search/v2/reindex/meilisearch"
until curl -f -X GET "$REINDEX_URL" 2>/dev/null; do
    REINDEX_ATTEMPTS=$((REINDEX_ATTEMPTS + 1))
    if [ $REINDEX_ATTEMPTS -ge $MAX_REINDEX_ATTEMPTS ]; then
        log "WARNING: Failed to reindex search after $MAX_REINDEX_ATTEMPTS attempts"
        log "WARNING: Docs will be available but search functionality may not work"
        log "WARNING: This is expected in restricted environments where MeiliSearch cannot run"
        break
    fi
    log "Reindex route not ready yet, retrying in 2 seconds... (attempt $REINDEX_ATTEMPTS/$MAX_REINDEX_ATTEMPTS)"
    sleep 2
done
if [ $REINDEX_ATTEMPTS -lt $MAX_REINDEX_ATTEMPTS ]; then
    log "Successfully called /api/fern-docs/search/v2/reindex/meilisearch"
fi

# --------------  Start cache warmup --------------
# Warm up the cache by fetching all pages
# This ensures the first real user request is fast
# Run in background - container is ready immediately, warmup is a performance optimization

if [ "${SKIP_WARMUP:-false}" != "true" ]; then
    log "Starting cache warmup in background (this may take a few minutes)..."
    bash /scripts/warmup.sh 2>&1 | add_timestamps &
    warmup_pid=$!
    log "Warmup PID: $warmup_pid"
    log "Warmup running in background - container is ready for traffic"
else
    log "Skipping cache warmup (SKIP_WARMUP=true)"
fi
# --------------  End cache warmup --------------

log "All services started. Tailing logs to keep the container running."
tail -f /dev/null
