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
# Use pg_ctl instead of service command (which doesn't exist in Wolfi)
su - postgres -c "pg_ctl -D /var/lib/postgresql/data start"
echo "PostgreSQL service started."

# Use pidof or ps to get postgres PID (pgrep might not be available)
postgres_pid=$(pidof postgres || ps aux | grep postgres | grep -v grep | awk '{print $2}' | head -1 || true)
echo "PostgreSQL PID: $postgres_pid"

echo "Creating Postgres database..."

echo "Running database migrations..."
DATABASE_URL=${DATABASE_URL} prisma migrate deploy --schema /prisma/schema.prisma
# -----------  End Postgres setup  -----------

# -----------  Start MeiliSearch setup  -----------
export MEILI_HTTP_ADDR=0.0.0.0:7700

echo "Starting MeiliSearch..."
./meilisearch --master-key="fern123!" > /var/log/meilisearch.log 2>&1 &
meili_pid=$!
echo "MeiliSearch PID: $meili_pid"

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

# Make bucket public

# map custom domain to local machine
echo "127.0.0.1 $ORG_NAME.docs.buildwithfern.com.localhost" >> /etc/hosts
echo "::1 $ORG_NAME.docs.buildwithfern.com.localhost" >> /etc/hosts

# If CUSTOM_DOMAIN is set and not null, set CUSTOM_DOMAIN_CLEANED for later use
if [ -n "$CUSTOM_DOMAIN" ] && [ "$CUSTOM_DOMAIN" != "null" ]; then
    CUSTOM_DOMAIN_CLEANED=$(echo "$CUSTOM_DOMAIN" | sed -E 's#^https?://##' | cut -d'/' -f1 | tr -d ':')
    echo "127.0.0.1 $CUSTOM_DOMAIN_CLEANED.localhost" >> /etc/hosts
    echo "::1 $CUSTOM_DOMAIN_CLEANED.localhost" >> /etc/hosts
else
    CUSTOM_DOMAIN_CLEANED=""
fi

# use the cleaned custom domain for files origin, if it exists
if [ -n "$CUSTOM_DOMAIN_CLEANED" ] && [ "$CUSTOM_DOMAIN_CLEANED" != "null" ]; then
    FILES_ORIGIN=${CUSTOM_DOMAIN_CLEANED}
else
    FILES_ORIGIN=${NEXT_PUBLIC_DOCS_DOMAIN_URL}
fi

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

FERN_SELF_HOSTED=true FERN_TOKEN=dummy OVERRIDE_FDR_ORIGIN=http://localhost:8080  FERN_NO_VERSION_REDIRECTION=true fern generate --docs

echo " docs generated successfully"

# --------------  Finish generate docs --------------

# --------------  Start nextapp --------------

echo "Waiting for docs to start at localhost:3000..."

cd /nextapp/packages/fern-docs/bundle
echo "Current directory: $(pwd)"
echo "Contents of current directory:"
ls -la

echo "=== DEBUGGING DOCS SERVER STARTUP ==="
echo "Checking Node.js version:"
node --version
echo "Checking npm version:"
npm --version
echo "Checking available memory:"
free -h || echo "free command not available"
echo "Checking disk space:"
df -h /nextapp/packages/fern-docs/bundle || echo "df command not available"
echo "Checking if server.js exists:"
if [ -f "server.js" ]; then
    echo "✓ server.js found"
    echo "File permissions:"
    ls -la server.js
    echo "File size: $(wc -c < server.js) bytes"
else
    echo "✗ server.js NOT FOUND"
    echo "Looking for alternative server files:"
    find . -name "*server*" -type f | head -5
fi

echo "Checking package.json:"
if [ -f "package.json" ]; then
    echo "✓ package.json found"
    echo "Main entry point:"
    jq -r '.main // "not specified"' package.json
    echo "Scripts available:"
    jq -r '.scripts // {}' package.json | head -10
