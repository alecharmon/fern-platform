#!/bin/bash
set -euo pipefail

# Raise file descriptor soft limit.  The self-hosted container runs 7+ services
# (PostgreSQL, SeaweedFS, MeiliSearch, FDR, Next.js, cache-proxy, health-server)
# plus background tasks (search reindex, cache warmup).  The default soft limit
# (often 1024) is easily exhausted, leading to "too many open files" crashes.
ulimit -n 65536 2>/dev/null || true

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
SEED_SEAWEEDFS_DIR="$SEED_DIR/seaweedfs"
SEED_POSTGRES_DUMP="$SEED_DIR/postgres.dump"
SEED_MEILI_DUMP="$SEED_DIR/meilisearch/search.dump"
SEED_MEILI_KEY_FILE="$SEED_DIR/meili-master-key"
USE_SEEDED_DATA=false

# Load MeiliSearch master key from build-time generated file, or generate a new one
# This ensures each deployment uses a unique key instead of a hardcoded one
if [ -f "$SEED_MEILI_KEY_FILE" ]; then
    MEILI_MASTER_KEY=$(cat "$SEED_MEILI_KEY_FILE")
    log "Loaded MeiliSearch master key from build-time seed"
else
    # Generate a random key if no seeded key exists (e.g., running without build-time seeding)
    MEILI_MASTER_KEY=$(head -c 32 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 32)
    log "Generated new random MeiliSearch master key"
fi

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

# -----------  Ensure current UID exists in /etc/passwd  -----------
# PostgreSQL initdb requires that the current user has an entry in /etc/passwd.
# When running as an arbitrary UID in Kubernetes (e.g., via securityContext.runAsUser),
# the UID may not exist in /etc/passwd, causing initdb to fail with:
#   "initdb: could not look up effective user ID XXXX: user does not exist"
CURRENT_UID=$(id -u)
log "Current UID: $CURRENT_UID"
log "Contents of /etc/passwd (UIDs > 999):"
awk -F: '$3 > 999 {print}' /etc/passwd 2>/dev/null || true
if ! grep -q "^[^:]*:[^:]*:${CURRENT_UID}:" /etc/passwd 2>/dev/null; then
    log "UID $CURRENT_UID not found in /etc/passwd, adding entry..."
    if { echo "fern:x:${CURRENT_UID}:0:Fern User:/tmp:/bin/bash" >> /etc/passwd; } 2>/dev/null; then
        log "Successfully added passwd entry for UID $CURRENT_UID"
    else
        log "WARNING: Could not modify /etc/passwd (read-only filesystem?)"
        # Fallback: create a custom passwd file and use LD_PRELOAD with libnss_wrapper
        NSS_WRAPPER_LIB=$(find /usr/lib -name 'libnss_wrapper.so' 2>/dev/null | head -1)
        if [ -n "$NSS_WRAPPER_LIB" ]; then
            NSS_PASSWD="/tmp/passwd-${CURRENT_UID}"
            cat /etc/passwd > "$NSS_PASSWD" 2>/dev/null || true
            echo "fern:x:${CURRENT_UID}:0:Fern User:/tmp:/bin/bash" >> "$NSS_PASSWD"
            export LD_PRELOAD="$NSS_WRAPPER_LIB"
            export NSS_WRAPPER_PASSWD="$NSS_PASSWD"
            export NSS_WRAPPER_GROUP=/etc/group
            log "Using nss_wrapper for user resolution"
        else
            log "ERROR: Cannot resolve UID $CURRENT_UID - PostgreSQL initdb may fail"
        fi
    fi
fi
# -----------  End /etc/passwd fix  -----------

export ORG_NAME=$(jq -r '.organization' < /fern/fern.config.json)

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

# Respect the CUSTOM_DOMAIN env var if the customer explicitly sets it.
# Otherwise, fall back to the custom-domain from docs.yml.
if is_valid_custom_domain "${CUSTOM_DOMAIN:-}"; then
    # Strip protocol prefix if present (customer may pass https://domain)
    CUSTOM_DOMAIN=$(echo "$CUSTOM_DOMAIN" | sed -E 's#^https?://##' | cut -d'/' -f1)
    log "Using CUSTOM_DOMAIN from environment: $CUSTOM_DOMAIN"
