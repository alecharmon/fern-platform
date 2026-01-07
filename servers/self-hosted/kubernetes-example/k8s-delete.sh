#!/bin/bash
# Delete Kubernetes deployment and service
# Usage: ./k8s-delete.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

kubectl delete -f "$SCRIPT_DIR/service.yaml" --ignore-not-found
kubectl delete deployment fern-docs --ignore-not-found

echo "Deleted fern-docs deployment and service"