else
    echo "✗ package.json NOT FOUND"
fi

echo "Checking node_modules:"
if [ -d "node_modules" ]; then
    echo "✓ node_modules directory exists"
    echo "Node modules count: $(find node_modules -type d -maxdepth 1 | wc -l)"
    echo "Sample node_modules (first 5):"
    ls node_modules | head -5
else
    echo "✗ node_modules directory NOT FOUND"
fi

echo "Checking port 3000 availability:"
if netstat -tlnp | grep :3000 > /dev/null; then
    echo "✗ Port 3000 is already in use:"
    netstat -tlnp | grep :3000
else
    echo "✓ Port 3000 is available"
fi

echo "=== ENVIRONMENT VARIABLES VERIFICATION ==="
echo "Checking required environment variables:"
echo "HOSTNAME=0.0.0.0"
echo "PORT=3000"
echo "NEXT_PUBLIC_FDR_ORIGIN_PORT=8080"
echo "NEXT_PUBLIC_FDR_ORIGIN=http://localhost:8080"
echo "NEXT_PUBLIC_MINIO_BUCKET_HOST=${MINIO_URL}"
echo "NEXT_PUBLIC_MINIO_ACCESS_KEY=${MINIO_ROOT_USER}"
echo "NEXT_PUBLIC_MINIO_SECRET_KEY=${MINIO_ROOT_PASSWORD}"
echo "NEXT_PUBLIC_FILES_ORIGIN=http://${FILES_ORIGIN}.localhost:9000"
echo "NEXT_PUBLIC_ASSET_HOSTING=1"
echo "NEXT_PUBLIC_DOCS_DOMAIN=${NEXT_PUBLIC_DOCS_DOMAIN_URL}"
echo "NEXT_PUBLIC_IS_SELF_HOSTED=1"
echo "NEXT_DISABLE_CACHE=1"
echo "NEXT_PUBLIC_MEILISEARCH_ORIGIN=http://localhost:7700"
echo "NEXT_PUBLIC_MEILISEARCH_API_KEY=fern123!"

echo "Verifying critical variables are not empty:"
[ -n "${MINIO_URL}" ] && echo "✓ MINIO_URL is set" || echo "✗ MINIO_URL is empty"
[ -n "${MINIO_ROOT_USER}" ] && echo "✓ MINIO_ROOT_USER is set" || echo "✗ MINIO_ROOT_USER is empty"
[ -n "${MINIO_ROOT_PASSWORD}" ] && echo "✓ MINIO_ROOT_PASSWORD is set" || echo "✗ MINIO_ROOT_PASSWORD is empty"
[ -n "${FILES_ORIGIN}" ] && echo "✓ FILES_ORIGIN is set" || echo "✗ FILES_ORIGIN is empty"
[ -n "${NEXT_PUBLIC_DOCS_DOMAIN_URL}" ] && echo "✓ NEXT_PUBLIC_DOCS_DOMAIN_URL is set" || echo "✗ NEXT_PUBLIC_DOCS_DOMAIN_URL is empty"

echo "=== STARTING DOCS SERVER ==="

echo "Attempting to start docs server..."
echo "Command: node server.js"
echo "Working directory: $(pwd)"
echo "User: $(whoami)"
echo "Process limits:"
ulimit -a

HOSTNAME="0.0.0.0" \
PORT=3000 \
NEXT_PUBLIC_FDR_ORIGIN_PORT=8080 \
NEXT_PUBLIC_FDR_ORIGIN="http://localhost:8080" \
NEXT_PUBLIC_MINIO_BUCKET_HOST=${MINIO_URL} \
NEXT_PUBLIC_MINIO_ACCESS_KEY=${MINIO_ROOT_USER} \
NEXT_PUBLIC_MINIO_SECRET_KEY=${MINIO_ROOT_PASSWORD} \
NEXT_PUBLIC_FILES_ORIGIN="http://${FILES_ORIGIN}.localhost:9000" \
NEXT_PUBLIC_ASSET_HOSTING="1" \
NEXT_PUBLIC_DOCS_DOMAIN=${NEXT_PUBLIC_DOCS_DOMAIN_URL} \
NEXT_PUBLIC_IS_SELF_HOSTED=1 \
NEXT_DISABLE_CACHE=1 \
NEXT_PUBLIC_MEILISEARCH_ORIGIN="http://localhost:7700" \
NEXT_PUBLIC_MEILISEARCH_API_KEY="fern123!" \
node server.js > /var/log/docs-server.log 2>&1 & docs_pid=$!

