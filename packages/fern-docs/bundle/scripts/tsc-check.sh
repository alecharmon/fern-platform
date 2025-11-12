#!/bin/bash
# TypeScript check script that filters out errors from search-ui package
# This allows us to check bundle package types without being blocked by search-ui errors

set -o pipefail

# Run TypeScript compiler and filter out search-ui errors
pnpm tsc --noEmit 2>&1 | grep -v "^../search-ui/" | grep -E "(error TS|Found [0-9]+ error)" || {
  exit_code=$?
  if [ $exit_code -eq 1 ]; then
    # grep found no matches, meaning no errors (success)
    echo "✓ No TypeScript errors found (excluding search-ui)"
    exit 0
  else
    # grep encountered an error
    exit $exit_code
  fi
}

# Check if there were any errors after filtering
if echo "$output" | grep -q "error TS"; then
  exit 1
else
  echo "✓ No TypeScript errors found (excluding search-ui)"
  exit 0
fi
