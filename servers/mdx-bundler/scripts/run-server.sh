#!/bin/sh

# Ensure the fake directory exists and is writable
mkdir -p /mdx-bundler/__mdx_bundler_fake_dir__
chmod 777 /mdx-bundler/__mdx_bundler_fake_dir__

# Set esbuild path
export ESBUILD_BINARY_PATH="/mdx-bundler/node_modules/.bin/esbuild"

# Run the server
node server.cjs