echo "Docs server started with PID: $docs_pid"
echo "Docs server logs will be written to /var/log/docs-server.log"
echo "Immediate check - is process running?"
if kill -0 $docs_pid 2>/dev/null; then
    echo "✓ Process is running immediately after start"
else
    echo "✗ Process died immediately - checking logs:"
    cat /var/log/docs-server.log
fi

# Wait a moment for the server to start
sleep 3

# Check if the process is still running
if ! kill -0 $docs_pid 2>/dev/null; then
    echo "ERROR: Docs server process died immediately after starting"
    echo "Docs server logs:"
    cat /var/log/docs-server.log
    exit 1
fi

echo "Docs server process is running, waiting for it to be ready..."

# Wait for the docs server to be ready with timeout
timeout=60
counter=0
while [ $counter -lt $timeout ]; do
    if ! kill -0 $docs_pid 2>/dev/null; then
        echo "✗ Process died during startup:"
        tail -10 /var/log/docs-server.log
        exit 1
    fi
    
    if curl -f http://localhost:3000/health 2>/dev/null; then
        echo "✓ Docs server ready"
        break
    fi
    
    echo "Waiting... ($((counter/2 + 1))/$((timeout/2)))"
    sleep 2
    counter=$((counter + 2))
done

if [ $counter -ge $timeout ]; then
    echo "=== DOCS SERVER STARTUP FAILED ==="
    echo "ERROR: Docs server failed to start within $timeout seconds"
    echo "Process status:"
    if kill -0 $docs_pid 2>/dev/null; then
        echo "✓ Process is still running but not responding"
        echo "Process details:"
        ps -p $docs_pid -o pid,ppid,cmd,etime,pcpu,pmem
    else
        echo "✗ Process has died"
    fi
    echo "Port 3000 status:"
    netstat -tlnp | grep :3000 | head -3 || echo "Port 3000 not in use"
    echo "Last 20 lines of docs server logs:"
    tail -20 /var/log/docs-server.log
    echo "System resources:"
    free -h || echo "free command not available"
    df -h /nextapp/packages/fern-docs/bundle || echo "df command not available"
    echo "Recent system logs (if available):"
    dmesg | tail -5 2>/dev/null || echo "dmesg not available"
    exit 1
fi

# --------------  Finish nextapp --------------

echo "Reindexing search..."

timeout=120
counter=0
while [ $counter -lt $timeout ]; do
    if curl -f -X GET http://localhost:3000/api/fern-docs/search/v2/reindex/meilisearch 2>/dev/null; then
        echo "✓ Search reindexed"
        break
    fi
    
    if ! kill -0 $docs_pid 2>/dev/null; then
        echo "✗ Docs server died during reindex"
        exit 1
    fi
    
    sleep 2
    counter=$((counter + 2))
done

if [ $counter -ge $timeout ]; then
    echo "ERROR: Reindex route failed to respond within $timeout seconds"
    echo "Checking available routes on port 3000:"
    curl -s http://localhost:3000/api/ 2>/dev/null || echo "No response from /api/"
    echo "Checking docs server logs for errors:"
    tail -20 /var/log/docs-server.log
    echo "Checking if port 3000 is accessible:"
    netstat -tlnp | grep :3000
    exit 1
fi

echo "All services started. Tailing logs to keep the container running."
tail -f /dev/null