#!/usr/bin/env bash

set -euo pipefail

environment="$1"

if [[ "$environment" != "prod" && "$environment" != "dev" ]]; then
    echo "Usage: $0 <prod|dev>"
    exit 1
fi

worktree_root="$(git rev-parse --show-toplevel)"
git_common_dir="$(git rev-parse --git-common-dir)"
main_checkout_root="$(cd "$git_common_dir/.." && pwd)"

destination="$worktree_root/packages/fern-dashboard/.env.local"
worktree_source="$worktree_root/packages/fern-dashboard/.env.local-${environment}"
main_checkout_source="$main_checkout_root/packages/fern-dashboard/.env.local-${environment}"

if [[ -f "$worktree_source" ]]; then
    cp "$worktree_source" "$destination"
elif [[ -f "$main_checkout_source" ]]; then
    cp "$main_checkout_source" "$destination"
else
    echo "Unable to find dashboard env file for '$environment'."
    echo "Checked:"
    echo "  - $worktree_source"
    echo "  - $main_checkout_source"
    exit 1
fi
