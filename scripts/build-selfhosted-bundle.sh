#!/bin/bash

# Accept BASE_PATH as an optional argument (e.g., ./build-selfhosted-bundle.sh /docs)
BASE_PATH="${1:-}"

export NEXT_PUBLIC_MEILISEARCH_ORIGIN="http://localhost:7700"
export NEXT_PUBLIC_MEILISEARCH_API_KEY="fern123!"
export NEXT_SERVER_ACTIONS_ENCRYPTION_KEY="C2EQHj06esR8k1JjOjQ/j4qfS3q9mRHukR+66RzDwq0="
export NEXT_TELEMETRY_DISABLED=1

# Set BASE_PATH if provided
if [ -n "$BASE_PATH" ]; then
    echo "Building with BASE_PATH: $BASE_PATH"
    export NEXT_PUBLIC_BASE_PATH="$BASE_PATH"
else
    echo "Building without BASE_PATH (app will be served from root)"
fi

ENV_LOCAL_PATH="packages/fern-docs/bundle/.env.local"
ENV_LOCAL_BACKUP="packages/fern-docs/bundle/.env.local.bak"

# move .env.local to a backup if it exists
if [ -f "$ENV_LOCAL_PATH" ]; then
    echo "temporarily moving .env.local to backup..."
    mv "$ENV_LOCAL_PATH" "$ENV_LOCAL_BACKUP"
fi

# run the build process
NODE_OPTIONS="--max-old-space-size=8192" NODE_ENV=production pnpm --filter=@fern-docs/bundle docs:build:selfhosted
cp -r packages/fern-docs/bundle/.next/static packages/fern-docs/bundle/.next/standalone/packages/fern-docs/bundle/.next
find packages/fern-docs/bundle/.next -depth -mindepth 1 -not -path "packages/fern-docs/bundle/.next/standalone*" -not -path "packages/fern-docs/bundle/.next/cache*" -exec rm -rf {} \;
rm -rf packages/fern-docs/bundle/.next/standalone/node_modules/.pnpm/esbuild@0.27.0 && rm -rf packages/fern-docs/bundle/.next/standalone/node_modules/.pnpm/@esbuild+linux-x64@0.27.0
tar -czf docs_bundle.tar.gz -C packages/fern-docs/bundle/.next/standalone .

# move .env.local back if it was backed up
if [ -f "$ENV_LOCAL_BACKUP" ]; then
    echo "restoring .env.local from backup..."
    mv "$ENV_LOCAL_BACKUP" "$ENV_LOCAL_PATH"
fi
