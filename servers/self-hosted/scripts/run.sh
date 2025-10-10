#!/bin/bash
set -euo pipefail

if [ ! -d "/fern" ]; then
    echo "Fern folder not found. Please ensure you are mounting yours in."
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
echo "Starting PostgreSQL service..."

# Function to start PostgreSQL - always initializes at runtime to avoid permission conflicts
start_postgresql() {
    local CURRENT_UID=$(id -u)

    # Always use /tmp for PostgreSQL to work with any UID
    export PGDATA=/tmp/postgresql/data
    export PGHOST=/tmp

    # Clean up any previous attempts
    rm -rf "$PGDATA" 2>/dev/null || true
    mkdir -p "$PGDATA"

    echo "Initializing PostgreSQL cluster in $PGDATA (UID: $CURRENT_UID)..."

    # Check if running as root - root cannot run initdb directly
    if [ "$CURRENT_UID" -eq 0 ]; then
        echo "Running as root, using 'su - postgres' to initialize and run PostgreSQL..."

        # Change ownership of the data directory to postgres user
        chown -R postgres:postgres "$PGDATA"

        # Initialize as postgres user
        if ! su - postgres -c "initdb -D $PGDATA --auth-local=trust --auth-host=trust --username=postgres"; then
            echo "ERROR: Failed to initialize PostgreSQL as postgres user"
            return 1
        fi

        # Start PostgreSQL as postgres user
        if ! su - postgres -c "pg_ctl -D $PGDATA -o \"-c listen_addresses='localhost' -c unix_socket_directories='/tmp' -c shared_buffers=128MB -c max_connections=200\" -l $PGDATA/logfile start"; then
            echo "ERROR: Failed to start PostgreSQL"
            cat "$PGDATA/logfile" 2>/dev/null
            return 1
        fi
    else
        echo "Running as UID $CURRENT_UID, initializing PostgreSQL directly..."

        # Non-root can run initdb directly
        if ! initdb -D "$PGDATA" --auth-local=trust --auth-host=trust --username=postgres; then
            echo "ERROR: Failed to initialize PostgreSQL"
            return 1
        fi

        # Start PostgreSQL
        if ! pg_ctl -D "$PGDATA" \
            -o "-c listen_addresses='localhost' -c unix_socket_directories='/tmp' -c shared_buffers=128MB -c max_connections=200" \
            -l "$PGDATA/logfile" \
            start; then
            echo "ERROR: Failed to start PostgreSQL"
            cat "$PGDATA/logfile" 2>/dev/null
            return 1
        fi
    fi

    echo "PostgreSQL started successfully"

    # Wait for PostgreSQL to be ready
    for i in {1..30}; do
        if pg_isready -h /tmp -p 5432 2>/dev/null; then
            echo "PostgreSQL is ready"
            break
        fi
        echo "Waiting for PostgreSQL to start... ($i/30)"
        sleep 1
    done

    # Create the database
    echo "Creating database 'fdr'..."
    if [ "$CURRENT_UID" -eq 0 ]; then
        su - postgres -c "createdb -h /tmp -U postgres fdr" 2>/dev/null || true
    else
        createdb -h /tmp -U postgres fdr 2>/dev/null || true
    fi

    # Update DATABASE_URL for Prisma to use the Unix socket
    export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/fdr?host=/tmp"
    echo "DATABASE_URL configured for Unix socket in /tmp"

    return 0
}

# Start PostgreSQL with appropriate method
start_postgresql

echo "PostgreSQL service started."

# Use pidof or ps to get postgres PID (pgrep might not be available)
postgres_pid=$(pidof postgres || ps aux | grep postgres | grep -v grep | awk '{print $2}' | head -1 || true)
echo "PostgreSQL PID: $postgres_pid"

echo "Creating Postgres database..."

echo "Running database migrations..."

# Handle Prisma migrations with fallback for write permissions
run_prisma_migrations() {
    # First try the standard migration
    if DATABASE_URL=${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/fdr} \
        prisma migrate deploy --schema /prisma/schema.prisma 2>/dev/null; then
        echo "Prisma migrations completed successfully"
        return 0
    fi

    echo "Standard Prisma migration failed, trying with alternative engine location..."

    # Set alternative Prisma engine locations if we don't have write access
    export PRISMA_QUERY_ENGINE_BINARY="${PRISMA_QUERY_ENGINE_BINARY:-/opt/prisma-engines/query-engine}"
    export PRISMA_MIGRATION_ENGINE_BINARY="${PRISMA_MIGRATION_ENGINE_BINARY:-/opt/prisma-engines/migration-engine}"
    export PRISMA_INTROSPECTION_ENGINE_BINARY="${PRISMA_INTROSPECTION_ENGINE_BINARY:-/opt/prisma-engines/introspection-engine}"
    export PRISMA_FMT_BINARY="${PRISMA_FMT_BINARY:-/opt/prisma-engines/prisma-fmt}"

    # Try again with the alternative locations
    DATABASE_URL=${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/fdr} \
        prisma migrate deploy --schema /prisma/schema.prisma || {
        echo "Warning: Prisma migrations failed, but continuing..."
        return 1
    }
}

run_prisma_migrations
# -----------  End Postgres setup  -----------

# -----------  Start MeiliSearch setup  -----------
export MEILI_HTTP_ADDR=0.0.0.0:7700

echo "Starting MeiliSearch..."
# Change to /tmp so MeiliSearch's default data directory (./data.ms) is created there
cd /tmp
/meilisearch --master-key="fern123!" > /tmp/meilisearch.log 2>&1 &
meili_pid=$!
echo "MeiliSearch PID: $meili_pid"

