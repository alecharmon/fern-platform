#!/bin/bash
set -e

# BasePath is now handled at runtime via placeholder replacement.
# The build always uses a placeholder that gets replaced at container startup.
# See servers/self-hosted/scripts/patch-basepath.sh for runtime patching.

export MEILISEARCH_ORIGIN="http://localhost:7700"
export MEILISEARCH_MASTER_KEY="fern123!"
export NEXT_SERVER_ACTIONS_ENCRYPTION_KEY="C2EQHj06esR8k1JjOjQ/j4qfS3q9mRHukR+66RzDwq0="
export NEXT_TELEMETRY_DISABLED=1
export NEXT_PUBLIC_IS_SELF_HOSTED=1
export NEXT_PUBLIC_ASSET_HOSTING=1

# Always build with a placeholder basePath that gets replaced at container startup.
# This allows a single Docker image to serve from any basePath (or root).
BASEPATH_PLACEHOLDER="/__FERN_BP__"
echo "Building with basePath placeholder ($BASEPATH_PLACEHOLDER) for runtime configuration"
export NEXT_PUBLIC_BASE_PATH="$BASEPATH_PLACEHOLDER"

ENV_LOCAL_PATH="packages/fern-docs/bundle/.env.local"
ENV_LOCAL_BACKUP="packages/fern-docs/bundle/.env.local.bak"

# move .env.local to a backup if it exists
if [ -f "$ENV_LOCAL_PATH" ]; then
    echo "temporarily moving .env.local to backup..."
    mv "$ENV_LOCAL_PATH" "$ENV_LOCAL_BACKUP"
fi

# clean turbo cache before building (same as docs:clean:local)
rm -rf packages/fern-docs/bundle/.next packages/fern-docs/bundle/next-env.d.ts packages/fern-docs/bundle/dist packages/fern-docs/bundle/.turbo

# Compile all workspace dependencies first so their dist/ directories are up to date.
# This is critical because packages like @fern-api/docs-server and @fern-docs/edge-config
# have "exports" maps pointing to ./dist/*.js, and Next.js resolves those at build time.
# Without this step, stale dist/ files cause the Edge middleware to use outdated code.
echo "Compiling workspace dependencies..."
pnpm compile

# run the build process
NODE_OPTIONS="--max-old-space-size=8192" NODE_ENV=production pnpm --filter=@fern-docs/bundle docs:build:selfhosted
cp -r packages/fern-docs/bundle/.next/static packages/fern-docs/bundle/.next/standalone/packages/fern-docs/bundle/.next
find packages/fern-docs/bundle/.next -depth -mindepth 1 -not -path "packages/fern-docs/bundle/.next/standalone*" -not -path "packages/fern-docs/bundle/.next/cache*" -exec rm -rf {} \;
# Note: esbuild is kept in the standalone output (not stripped) because:
# 1. mdx-bundler invokes esbuild at runtime and needs the platform binary
# 2. The standalone build uses --webpack to avoid Turbopack's hashed external module references
#    (see https://github.com/vercel/next.js/issues/87737)
# The Dockerfile handles architecture mismatches by installing the correct platform binary.
tar -czf docs_bundle.tar.gz -C packages/fern-docs/bundle/.next/standalone .

# move .env.local back if it was backed up
if [ -f "$ENV_LOCAL_BACKUP" ]; then
    echo "restoring .env.local from backup..."
    mv "$ENV_LOCAL_BACKUP" "$ENV_LOCAL_PATH"
fi