else
    CUSTOM_DOMAIN=$(yq '.instances[0]."custom-domain"' /fern/docs.yml 2>/dev/null | tr -d '"')
fi

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

# Check if we have a seeded MeiliSearch dump to import
MEILI_IMPORT_FLAG=""
if [ "$USE_SEEDED_DATA" = "true" ] && [ -f "$SEED_MEILI_DUMP" ]; then
    log "Found seeded MeiliSearch dump at $SEED_MEILI_DUMP"
    log "MeiliSearch will import pre-indexed search data at startup"
    MEILI_IMPORT_FLAG="--import-dump $SEED_MEILI_DUMP"
fi

# Configure search queue size to prevent heap memory exhaustion from search request overload
# Lower values = less RAM during search spikes, but more 503 errors under heavy load
# Default: 100 (MeiliSearch default is 1000, but we use a lower value for protection)
MEILI_SEARCH_QUEUE_SIZE="${MEILI_SEARCH_QUEUE_SIZE:-100}"
log "MeiliSearch search queue size: $MEILI_SEARCH_QUEUE_SIZE"

log "Starting MeiliSearch with db-path: $MEILI_DB_PATH..."
/meilisearch --master-key="$MEILI_MASTER_KEY" --db-path "$MEILI_DB_PATH" --experimental-search-queue-size "$MEILI_SEARCH_QUEUE_SIZE" $MEILI_IMPORT_FLAG 2>&1 | tee /tmp/meilisearch.log | add_timestamps &
meili_pid=$!
log "MeiliSearch PID: $meili_pid"

# Wait for MeiliSearch to be ready
log "Waiting for MeiliSearch to start..."
MEILI_ATTEMPTS=0
MAX_MEILI_ATTEMPTS=30
until curl -f -H "Authorization: Bearer $MEILI_MASTER_KEY" http://localhost:7700/health 2>/dev/null; do
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
log "MeiliSearch master key will be used for all operations (middleware handles auth)"
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

# -----------  Start SeaweedFS setup  -----------

SEAWEED_DATA_DIR="/data"
if ! touch /data/.write-test 2>/dev/null; then
    SEAWEED_DATA_DIR="/tmp/seaweed-data-$(id -u)"
    log "Using fallback directory for SeaweedFS: $SEAWEED_DATA_DIR (/data is not writable)"
    mkdir -p "$SEAWEED_DATA_DIR"
else
    rm -f /data/.write-test
    log "Using /data for SeaweedFS (writable)"
fi

if [ "$USE_SEEDED_DATA" = "true" ] && [ -d "$SEED_SEAWEEDFS_DIR" ]; then
    log "Restoring SeaweedFS data from seeded backup..."
    if cp -r "$SEED_SEAWEEDFS_DIR"/. "$SEAWEED_DATA_DIR/" 2>&1 | add_timestamps; then
        log "SeaweedFS data restored from $SEED_SEAWEEDFS_DIR to $SEAWEED_DATA_DIR"
    else
        log "WARNING: Failed to restore SeaweedFS data from $SEED_SEAWEEDFS_DIR"
    fi
fi

export AWS_ACCESS_KEY_ID=fern_admin
export AWS_SECRET_ACCESS_KEY=fern_admin
export S3_ACCESS_KEY=fern_admin
export S3_SECRET_KEY=fern_admin

log "Starting SeaweedFS with data directory: $SEAWEED_DATA_DIR..."
S3_CONFIG_FILE="/tmp/seaweedfs-s3-$(id -u).json"
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
weed mini -dir="$SEAWEED_DATA_DIR" -s3.config="$S3_CONFIG_FILE" > /dev/null 2>&1 &
seaweed_pid=$!
log "SeaweedFS PID: $seaweed_pid"

