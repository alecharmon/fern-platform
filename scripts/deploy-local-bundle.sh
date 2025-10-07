#!/bin/bash

set -euo pipefail

PREVIEW_DIR="$HOME/.fern/app-preview"
BUNDLE_PATH="docs_bundle.tar.gz"

echo "Preparing app preview in $PREVIEW_DIR"
mkdir -p "$PREVIEW_DIR"
cp "$BUNDLE_PATH" "$PREVIEW_DIR/"

pushd "$PREVIEW_DIR" > /dev/null

mkdir -p unzipdir

echo "Untarring $BUNDLE_PATH into unzipdir..."
tar -xzf "$BUNDLE_PATH" -C unzipdir

if [ -d ".next" ]; then
    echo "Removing existing .next directory..."
    rm -rf .next
fi

echo "Moving unzipdir to .next..."
mv unzipdir .next

popd > /dev/null
echo "App preview bundle prepared at $PREVIEW_DIR/.next"
