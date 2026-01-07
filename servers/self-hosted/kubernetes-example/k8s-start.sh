#!/bin/bash
# Apply Kubernetes deployment with custom image name
# Usage: ./k8s-start.sh --image <image-name> [--local]

IMAGE=""
PULL_POLICY="Always"

while [[ $# -gt 0 ]]; do
  case $1 in
    --image)
      IMAGE="$2"
      shift 2
      ;;
    --local)
      PULL_POLICY="Never"
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: ./k8s-start.sh --image <image-name> [--local]"
      echo ""
      echo "Options:"
      echo "  --image   Container image to deploy (required)"
      echo "  --local   Use local image (sets imagePullPolicy: Never)"
      exit 1
      ;;
  esac
done

if [ -z "$IMAGE" ]; then
  echo "Error: --image flag is required"
  echo "Usage: ./k8s-start.sh --image <image-name> [--local]"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Replace IMAGE_PLACEHOLDER and PULL_POLICY_PLACEHOLDER with actual values and apply
sed -e "s|IMAGE_PLACEHOLDER|$IMAGE|g" -e "s|imagePullPolicy: Always|imagePullPolicy: $PULL_POLICY|g" "$SCRIPT_DIR/deployment.yaml" | kubectl apply -f -
kubectl apply -f "$SCRIPT_DIR/service.yaml"

echo "Deployed fern-docs with image: $IMAGE (imagePullPolicy: $PULL_POLICY)"