log "Waiting for SeaweedFS to start..."
SEAWEED_ATTEMPTS=0
MAX_SEAWEED_ATTEMPTS=30
until curl -s -o /dev/null http://localhost:8333/ 2>/dev/null; do
    SEAWEED_ATTEMPTS=$((SEAWEED_ATTEMPTS + 1))
    if [ $SEAWEED_ATTEMPTS -ge $MAX_SEAWEED_ATTEMPTS ]; then
        log "WARNING: SeaweedFS S3 not ready after $MAX_SEAWEED_ATTEMPTS attempts"
        break
    fi
    log "SeaweedFS not ready yet, waiting 2 seconds... ($SEAWEED_ATTEMPTS/$MAX_SEAWEED_ATTEMPTS)"
    sleep 2
done
if [ $SEAWEED_ATTEMPTS -lt $MAX_SEAWEED_ATTEMPTS ]; then
    log "SeaweedFS is ready!"
fi

log "Creating S3 buckets..."
echo "s3.bucket.create -name ${ORG_NAME}.docs.buildwithfern.com" | weed shell -master=localhost:9333 > /dev/null 2>&1 || true
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

export S3_FORCE_PATH_STYLE=true

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

NEXT_PUBLIC_FILES_ORIGIN="http://localhost:8333/${S3_BUCKET_NAME}"

# -----------  End SeaweedFS setup  -----------

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


# --------------  Generate docs and insert into S3 via FDR --------------

# Track docs generation status for readiness checks
DOCS_GENERATION_STATUS_FILE="/tmp/docs-generation-status"

# Normalize FERN_LOG_LEVEL to lowercase and validate it.
# This must happen before the seeded-data check because the Next.js startup
# (further down) references FERN_LOG_LEVEL_LOWER regardless of the code path.
FERN_LOG_LEVEL_LOWER=$(echo "${FERN_LOG_LEVEL:-warn}" | tr '[:upper:]' '[:lower:]')
case "$FERN_LOG_LEVEL_LOWER" in
    trace|debug|info|warn|error) ;;
    *) log "WARNING: Invalid FERN_LOG_LEVEL '${FERN_LOG_LEVEL}', defaulting to 'warn'. Valid values: trace, debug, info, warn, error"
       FERN_LOG_LEVEL_LOWER="warn" ;;
