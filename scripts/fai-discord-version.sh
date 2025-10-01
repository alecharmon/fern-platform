#!/usr/bin/env bash

latest_tag=$(git tag -l "fai-discord@*" --sort=-v:refname | head -n1)

hash=$(git describe --always --first-parent)

if [ -z "$latest_tag" ]; then
  result="0.0.0"
else
  result="$(echo "$latest_tag" | sed 's/^fai-discord@//;')"
fi

echo "$result"-"$hash"
