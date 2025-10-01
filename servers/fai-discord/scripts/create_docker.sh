#!/usr/bin/env bash

set -e

TAG="$1"
DOCKER_NAME=fai-discord:"$TAG"

# Build from current directory but include parent context for fai dependency
docker build -f Dockerfile --build-context fai=../fai -t "$DOCKER_NAME" .

docker save "$DOCKER_NAME" -o "$DOCKER_NAME.tar"

echo
echo "Built docker: $DOCKER_NAME"
echo "To run image: docker run $DOCKER_NAME"
echo
