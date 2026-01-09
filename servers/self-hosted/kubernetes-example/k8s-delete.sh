#!/bin/bash
# Delete Kubernetes deployment, service, and network policy
# Usage: ./k8s-delete.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

kubectl delete -f "$SCRIPT_DIR/service.yaml" --ignore-not-found
kubectl delete deployment fern-docs --ignore-not-found
kubectl delete -f "$SCRIPT_DIR/networkpolicy.yaml" --ignore-not-found

echo "Deleted fern-docs deployment, service, and network policy"
