#!/usr/bin/env bash

set -e

TAG="$1"
DOCKER_NAME=fai:"$TAG"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FAI_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SERVERS_DIR="$(cd "$FAI_DIR/.." && pwd)"

docker build -f "$FAI_DIR/Dockerfile" -t "$DOCKER_NAME" "$SERVERS_DIR"

docker save "$DOCKER_NAME" -o "$DOCKER_NAME.tar"

echo
echo "Built docker: $DOCKER_NAME"
echo "To run image: docker run $DOCKER_NAME"
echo
