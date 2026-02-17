set -e

# Usage: ./create_self_hosted_docker.sh [NAME] [TAG] [BASE_PATH]
# Examples:
#   ./create_self_hosted_docker.sh                           # Build fern-self-hosted:latest without basePath
#   ./create_self_hosted_docker.sh myimage latest            # Build myimage:latest without basePath
#   ./create_self_hosted_docker.sh myimage latest /docs      # Build myimage:latest with basePath=/docs

NAME="${1:-fern-self-hosted}"
TAG="${2:-latest}"
BASE_PATH="${3:-}"
DOCKER_NAME="${NAME}:${TAG}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$SCRIPT_DIR/../.."
DOCKER_DIR="$SCRIPT_DIR"

echo "============================================"
echo "Building self-hosted docker image"
echo "============================================"
echo "  Image name: $DOCKER_NAME"
echo "  Base path:  ${BASE_PATH:-'(none - serving from root)'}"
echo "============================================"
echo

# Step 1: Build the Next.js bundle (skip with SKIP_BUNDLE=1)
if [ "${SKIP_BUNDLE:-}" = "1" ]; then
    echo "Step 1: Skipping Next.js bundle build (SKIP_BUNDLE=1)"
else
    echo "Step 1: Building Next.js bundle..."
    cd "$REPO_ROOT"

    if [ -n "$BASE_PATH" ]; then
        echo "  Building with BASE_PATH=$BASE_PATH"
        BASE_PATH="$BASE_PATH" pnpm docs:self-hosted-bundle:build
    else
        echo "  Building without BASE_PATH"
        pnpm docs:self-hosted-bundle:build
    fi
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
if [ -n "$BASE_PATH" ]; then
    echo "  Base path:    $BASE_PATH"
    echo ""
    echo "To run:"
    echo "  docker run -p 3000:3000 $DOCKER_NAME"
    echo ""
    echo "Access docs at: http://localhost:3000${BASE_PATH}"
else
    echo "  Base path:    (none - serving from root)"
    echo ""
    echo "To run:"
    echo "  docker run -p 3000:3000 $DOCKER_NAME"
    echo ""
    echo "Access docs at: http://localhost:3000"
fi
echo "============================================"