# Wait for MeiliSearch to be ready
echo "Waiting for MeiliSearch to start..."
MEILI_ATTEMPTS=0
MAX_MEILI_ATTEMPTS=30
until curl -f -H "Authorization: Bearer fern123!" http://localhost:7700/health 2>/dev/null; do
    MEILI_ATTEMPTS=$((MEILI_ATTEMPTS + 1))
    if [ $MEILI_ATTEMPTS -ge $MAX_MEILI_ATTEMPTS ]; then
        echo "WARNING: MeiliSearch failed to start after $MAX_MEILI_ATTEMPTS attempts"
        echo "WARNING: Search functionality will not work"
        echo "MeiliSearch logs:"
        cat /tmp/meilisearch.log 2>/dev/null || echo "No log file found"
        break
    fi
    echo "MeiliSearch not ready yet, waiting 2 seconds... ($MEILI_ATTEMPTS/$MAX_MEILI_ATTEMPTS)"
    sleep 2
done

if [ $MEILI_ATTEMPTS -lt $MAX_MEILI_ATTEMPTS ]; then
    echo "MeiliSearch is ready!"
fi

export MEILISEARCH_URL="http://localhost:7700"
# -----------  End MeiliSearch setup  -----------


# -----------  Start MINIO setup  -----------
echo "Starting MinIO server..."
minio server ${MINIO_VOLUMES} --console-address ":9001" > /var/log/minio.log 2>&1 &
minio_pid=$!
echo "MinIO PID: $minio_pid"

# Wait for MinIO to be ready
echo "Waiting for MinIO to start..."
until curl -f ${MINIO_URL}/minio/health/live 2>/dev/null; do
    echo "MinIO not ready yet, waiting 2 seconds..."
    sleep 2
done
echo "MinIO is ready!"

# Initialize MinIO
mc alias set minio ${MINIO_URL} ${MINIO_USERNAME} ${MINIO_PASSWORD}

# Always create the .docs.buildwithfern.com bucket
mc mb minio/${ORG_NAME}.docs.buildwithfern.com
mc anonymous set download minio/${ORG_NAME}.docs.buildwithfern.com
export MINIO_BUCKET_NAME=${ORG_NAME}.docs.buildwithfern.com

# Also create the custom domain bucket if specified and not null
if [ -n "$CUSTOM_DOMAIN" ] && [ "$CUSTOM_DOMAIN" != "null" ]; then
    # Remove any slashes from the custom domain bucket name
    # Only grab the host part of the custom domain (strip protocol and path)
    CUSTOM_DOMAIN_CLEANED=$(echo "$CUSTOM_DOMAIN" | sed -E 's#^https?://##' | cut -d'/' -f1 | tr -d ':')
    # Use the cleaned custom domain for bucket creation and export
    mc mb minio/${CUSTOM_DOMAIN_CLEANED}
    mc anonymous set download minio/${CUSTOM_DOMAIN_CLEANED}
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

echo "Starting FDR server..."
node /fdr/server.cjs &
fdr_pid=$!
echo "FDR server PID: $fdr_pid"

echo "Waiting for FDR to start at localhost:8080/health..."
until curl -f http://localhost:8080/health 2>/dev/null; do
    echo "FDR not ready yet, waiting 2 seconds..."
    sleep 2
done
echo "FDR is up and running at localhost:8080/health"


# --------------  Generate docs and insert into MinIO via FDR --------------

echo "running fern generate --docs"

FERN_SELF_HOSTED=true FERN_TOKEN=dummy OVERRIDE_FDR_ORIGIN=http://localhost:8080  FERN_NO_VERSION_REDIRECTION=true fern generate --docs --log-level debug

echo " docs generated successfully"

# --------------  Finish generate docs --------------

# --------------  Start nextapp --------------

echo "Waiting for docs to start at localhost:3000..."

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
NEXT_DISABLE_CACHE=1 \
NEXT_PUBLIC_MEILISEARCH_ORIGIN="http://localhost:7700" \
NEXT_PUBLIC_MEILISEARCH_API_KEY="fern123!" \
node server.js & docs_pid=$!
if [ $? -ne 0 ]; then
    echo "Warning: Failed to start docs server (server.js), continuing anyway."
else
    echo "docs_pid: $docs_pid"
fi

# --------------  Finish nextapp --------------

echo "Calling /api/fern-docs/search/v2/reindex/meilisearch route..."
# Try to reindex search, but don't block startup if it fails
# This is non-critical - docs will work without search
REINDEX_ATTEMPTS=0
MAX_REINDEX_ATTEMPTS=10
until curl -f -X GET http://localhost:3000/api/fern-docs/search/v2/reindex/meilisearch 2>/dev/null; do
    REINDEX_ATTEMPTS=$((REINDEX_ATTEMPTS + 1))
    if [ $REINDEX_ATTEMPTS -ge $MAX_REINDEX_ATTEMPTS ]; then
        echo "WARNING: Failed to reindex search after $MAX_REINDEX_ATTEMPTS attempts"
        echo "WARNING: Docs will be available but search functionality may not work"
        echo "WARNING: This is expected in restricted environments where MeiliSearch cannot run"
        break
    fi
    echo "Reindex route not ready yet, retrying in 2 seconds... (attempt $REINDEX_ATTEMPTS/$MAX_REINDEX_ATTEMPTS)"
    sleep 2
done
if [ $REINDEX_ATTEMPTS -lt $MAX_REINDEX_ATTEMPTS ]; then
    echo "Successfully called /api/fern-docs/search/v2/reindex/meilisearch"
fi

echo "All services started. Tailing logs to keep the container running."
tail -f /dev/null