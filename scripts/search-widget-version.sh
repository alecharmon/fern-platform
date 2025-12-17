#!/usr/bin/env bash
set -e

# Find latest search-widget@* tag
latest_tag=$(git tag -l "search-widget@*" --sort=-v:refname | head -n1)

# Get current git hash for pre-release versions
hash=$(git describe --always --first-parent)

# Extract version from tag (strip "search-widget@" prefix)
result="$(echo "$latest_tag" | sed 's/^search-widget@//;')"

# Append git hash for dev builds (matches FDR SDK pattern)
echo "$result"-"$hash"
