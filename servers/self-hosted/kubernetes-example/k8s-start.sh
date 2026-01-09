#!/bin/bash
# Apply Kubernetes deployment with custom image name
# Usage: ./k8s-start.sh --image <image-name> [--local] [--air-gapped]

IMAGE=""
PULL_POLICY="Always"
AIR_GAPPED="false"

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
    --air-gapped)
      AIR_GAPPED="true"
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: ./k8s-start.sh --image <image-name> [--local] [--air-gapped]"
      echo ""
      echo "Options:"
      echo "  --image       Container image to deploy (required)"
      echo "  --local       Use local image (sets imagePullPolicy: Never)"
      echo "  --air-gapped  Apply NetworkPolicy to block Internet access at runtime"
      exit 1
      ;;
  esac
done

if [ -z "$IMAGE" ]; then
  echo "Error: --image flag is required"
  echo "Usage: ./k8s-start.sh --image <image-name> [--local] [--air-gapped]"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Replace IMAGE_PLACEHOLDER and PULL_POLICY_PLACEHOLDER with actual values and apply
sed -e "s|IMAGE_PLACEHOLDER|$IMAGE|g" -e "s|imagePullPolicy: Always|imagePullPolicy: $PULL_POLICY|g" "$SCRIPT_DIR/deployment.yaml" | kubectl apply -f -
kubectl apply -f "$SCRIPT_DIR/service.yaml"

# Apply air-gapped NetworkPolicy if requested
if [ "$AIR_GAPPED" = "true" ]; then
  kubectl apply -f "$SCRIPT_DIR/networkpolicy.yaml"
  echo "Deployed fern-docs with image: $IMAGE (imagePullPolicy: $PULL_POLICY, air-gapped: enabled)"
else
  echo "Deployed fern-docs with image: $IMAGE (imagePullPolicy: $PULL_POLICY)"
fi

