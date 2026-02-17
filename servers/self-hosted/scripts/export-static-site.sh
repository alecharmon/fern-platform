#!/bin/bash
set -euo pipefail

# Export a static site from a running self-hosted Fern docs container.
#
# This script:
#   1. Runs the export inside the container (triggers warmup + cache dump)
#   2. Copies the tar.gz out of the container
#   3. Extracts it into a local ./site directory
#
# Usage:
#   pnpm export:static-site
#   # or directly:
#   bash scripts/export-static-site.sh

OUTPUT_DIR="./site"
ARCHIVE_NAME="fern-static-export.tar.gz"

if [ -n "${1:-}" ]; then
    CONTAINER="$1"
else
    read -rp "Enter the Docker container name or ID: " CONTAINER
fi

if [ -z "$CONTAINER" ]; then
    echo "Error: container name cannot be empty."
    exit 1
fi

echo "Waiting for container '$CONTAINER' to be healthy..."
MAX_HEALTH_ATTEMPTS=30
HEALTH_ATTEMPT=0
while [ "$HEALTH_ATTEMPT" -lt "$MAX_HEALTH_ATTEMPTS" ]; do
    HEALTH_ATTEMPT=$((HEALTH_ATTEMPT + 1))
    if docker exec "$CONTAINER" sh -c 'TOKEN=$(cat /tmp/.cache-admin-token 2>/dev/null); curl -f -s --max-time 5 -H "Authorization: Bearer $TOKEN" http://localhost:3000/__cache/stats' > /dev/null 2>&1; then
        echo "Container is healthy."
        break
    fi
    echo "  Not ready yet... ($HEALTH_ATTEMPT/$MAX_HEALTH_ATTEMPTS)"
    sleep 5
done

if [ "$HEALTH_ATTEMPT" -ge "$MAX_HEALTH_ATTEMPTS" ]; then
    echo "Error: container did not become healthy within $((MAX_HEALTH_ATTEMPTS * 5)) seconds."
    exit 1
fi

echo "Triggering export in container '$CONTAINER'..."
docker exec "$CONTAINER" /scripts/export.sh

echo "Copying archive out of container..."
docker cp "$CONTAINER:/tmp/$ARCHIVE_NAME" "./$ARCHIVE_NAME"

echo "Extracting to $OUTPUT_DIR..."
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"
tar -xzf "$ARCHIVE_NAME" -C "$OUTPUT_DIR"

FILE_COUNT=$(find "$OUTPUT_DIR" -type f | wc -l)
echo ""
echo "Done! Exported $FILE_COUNT files to $OUTPUT_DIR"
echo ""
echo "To test locally:"
echo "  npx serve $OUTPUT_DIR"
echo ""
echo "To upload to S3:"
echo "  aws s3 sync $OUTPUT_DIR s3://my-bucket --delete"
