set -e

echo "Building self-hosted docker image"

NAME="${1:-fern-self-hosted}"
TAG="${2:-latest}"
DOCKER_NAME="${NAME}:${TAG}"

PACKAGE_DIR="$(pwd)"
DOCKER_DIR="$PACKAGE_DIR"

if [ -n "$GITHUB_ACTIONS" ]; then
  docker buildx build \
    --cache-from type=gha \
    --cache-to type=gha,mode=max \
    --load \
    -f "$DOCKER_DIR/Dockerfile.self_hosted" \
    -t "$DOCKER_NAME" "$DOCKER_DIR/../.."
else
  docker buildx build \
    --load \
    -f "$DOCKER_DIR/Dockerfile.self_hosted" \
    -t "$DOCKER_NAME" "$DOCKER_DIR/../.."
fi

echo
echo "Built docker: $DOCKER_NAME"
echo "To run image: docker run $DOCKER_NAME"
echo
