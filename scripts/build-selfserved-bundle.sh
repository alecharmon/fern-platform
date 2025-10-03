#!/bin/bash

# load environment variables from .env.selfserved file
if [ -f ".env.selfserved" ]; then
    set -a
    source .env.selfserved
    set +a
else
    echo ".env.selfserved file not found"
    exit 1
fi

# run the build process
NODE_ENV=production pnpm --filter=@fern-docs/bundle docs:build:selfserved
cp -r packages/fern-docs/bundle/.next/static packages/fern-docs/bundle/.next/standalone/packages/fern-docs/bundle/.next
find packages/fern-docs/bundle/.next -depth -mindepth 1 -not -path "packages/fern-docs/bundle/.next/standalone*" -exec rm -rf {} \;