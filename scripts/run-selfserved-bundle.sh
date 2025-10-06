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

# start the server
NODE_ENV=production pnpm --filter=@fern-docs/bundle docs:start:local