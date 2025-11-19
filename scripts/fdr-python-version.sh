#!/bin/bash

# Get the latest fdr tag
latest_tag=$(git tag -l "fdr@*" --sort=-v:refname | head -n1)

# Extract version from tag (e.g., "fdr@0.140.3" -> "0.140.3")
base_version="$(echo "$latest_tag" | sed 's/^fdr@//;')"

# Return clean version without hash (matches FAI pattern)
echo "$base_version"