esac

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

    # Only show disk usage info when debug logging is enabled
    if [ "$FERN_LOG_LEVEL_LOWER" = "debug" ] || [ "$FERN_LOG_LEVEL_LOWER" = "trace" ]; then
        log "Disk usage before fern generate:"
        df -h 2>&1 | add_timestamps || true
        log "Inode usage:"
        df -i 2>&1 | add_timestamps || true
        log "SeaweedFS data directory size:"
        du -sh /data 2>&1 | add_timestamps || true
    fi

    # Run fern generate --docs - if this fails, the container will exit
    # FERN_LOG_LEVEL can be set to control verbosity (debug, info, warn, error). Defaults to debug for backwards compatibility.
    # BUF_CACHE_DIR is set to use cached buf dependencies from build time (if available)
    # Use the BUF_CACHE_DIR set above (either /opt/buf-cache or /tmp/buf-cache fallback)
    FERN_GENERATE_LOG="/tmp/fern-generate-output.log"

    # Detect how many docs instances are configured
    INSTANCE_COUNT=$(yq '.instances | length' /fern/docs.yml 2>/dev/null || echo "0")
    log "Found $INSTANCE_COUNT docs instance(s) in docs.yml"

    # Build list of instance URLs when there are multiple instances
    INSTANCE_URLS=()
    if [ "$INSTANCE_COUNT" -gt 1 ]; then
        for i in $(seq 0 $((INSTANCE_COUNT - 1))); do
            url=$(yq ".instances[$i].url" /fern/docs.yml 2>/dev/null | tr -d '"')
            if [ -n "$url" ] && [ "$url" != "null" ]; then
                INSTANCE_URLS+=("$url")
            fi
        done
        log "Will generate docs for instances: ${INSTANCE_URLS[*]}"
    fi

    FERN_GENERATE_EXIT_CODE=0

    if [ ${#INSTANCE_URLS[@]} -gt 1 ]; then
        # Multiple instances: generate each one separately with --instance
        for instance_url in "${INSTANCE_URLS[@]}"; do
            log "Generating docs for instance: $instance_url"
            set +e
            BUF_CACHE_DIR="${BUF_CACHE_DIR:-/opt/buf-cache}" FERN_TOKEN=dummy FERN_FDR_ORIGIN=http://localhost:8080 FERN_DISABLE_TELEMETRY=true FERN_NO_VERSION_REDIRECTION=true fern generate --docs --instance "$instance_url" --log-level "${FERN_LOG_LEVEL_LOWER}" --no-prompt 2>&1 | tee -a "$FERN_GENERATE_LOG" | add_timestamps
            INSTANCE_EXIT_CODE=${PIPESTATUS[0]}
            set -e
            if [ $INSTANCE_EXIT_CODE -ne 0 ]; then
                log "ERROR: fern generate --docs --instance $instance_url failed with exit code $INSTANCE_EXIT_CODE"
                FERN_GENERATE_EXIT_CODE=$INSTANCE_EXIT_CODE
            fi
        done
    else
        # Single instance (or none): run without --instance for backwards compatibility
        set +e
        BUF_CACHE_DIR="${BUF_CACHE_DIR:-/opt/buf-cache}" FERN_TOKEN=dummy FERN_FDR_ORIGIN=http://localhost:8080 FERN_DISABLE_TELEMETRY=true FERN_NO_VERSION_REDIRECTION=true fern generate --docs --log-level "${FERN_LOG_LEVEL_LOWER}" --no-prompt 2>&1 | tee "$FERN_GENERATE_LOG" | add_timestamps
        FERN_GENERATE_EXIT_CODE=${PIPESTATUS[0]}
        set -e
    fi

    if [ $FERN_GENERATE_EXIT_CODE -eq 0 ]; then
        log "Docs generated successfully"
        echo '{"timestamp": "'$(date -Iseconds)'", "status": "success"}' > "$DOCS_GENERATION_STATUS_FILE"
    else
        log "ERROR: fern generate --docs failed with exit code $FERN_GENERATE_EXIT_CODE"
        
        # Check if the error is related to network/egress issues (Buf BSR, remote URLs, etc.)
        if grep -qi "server hosted at that remote is unavailable\|buf.build\|api.buf.build\|network\|ECONNREFUSED\|ETIMEDOUT\|getaddrinfo" "$FERN_GENERATE_LOG"; then
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
        rm -f "$FERN_GENERATE_LOG"
        exit 1
    fi
    rm -f "$FERN_GENERATE_LOG"
fi

# --------------  Finish generate docs --------------

# --------------  Auth env var passthrough  --------------
if [ -n "${FERN_AUTH_TYPE:-}" ]; then
    log "Auth configured: FERN_AUTH_TYPE=$FERN_AUTH_TYPE"
    export FERN_AUTH_TYPE
    [ -n "${FERN_AUTH_SECRET:-}" ] && export FERN_AUTH_SECRET
    [ -n "${FERN_AUTH_REDIRECT:-}" ] && export FERN_AUTH_REDIRECT
    [ -n "${FERN_AUTH_LOGOUT:-}" ] && export FERN_AUTH_LOGOUT
    [ -n "${FERN_AUTH_ISSUER:-}" ] && export FERN_AUTH_ISSUER
    [ -n "${FERN_AUTH_RETURN_TO_QUERY_PARAM:-}" ] && export FERN_AUTH_RETURN_TO_QUERY_PARAM
    [ -n "${FERN_AUTH_CLIENT_ID:-}" ] && export FERN_AUTH_CLIENT_ID
    [ -n "${FERN_AUTH_CLIENT_SECRET:-}" ] && export FERN_AUTH_CLIENT_SECRET
    [ -n "${FERN_AUTH_PARTNER:-}" ] && export FERN_AUTH_PARTNER
    [ -n "${FERN_AUTH_ENDPOINT:-}" ] && export FERN_AUTH_ENDPOINT
    [ -n "${FERN_AUTH_TOKEN_ENDPOINT:-}" ] && export FERN_AUTH_TOKEN_ENDPOINT
    [ -n "${FERN_AUTH_SCOPE:-}" ] && export FERN_AUTH_SCOPE
    [ -n "${FERN_AUTH_ROLES_CLAIM:-}" ] && export FERN_AUTH_ROLES_CLAIM
    [ -n "${FERN_AUTH_ORGANIZATION:-}" ] && export FERN_AUTH_ORGANIZATION
    [ -n "${FERN_AUTH_CONNECTION:-}" ] && export FERN_AUTH_CONNECTION
    [ -n "${FERN_AUTH_PROVIDER:-}" ] && export FERN_AUTH_PROVIDER
    [ -n "${FERN_AUTH_ALLOWLIST:-}" ] && export FERN_AUTH_ALLOWLIST
    [ -n "${FERN_AUTH_DENYLIST:-}" ] && export FERN_AUTH_DENYLIST
    [ -n "${FERN_AUTH_TEST_LOGIN:-}" ] && export FERN_AUTH_TEST_LOGIN
fi

if [ -n "${FERN_AUTH_SECRET:-}" ]; then
    export JWT_SECRET_KEY="$FERN_AUTH_SECRET"
    log "JWT signing secret configured from FERN_AUTH_SECRET"
fi

if [ "${FERN_AUTH_TEST_LOGIN:-}" = "true" ] || [ "${FERN_AUTH_TEST_LOGIN:-}" = "1" ]; then
    log "============================================"
    log "TEST LOGIN ENABLED"
    log "============================================"
    log "A test login page is available at /__test-login"
    log "Set FERN_AUTH_REDIRECT to point to it, e.g.:"
    log "  FERN_AUTH_REDIRECT=http://localhost:3000/__test-login"
    log "This is for testing only - do NOT use in production!"
    log "============================================"
fi
# --------------  End auth env var passthrough  --------------

# --------------  Patch basePath placeholder in Next.js bundle  --------------
log "Patching basePath placeholder in Next.js bundle..."
source /scripts/patch-basepath.sh
# Re-export NEXT_PUBLIC_BASE_PATH after patching (patch script updates it)
export NEXT_PUBLIC_BASE_PATH="${NEXT_PUBLIC_BASE_PATH:-}"
# --------------  End basePath patching  --------------

# --------------  Airgap detection  --------------
# Check if the container has external network access. In airgapped environments,
# external requests will hang or fail. We detect this early and set an env var
# so the frontend can gracefully handle media that cannot load.
log "Checking network connectivity (airgap detection)..."
FERN_DOCS_AIRGAPPED=0
if ! curl -s --max-time 5 -o /dev/null https://www.google.com 2>/dev/null && \
   ! curl -s --max-time 5 -o /dev/null http://1.1.1.1 2>/dev/null; then
    FERN_DOCS_AIRGAPPED=1
    log "=========================================="
    log "AIRGAPPED ENVIRONMENT DETECTED"
    log "=========================================="
    log "External network access is not available."
    log "Media (images, videos, iframes) that fail to load will show a placeholder."
    log "=========================================="
else
    log "External network access confirmed (not airgapped)"
fi
export FERN_DOCS_AIRGAPPED
# --------------  End airgap detection  --------------

# --------------  Start nextapp --------------

# Next.js runs on internal port 3001, cache proxy runs on external port 3000
NEXTJS_INTERNAL_PORT=3001
CACHE_PROXY_PORT=3000

log "Starting Next.js on internal port ${NEXTJS_INTERNAL_PORT}..."

cd /nextapp/packages/fern-docs/bundle

# Set Node.js memory limit - default to 4GB, can be overridden via NODE_MEMORY_LIMIT env var
# Large documentation sites (e.g., with many API versions) may need more memory during search indexing
NODEJS_HEAP_SIZE="${NODE_MEMORY_LIMIT:-4096}"
log "Starting Next.js with ${NODEJS_HEAP_SIZE}MB heap limit (set NODE_MEMORY_LIMIT to override)"

HOSTNAME="127.0.0.1" \
PORT=${NEXTJS_INTERNAL_PORT} \
NEXT_PUBLIC_FDR_ORIGIN_PORT=8080 \
NEXT_PUBLIC_FDR_ORIGIN="http://localhost:8080" \
NEXT_PUBLIC_FDR_LAMBDA_ORIGIN="http://localhost:8080" \
S3_ENDPOINT=${S3_ENDPOINT} \
NEXT_PUBLIC_FILES_ORIGIN="${NEXT_PUBLIC_FILES_ORIGIN}" \
NEXT_PUBLIC_ASSET_HOSTING="1" \
NEXT_PUBLIC_DOCS_DOMAIN=${NEXT_PUBLIC_DOCS_DOMAIN_URL} \
NEXT_PUBLIC_IS_SELF_HOSTED=1 \
NEXT_PUBLIC_BASE_PATH="${NEXT_PUBLIC_BASE_PATH:-}" \
NEXT_PUBLIC_FAI_ORIGIN="http://localhost:8482" \
NEXT_TELEMETRY_DISABLED=1 \
MEILISEARCH_ORIGIN="http://localhost:7700" \
MEILISEARCH_MASTER_KEY="${MEILI_MASTER_KEY}" \
NEXT_SERVER_ACTIONS_ENCRYPTION_KEY="C2EQHj06esR8k1JjOjQ/j4qfS3q9mRHukR+66RzDwq0=" \
NODE_OPTIONS="--max-old-space-size=${NODEJS_HEAP_SIZE}" \
FERN_DOCS_AIRGAPPED="${FERN_DOCS_AIRGAPPED}" \
FERN_LOG_LEVEL="${FERN_LOG_LEVEL_LOWER}" \
NEXT_PRIVATE_DEBUG_CACHE="$([ "$FERN_LOG_LEVEL_LOWER" = "debug" ] || [ "$FERN_LOG_LEVEL_LOWER" = "trace" ] && echo "1" || echo "")" \
node server.js 2>&1 | tee /tmp/nextjs.log | add_timestamps &
docs_pid=$!
if [ $? -ne 0 ]; then
    log "Warning: Failed to start docs server (server.js), continuing anyway."
else
    log "Next.js docs_pid: $docs_pid"
fi

# Wait for Next.js to be ready before starting cache proxy
# Use /_next/ path which bypasses middleware (excluded in middleware matcher)
# This is more reliable than hitting a page route which goes through complex rewrites
NEXTJS_HEALTH_URL="http://127.0.0.1:${NEXTJS_INTERNAL_PORT}${NEXT_PUBLIC_BASE_PATH:-}/_next/static/"
log "Waiting for Next.js to start at ${NEXTJS_HEALTH_URL}..."
NEXTJS_ATTEMPTS=0
MAX_NEXTJS_ATTEMPTS=30
# Don't use -f flag - we just want to check if Next.js is responding, not if we get 200
# /_next/static/ will return 404 but that's fine - it means Next.js is up and serving
until curl -s --max-time 5 -o /dev/null -w "%{http_code}" "$NEXTJS_HEALTH_URL" 2>/dev/null | grep -qE "^[0-9]+$"; do
    NEXTJS_ATTEMPTS=$((NEXTJS_ATTEMPTS + 1))
    if [ $NEXTJS_ATTEMPTS -ge $MAX_NEXTJS_ATTEMPTS ]; then
        log "WARNING: Next.js not ready after $MAX_NEXTJS_ATTEMPTS attempts, starting cache proxy anyway"
        break
    fi
    log "Next.js not ready yet, waiting... ($NEXTJS_ATTEMPTS/$MAX_NEXTJS_ATTEMPTS)"
    sleep 2
done
if [ $NEXTJS_ATTEMPTS -lt $MAX_NEXTJS_ATTEMPTS ]; then
    log "Next.js is ready (responding on port ${NEXTJS_INTERNAL_PORT})"
fi

# --------------  Start cache proxy --------------
# Cache proxy supports auth-aware caching: cache keys include isLoggedIn + roles from fern_token.
# When FERN_AUTH_TYPE is set, the proxy uses auth state in cache keys so different users get correct cached responses.
log "Starting cache proxy on port ${CACHE_PROXY_PORT}..."
# Cache proxy configuration
# CACHE_MAX_ENTRIES: Maximum number of pages to cache (default: 1000)
# CACHE_MAX_ENTRY_SIZE: Maximum size per cached entry in bytes (default: 5MB)
# CACHE_DEFAULT_TTL: Default cache TTL in seconds (default: 2592000 = 30 days)
# CACHE_PROXY_DEBUG: Set to "1" for verbose logging
CACHE_PROXY_PORT=${CACHE_PROXY_PORT} \
NEXTJS_PORT=${NEXTJS_INTERNAL_PORT} \
NEXTJS_HOST="127.0.0.1" \
CACHE_MAX_ENTRIES="${CACHE_MAX_ENTRIES:-1000}" \
CACHE_MAX_ENTRY_SIZE="${CACHE_MAX_ENTRY_SIZE:-5242880}" \
CACHE_DEFAULT_TTL="${CACHE_DEFAULT_TTL:-2592000}" \
CACHE_PROXY_DEBUG="${CACHE_PROXY_DEBUG:-0}" \
bun /scripts/cache-proxy/index.ts 2>&1 | tee /tmp/cache-proxy.log | add_timestamps &
cache_proxy_pid=$!
log "Cache proxy PID: $cache_proxy_pid"

# Helper: curl with cache admin token (read from file written by cache proxy on startup)
CACHE_TOKEN_FILE="/tmp/.cache-admin-token"
cache_curl() {
    local token=""
    if [ -f "$CACHE_TOKEN_FILE" ]; then
        token=$(cat "$CACHE_TOKEN_FILE")
    fi
    if [ -n "$token" ]; then
        curl -H "Authorization: Bearer $token" "$@"
    else
        curl "$@"
    fi
}

# Wait for cache proxy to be ready
log "Waiting for cache proxy to start on port ${CACHE_PROXY_PORT}..."
PROXY_ATTEMPTS=0
MAX_PROXY_ATTEMPTS=15
until cache_curl -f -s --max-time 5 "http://127.0.0.1:${CACHE_PROXY_PORT}/__cache/stats" > /dev/null 2>&1; do
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

log "Docs available at http://localhost:${CACHE_PROXY_PORT}"
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
  --arg seaweedfs "${seaweed_pid:-0}" \
  --arg jaeger "${jaeger_pid:-0}" \
  --arg fdr "${fdr_pid:-0}" \
  --arg docs "${docs_pid:-0}" \
  --arg cache_proxy "${cache_proxy_pid:-0}" \
  '{
    postgres_pid: ($postgres | tonumber),
    meili_pid: ($meili | tonumber),
    seaweedfs_pid: ($seaweedfs | tonumber),
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

# Skip search reindex if using seeded data (search was pre-indexed at build time)
REINDEX_PID=""
if [ "$USE_SEEDED_DATA" = "true" ] && [ -f "$SEED_MEILI_DUMP" ]; then
    log "=========================================="
    log "Skipping search reindex (using seeded MeiliSearch data)"
    log "=========================================="
    log "Search index was pre-built at image build time and imported at startup."
    log "Search should be available immediately!"
else
    log "Calling /api/fern-docs/search/v2/reindex/meilisearch route..."
    # Try to reindex search, but don't block startup if it fails
    # This is non-critical - docs will work without search
    REINDEX_URL="http://localhost:3000${NEXT_PUBLIC_BASE_PATH:-}/api/fern-docs/search/v2/reindex/meilisearch"

    # Run reindex in background so it doesn't block container startup
    # Search indexing can take several minutes for large documentation sites
    (
        log "[reindex] Starting search reindex in background..."
        log "[reindex] URL: $REINDEX_URL"
        log "[reindex] Domain: ${NEXT_PUBLIC_DOCS_DOMAIN_URL}"
        
        # Wait a moment for everything to settle
        sleep 3
        
        # Use longer timeout for large docs (10 minutes)
        # Include x-fern-host header to ensure proper domain resolution
        # Use -w to get HTTP status code, -o to capture body separately
        REINDEX_BODY_FILE="/tmp/reindex_response.json"
        HTTP_CODE=$(curl -s -o "$REINDEX_BODY_FILE" -w "%{http_code}" \
            --max-time 600 \
            -H "x-fern-host: ${NEXT_PUBLIC_DOCS_DOMAIN_URL}" \
            -H "Authorization: Bearer ${MEILI_MASTER_KEY}" \
            -H "Accept: application/json" \
            -X GET "$REINDEX_URL" 2>&1)
        REINDEX_EXIT=$?
        
        if [ $REINDEX_EXIT -ne 0 ]; then
            log "[reindex] WARNING: curl failed with exit code $REINDEX_EXIT"
            log "[reindex] Docs will work but search may not be available"
        elif [ "$HTTP_CODE" = "200" ]; then
            REINDEX_RESULT=$(cat "$REINDEX_BODY_FILE" 2>/dev/null | head -c 500)
            # Check if response is JSON (starts with { or [)
            if echo "$REINDEX_RESULT" | grep -q "^[{\[]"; then
                log "[reindex] Search reindex completed successfully (HTTP $HTTP_CODE)"
                log "[reindex] Result: $REINDEX_RESULT"
            else
                log "[reindex] WARNING: Expected JSON but got HTML response (HTTP $HTTP_CODE)"
                log "[reindex] This usually means the domain is not configured correctly"
                log "[reindex] Response preview: $(echo "$REINDEX_RESULT" | head -c 200)"
            fi
        else
            REINDEX_RESULT=$(cat "$REINDEX_BODY_FILE" 2>/dev/null | head -c 500)
            log "[reindex] WARNING: Search reindex failed (HTTP $HTTP_CODE)"
            log "[reindex] Response: $REINDEX_RESULT"
            log "[reindex] Docs will work but search may not be available"
        fi
        
        rm -f "$REINDEX_BODY_FILE"
    ) &
    REINDEX_PID=$!
    log "Search reindex started in background (PID: $REINDEX_PID)"
    log "Search will be available after indexing completes (may take several minutes for large docs)"
fi

# --------------  Start cache warmup --------------
# Warm up the cache by crawling all pages via the cache proxy's built-in warmup endpoint.
# This ensures the first real user request is fast.
# Run in background - container is ready immediately, warmup is a performance optimization.
# Warmup is enabled by default, set WARMUP=false to disable.
#
# IMPORTANT: warmup waits for search reindex to finish first to avoid both
# tasks hammering Next.js simultaneously, which can exhaust file descriptors.

WARMUP_DEFAULT="true"

if [ "${WARMUP:-$WARMUP_DEFAULT}" = "true" ]; then
    log "Starting cache warmup in background via cache proxy /__cache/warmup endpoint..."
    (
        # Wait for search reindex to complete before starting warmup.
        # Running both concurrently can exhaust file descriptors when each
        # Next.js request spawns esbuild for MDX compilation.
        if [ -n "$REINDEX_PID" ]; then
            log "[warmup] Waiting for search reindex (PID $REINDEX_PID) to complete before starting warmup..."
            wait "$REINDEX_PID" 2>/dev/null || true
            log "[warmup] Search reindex finished, proceeding with warmup"
        fi

        WARMUP_ATTEMPTS=0
        MAX_WARMUP_ATTEMPTS=60
        while [ "$WARMUP_ATTEMPTS" -lt "$MAX_WARMUP_ATTEMPTS" ]; do
            WARMUP_ATTEMPTS=$((WARMUP_ATTEMPTS + 1))
            if cache_curl -f -s --max-time 5 "http://localhost:${CACHE_PROXY_PORT}/__cache/stats" > /dev/null 2>&1; then
                break
            fi
            if [ "$WARMUP_ATTEMPTS" -ge "$MAX_WARMUP_ATTEMPTS" ]; then
                log "WARNING: Cache proxy not ready after $MAX_WARMUP_ATTEMPTS attempts, skipping warmup"
                exit 0
            fi
            sleep 2
        done
        WARMUP_RESULT=$(cache_curl -s --max-time 1800 -X POST "http://localhost:${CACHE_PROXY_PORT}/__cache/warmup" 2>&1)
        WARMUP_EXIT=$?
        if [ $WARMUP_EXIT -ne 0 ]; then
            log "WARNING: Cache warmup request failed (exit code $WARMUP_EXIT)"
        else
            log "Cache warmup complete: $WARMUP_RESULT"
        fi
    ) &
    warmup_pid=$!
    log "Warmup PID: $warmup_pid"
    log "Warmup running in background - container is ready for traffic"
else
    log "Skipping cache warmup (WARMUP not set to true)"
fi
# --------------  End cache warmup --------------

log "All services started. Tailing logs to keep the container running."
tail -f /dev/null
