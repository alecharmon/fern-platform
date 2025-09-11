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
node server.js & docs_pid=$!
if [ $? -ne 0 ]; then
    echo "Warning: Failed to start docs server (server.js), continuing anyway."
else
    echo "docs_pid: $docs_pid"
fi

# --------------  Finish nextapp --------------

echo "Calling /api/fern-docs/search/v2/reindex/meilisearch route..."
until curl -f -X GET http://localhost:3000/api/fern-docs/search/v2/reindex/meilisearch; do
    echo "Reindex route not ready yet, retrying in 2 seconds..."
    sleep 2
done
echo "Successfully called /api/fern-docs/search/v2/reindex/meilisearch"

echo "All services started. Tailing logs to keep the container running."
tail -f /dev/null