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

if [ ! -d "/fern" ]; then
    log "Fern folder not found. Please ensure you are mounting yours in."
    exit 1
fi

export ORG_NAME=$(jq -r '.organization' < /fern/fern.config.json)
CUSTOM_DOMAIN=$(yq '.instances[0]."custom-domain"' /fern/docs.yml 2>/dev/null | tr -d '"')
if [ -n "$CUSTOM_DOMAIN" ] && [ "$CUSTOM_DOMAIN" != "null" ]; then
    export NEXT_PUBLIC_DOCS_DOMAIN_URL="$CUSTOM_DOMAIN"
else
    export NEXT_PUBLIC_DOCS_DOMAIN_URL="${ORG_NAME}.docs.buildwithfern.com"
fi

# -----------  Start Postgres setup  -----------
log "Starting PostgreSQL service..."

# Function to start PostgreSQL - always initializes at runtime to avoid permission conflicts
start_postgresql() {
    local CURRENT_UID=$(id -u)

    # Always use /tmp for PostgreSQL to work with any UID
    export PGDATA=/tmp/postgresql/data
    export PGHOST=/tmp

    # Clean up any previous attempts
    rm -rf "$PGDATA" 2>/dev/null || true
    mkdir -p "$PGDATA"

    log "Initializing PostgreSQL cluster in $PGDATA (UID: $CURRENT_UID)..."

    # Check if running as root - root cannot run initdb directly
    if [ "$CURRENT_UID" -eq 0 ]; then
        log "Running as root, using 'su - postgres' to initialize and run PostgreSQL..."

        # Change ownership of the data directory to postgres user
        chown -R postgres:postgres "$PGDATA"

        # Initialize as postgres user
        if ! su - postgres -c "initdb -D $PGDATA --auth-local=trust --auth-host=trust --username=postgres" 2>&1 | add_timestamps; then
            log "ERROR: Failed to initialize PostgreSQL as postgres user"
            return 1
        fi

        # Start PostgreSQL as postgres user
        if ! su - postgres -c "pg_ctl -D $PGDATA -o \"-c listen_addresses='localhost' -c unix_socket_directories='/tmp' -c shared_buffers=128MB -c max_connections=200 -c logging_collector=on -c log_line_prefix='%t '\" -l $PGDATA/logfile start" 2>&1 | add_timestamps; then
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

        # Start PostgreSQL
        if ! pg_ctl -D "$PGDATA" \
            -o "-c listen_addresses='localhost' -c unix_socket_directories='/tmp' -c shared_buffers=128MB -c max_connections=200 -c logging_collector=on -c log_line_prefix='%t '" \
            -l "$PGDATA/logfile" \
            start 2>&1 | add_timestamps; then
            log "ERROR: Failed to start PostgreSQL"
            cat "$PGDATA/logfile" 2>/dev/null | add_timestamps
            return 1
        fi
    fi

    log "PostgreSQL started successfully"

    # Wait for PostgreSQL to be ready
    for i in {1..30}; do
        if pg_isready -h /tmp -p 5432 2>/dev/null; then
            log "PostgreSQL is ready"
            break
        fi
        log "Waiting for PostgreSQL to start... ($i/30)"
        sleep 1
    done

    # Create the database
    log "Creating database 'fdr'..."
    if [ "$CURRENT_UID" -eq 0 ]; then
        su - postgres -c "createdb -h /tmp -U postgres fdr" 2>&1 | add_timestamps || true
    else
        createdb -h /tmp -U postgres fdr 2>&1 | add_timestamps || true
    fi

    # Update DATABASE_URL for Prisma to use the Unix socket
    export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/fdr?host=/tmp"
    log "DATABASE_URL configured for Unix socket in /tmp"

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

run_prisma_migrations
# -----------  End Postgres setup  -----------

# -----------  Start MeiliSearch setup  -----------
export MEILI_HTTP_ADDR=0.0.0.0:7700

log "Starting MeiliSearch..."
# Change to /tmp so MeiliSearch's default data directory (./data.ms) is created there
cd /tmp
/meilisearch --master-key="fern123!" > /tmp/meilisearch.log 2>&1 &
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


# -----------  Start MINIO setup  -----------
log "Starting MinIO server..."
minio server ${MINIO_VOLUMES} --console-address ":9001" > /tmp/minio.log 2>&1 &
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

# Always create the .docs.buildwithfern.com bucket
mc mb minio/${ORG_NAME}.docs.buildwithfern.com 2>&1 | add_timestamps
mc anonymous set download minio/${ORG_NAME}.docs.buildwithfern.com 2>&1 | add_timestamps
export MINIO_BUCKET_NAME=${ORG_NAME}.docs.buildwithfern.com

# Also create the custom domain bucket if specified and not null
if [ -n "$CUSTOM_DOMAIN" ] && [ "$CUSTOM_DOMAIN" != "null" ]; then
    # Remove any slashes from the custom domain bucket name
    # Only grab the host part of the custom domain (strip protocol and path)
    CUSTOM_DOMAIN_CLEANED=$(echo "$CUSTOM_DOMAIN" | sed -E 's#^https?://##' | cut -d'/' -f1 | tr -d ':')
    # Use the cleaned custom domain for bucket creation and export
    mc mb minio/${CUSTOM_DOMAIN_CLEANED} 2>&1 | add_timestamps
    mc anonymous set download minio/${CUSTOM_DOMAIN_CLEANED} 2>&1 | add_timestamps
    export MINIO_BUCKET_NAME=${CUSTOM_DOMAIN_CLEANED}
fi

# Always use path-style S3 access for self-hosted mode (simpler and more reliable)
# This tells the AWS SDK to generate URLs like http://localhost:9000/bucket/file
# instead of http://bucket.localhost:9000/file
export S3_FORCE_PATH_STYLE=true

# Configure FILES_ORIGIN for the Next.js app
# Use path-based routing for consistency with FDR
NEXT_PUBLIC_FILES_ORIGIN="http://localhost:9000/${MINIO_BUCKET_NAME}"

# -----------  End MINIO setup  -----------

log "Starting FDR server..."
node /fdr/server.cjs > /tmp/fdr.log 2>&1 &
fdr_pid=$!
log "FDR server PID: $fdr_pid"

log "Waiting for FDR to start at localhost:8080/health..."
until curl -f http://localhost:8080/health 2>/dev/null; do
    log "FDR not ready yet, waiting 2 seconds..."
    sleep 2
done
log "FDR is up and running at localhost:8080/health"


# --------------  Generate docs and insert into MinIO via FDR --------------

log "running fern generate --docs"

FERN_SELF_HOSTED=true FERN_TOKEN=dummy OVERRIDE_FDR_ORIGIN=http://localhost:8080  FERN_NO_VERSION_REDIRECTION=true fern generate --docs --log-level debug --no-prompt 2>&1 | add_timestamps

log " docs generated successfully"

# --------------  Finish generate docs --------------

# --------------  Start nextapp --------------

log "Waiting for docs to start at localhost:3000..."

cd /nextapp/packages/fern-docs/bundle
HOSTNAME="0.0.0.0" \
PORT=3000 \
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
NEXT_TELEMETRY_DISABLED=1 \
NEXT_DISABLE_CACHE=1 \
NEXT_PUBLIC_MEILISEARCH_ORIGIN="http://localhost:7700" \
NEXT_PUBLIC_MEILISEARCH_API_KEY="fern123!" \
NEXT_SERVER_ACTIONS_ENCRYPTION_KEY="C2EQHj06esR8k1JjOjQ/j4qfS3q9mRHukR+66RzDwq0=" \
node server.js > /tmp/nextjs.log 2>&1 &
docs_pid=$!
if [ $? -ne 0 ]; then
    log "Warning: Failed to start docs server (server.js), continuing anyway."
else
    log "docs_pid: $docs_pid"
fi

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
  --arg fdr "${fdr_pid:-0}" \
  --arg docs "${docs_pid:-0}" \
  '{
    postgres_pid: ($postgres | tonumber),
    meili_pid: ($meili | tonumber),
    minio_pid: ($minio | tonumber),
    fdr_pid: ($fdr | tonumber),
    docs_pid: ($docs | tonumber)
  }' > "$PID_FILE"

log "PIDs saved to $PID_FILE"
log "PID file contents:"
cat "$PID_FILE" | while IFS= read -r line; do log "  $line"; done

# --------------  Start health check server --------------
log "Starting health check server on port 8081..."
HEALTH_CHECK_PORT=8081 node /scripts/health-server.js > /tmp/health-server.log 2>&1 &
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
until curl -f -X GET http://localhost:3000/api/fern-docs/search/v2/reindex/meilisearch 2>/dev/null; do
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

log "All services started. Tailing logs to keep the container running."
tail -f /dev/null
