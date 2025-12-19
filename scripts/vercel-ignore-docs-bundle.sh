#!/bin/bash

# Vercel Ignored Build Step script for fern-docs/bundle
# Returns exit code 0 to skip build, exit code 1 to proceed with build
#
# This script ensures that deployments are triggered when:
# 1. Files in the project directory (packages/fern-docs/bundle) change
# 2. The pnpm-lock.yaml file changes (dependency updates)
# 3. This is the first deployment (no previous SHA available)

echo "Checking if build should proceed..."
echo "Current SHA: $VERCEL_GIT_COMMIT_SHA"
echo "Previous SHA: $VERCEL_GIT_PREVIOUS_SHA"

# If no previous SHA, this is the first deployment - always build
if [ -z "$VERCEL_GIT_PREVIOUS_SHA" ]; then
  echo "No previous deployment found. Proceeding with build."
  exit 1
fi

# Check if pnpm-lock.yaml changed
echo "Checking for pnpm-lock.yaml changes..."
LOCKFILE_CHANGED=$(git diff --name-only "$VERCEL_GIT_PREVIOUS_SHA" "$VERCEL_GIT_COMMIT_SHA" -- pnpm-lock.yaml)

if [ -n "$LOCKFILE_CHANGED" ]; then
  echo "pnpm-lock.yaml changed. Proceeding with build."
  exit 1
fi

# Check if files in the project directory changed
echo "Checking for changes in packages/fern-docs/bundle..."
PROJECT_CHANGED=$(git diff --name-only "$VERCEL_GIT_PREVIOUS_SHA" "$VERCEL_GIT_COMMIT_SHA" -- packages/fern-docs/bundle)

if [ -n "$PROJECT_CHANGED" ]; then
  echo "Project files changed. Proceeding with build."
  exit 1
fi

# Check if shared packages that docs depends on changed
echo "Checking for changes in shared dependencies..."
SHARED_CHANGED=$(git diff --name-only "$VERCEL_GIT_PREVIOUS_SHA" "$VERCEL_GIT_COMMIT_SHA" -- \
  packages/fern-docs/components \
  packages/fern-docs/mdx \
  packages/fern-docs/search-server \
  packages/fdr-sdk \
  packages/commons)

if [ -n "$SHARED_CHANGED" ]; then
  echo "Shared dependencies changed. Proceeding with build."
  exit 1
fi

echo "No relevant changes detected. Skipping build."
exit 0
