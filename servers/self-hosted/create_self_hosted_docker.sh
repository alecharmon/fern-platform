set -e

# Usage: ./create_self_hosted_docker.sh [NAME] [TAG]
# Examples:
#   ./create_self_hosted_docker.sh                    # Build fern-self-hosted:latest
#   ./create_self_hosted_docker.sh myimage latest      # Build myimage:latest
#
# BasePath is configured at RUNTIME via the NEXT_PUBLIC_BASE_PATH env var:
#   docker run -e NEXT_PUBLIC_BASE_PATH=/docs -p 3000:3000 fern-self-hosted:latest

NAME="${1:-fern-self-hosted}"
TAG="${2:-latest}"
DOCKER_NAME="${NAME}:${TAG}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$SCRIPT_DIR/../.."
DOCKER_DIR="$SCRIPT_DIR"

echo "============================================"
echo "Building self-hosted docker image"
echo "============================================"
echo "  Image name: $DOCKER_NAME"
echo "============================================"
echo

# Step 1: Build the Next.js bundle (skip with SKIP_BUNDLE=1)
if [ "${SKIP_BUNDLE:-}" = "1" ]; then
    echo "Step 1: Skipping Next.js bundle build (SKIP_BUNDLE=1)"
else
    echo "Step 1: Building Next.js bundle..."
    cd "$REPO_ROOT"
    pnpm docs:self-hosted-bundle:build
fi

echo
echo "Step 2: Building Docker image..."
cd "$SCRIPT_DIR"

if [ -n "$GITHUB_ACTIONS" ]; then
  docker buildx build \
    --cache-from type=gha \
    --cache-to type=gha,mode=max \
    --load \
    -f "$DOCKER_DIR/Dockerfile.self_hosted" \
    -t "$DOCKER_NAME" "$REPO_ROOT"
else
  # Use plain docker build locally (faster than buildx --load which exports via tarball)
  docker build \
    -f "$DOCKER_DIR/Dockerfile.self_hosted" \
    -t "$DOCKER_NAME" "$REPO_ROOT"
fi

echo
echo "============================================"
echo "Build complete!"
echo "============================================"
echo "  Docker image: $DOCKER_NAME"
echo ""
echo "To run (from root):"
echo "  docker run -p 3000:3000 $DOCKER_NAME"
echo ""
echo "To run with a basePath (e.g. /docs):"
echo "  docker run -e NEXT_PUBLIC_BASE_PATH=/docs -p 3000:3000 $DOCKER_NAME"
echo "============================================"
