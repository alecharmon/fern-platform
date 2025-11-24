#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
CONTAINER_NAME="fern-local-jaeger"
JAEGER_IMAGE="${JAEGER_IMAGE:-cr.jaegertracing.io/jaegertracing/jaeger:2.12.0}"

if ! command -v docker >/dev/null 2>&1; then
  echo "❌ Docker is required to run Jaeger locally. Please install Docker and try again."
  exit 1
fi

echo "📦 Ensuring Jaeger is running via Docker..."
if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  echo "✅ Jaeger container '${CONTAINER_NAME}' is already running."
else
  if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "♻️ Removing stale Jaeger container..."
    docker rm -f "${CONTAINER_NAME}" >/dev/null
  fi

  echo "🚀 Starting Jaeger (${JAEGER_IMAGE})..."
  docker run -d --rm \
    --name "${CONTAINER_NAME}" \
    -p 16686:16686 \
    -p 4317:4317 \
    -p 4318:4318 \
    "${JAEGER_IMAGE}" >/dev/null
  echo "🔗 Jaeger UI available at http://localhost:16686"
fi

DOCS_DEV_PID=""
CLEANED_UP=0

cleanup() {
  if [ "$CLEANED_UP" -eq 1 ]; then
    return
  fi
  CLEANED_UP=1

  if [ -n "${DOCS_DEV_PID}" ] && ps -p "${DOCS_DEV_PID}" >/dev/null 2>&1; then
    echo "🛑 Stopping docs dev server..."
    kill -SIGINT "${DOCS_DEV_PID}" >/dev/null 2>&1 || true
    wait "${DOCS_DEV_PID}" 2>/dev/null || true
  fi

  echo "🛑 Stopping Jaeger container..."
  docker stop "${CONTAINER_NAME}" >/dev/null 2>&1 || true
}

handle_signal() {
  echo "✋ Caught signal, cleaning up..."
  cleanup
  exit 130
}

trap cleanup EXIT
trap handle_signal INT TERM

cd "${REPO_ROOT}"
echo "🌱 Starting docs dev server with LOCAL_TRACING enabled..."
LOCAL_TRACING=true pnpm docs:dev &
DOCS_DEV_PID=$!
wait "${DOCS_DEV_PID}"
