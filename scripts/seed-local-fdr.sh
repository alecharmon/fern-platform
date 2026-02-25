#!/bin/bash
set -e

# Script to seed the local FDR server with sample data for testing.
# Prerequisites: FDR server must be running locally on port 8080.
# Usage: ./seed-local-fdr.sh [base_url]
#   base_url: optional, defaults to "http://localhost:8080"

BASE_URL="${1:-http://localhost:8080}"

echo "============================================"
echo "  Seeding local FDR server"
echo "  Server: $BASE_URL"
echo "============================================"
echo ""

# Check if the server is running
if ! curl -sf "$BASE_URL/health" > /dev/null 2>&1; then
    echo "Error: FDR server is not running at $BASE_URL"
    echo "Start it first with: pnpm fdr:local"
    exit 1
fi
echo "Server is healthy."
echo ""

# ── Helper ────────────────────────────────────
call() {
    local method="$1"
    local path="$2"
    local data="$3"
    local url="$BASE_URL$path"

    if [ "$method" = "PUT" ] || [ "$method" = "POST" ]; then
        local status
        status=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$url" \
            -H 'Content-Type: application/json' \
            -d "$data")
        if [ "$status" -ge 200 ] && [ "$status" -lt 300 ]; then
            echo "  OK ($status)"
        elif [ "$status" -eq 409 ]; then
            echo "  Already exists ($status)"
        else
            echo "  FAILED ($status)"
        fi
    else
        curl -s -X "$method" "$url" -H 'Content-Type: application/json' -d "$data"
    fi
}

# ── 1. Generators ─────────────────────────────
echo "--- Seeding Generators ---"

echo -n "  fernapi/fern-typescript-node-sdk ... "
call PUT /generators '{
    "id": "fernapi/fern-typescript-node-sdk",
    "displayName": "TypeScript Node SDK",
    "generatorType": {"type": "sdk"},
    "generatorLanguage": "typescript",
    "dockerImage": "fernapi/fern-typescript-node-sdk"
}'

echo -n "  fernapi/fern-python-sdk ... "
call PUT /generators '{
    "id": "fernapi/fern-python-sdk",
    "displayName": "Python SDK",
    "generatorType": {"type": "sdk"},
    "generatorLanguage": "python",
    "dockerImage": "fernapi/fern-python-sdk"
}'

echo -n "  fernapi/fern-java-sdk ... "
call PUT /generators '{
    "id": "fernapi/fern-java-sdk",
    "displayName": "Java SDK",
    "generatorType": {"type": "sdk"},
    "generatorLanguage": "java",
    "dockerImage": "fernapi/fern-java-sdk"
}'

echo -n "  fernapi/fern-go-sdk ... "
call PUT /generators '{
    "id": "fernapi/fern-go-sdk",
    "displayName": "Go SDK",
    "generatorType": {"type": "sdk"},
    "generatorLanguage": "go",
    "dockerImage": "fernapi/fern-go-sdk"
}'

echo -n "  fernapi/fern-ruby-sdk ... "
call PUT /generators '{
    "id": "fernapi/fern-ruby-sdk",
    "displayName": "Ruby SDK",
    "generatorType": {"type": "sdk"},
    "generatorLanguage": "ruby",
    "dockerImage": "fernapi/fern-ruby-sdk"
}'

echo -n "  fernapi/fern-csharp-sdk ... "
call PUT /generators '{
    "id": "fernapi/fern-csharp-sdk",
    "displayName": "C# SDK",
    "generatorType": {"type": "sdk"},
    "generatorLanguage": "csharp",
    "dockerImage": "fernapi/fern-csharp-sdk"
}'

echo -n "  fernapi/fern-openapi ... "
call PUT /generators '{
    "id": "fernapi/fern-openapi",
    "displayName": "OpenAPI",
    "generatorType": {"type": "other"},
    "generatorLanguage": null,
    "dockerImage": "fernapi/fern-openapi"
}'

echo -n "  fernapi/fern-postman ... "
call PUT /generators '{
    "id": "fernapi/fern-postman",
    "displayName": "Postman Collection",
    "generatorType": {"type": "other"},
    "generatorLanguage": null,
    "dockerImage": "fernapi/fern-postman"
}'

echo ""

# ── 2. Generator Releases ────────────────────
echo "--- Seeding Generator Releases ---"

echo -n "  fern-typescript-node-sdk@0.40.0 ... "
call PUT /generators/versions '{
    "generatorId": "fernapi/fern-typescript-node-sdk",
    "version": "0.40.0",
    "irVersion": 53,
    "changelogEntry": [
        {"type": "feat", "summary": "Add support for server-sent events"},
        {"type": "fix", "summary": "Fix optional query parameter serialization"}
    ],
    "tags": ["ga"]
}'

echo -n "  fern-typescript-node-sdk@0.39.0 ... "
call PUT /generators/versions '{
    "generatorId": "fernapi/fern-typescript-node-sdk",
    "version": "0.39.0",
    "irVersion": 53,
    "changelogEntry": [
        {"type": "feat", "summary": "Support for discriminated unions in request bodies"}
    ],
    "tags": ["ga"]
}'

echo -n "  fern-python-sdk@4.3.0 ... "
call PUT /generators/versions '{
    "generatorId": "fernapi/fern-python-sdk",
    "version": "4.3.0",
    "irVersion": 53,
    "changelogEntry": [
        {"type": "feat", "summary": "Add Pydantic v2 support"},
        {"type": "feat", "summary": "Support for async client generation"}
    ],
    "tags": ["ga"]
}'

echo -n "  fern-python-sdk@4.2.0 ... "
call PUT /generators/versions '{
    "generatorId": "fernapi/fern-python-sdk",
    "version": "4.2.0",
    "irVersion": 52,
    "changelogEntry": [
        {"type": "fix", "summary": "Fix circular reference handling in models"}
    ],
    "tags": ["ga"]
}'

echo -n "  fern-java-sdk@2.10.0 ... "
call PUT /generators/versions '{
    "generatorId": "fernapi/fern-java-sdk",
    "version": "2.10.0",
    "irVersion": 53,
    "changelogEntry": [
        {"type": "feat", "summary": "Add support for Spring Boot server stubs"}
    ],
    "tags": ["ga"]
}'

echo -n "  fern-go-sdk@0.28.0 ... "
call PUT /generators/versions '{
    "generatorId": "fernapi/fern-go-sdk",
    "version": "0.28.0",
    "irVersion": 53,
    "changelogEntry": [
        {"type": "feat", "summary": "Initial GA release with full API support"}
    ],
    "tags": ["ga"]
}'

echo ""

# ── 3. CLI Releases ───────────────────────────
echo "--- Seeding CLI Releases ---"

echo -n "  fern-cli@0.46.0 ... "
call PUT /generators/cli '{
    "version": "0.46.0",
    "irVersion": 53,
    "changelogEntry": [
        {"type": "feat", "summary": "Add fern generate --preview for quick SDK previews"},
        {"type": "fix", "summary": "Fix workspace detection on Windows"}
    ],
    "tags": ["ga"]
}'

echo -n "  fern-cli@0.45.0 ... "
call PUT /generators/cli '{
    "version": "0.45.0",
    "irVersion": 53,
    "changelogEntry": [
        {"type": "feat", "summary": "Support for multi-URL API definitions"},
        {"type": "chore", "summary": "Upgrade to IR v53"}
    ],
    "tags": ["ga"]
}'

echo -n "  fern-cli@0.44.0 ... "
call PUT /generators/cli '{
    "version": "0.44.0",
    "irVersion": 52,
    "changelogEntry": [
        {"type": "feat", "summary": "Add fern docs deploy command"}
    ],
    "tags": ["ga"]
}'

echo ""

# ── 4. Docs Sites ────────────────────────────
echo "--- Seeding Docs Sites ---"

# Helper: register a docs site so it can be retrieved via loadWithUrl.
# Usage: seed_docs_site <orgId> <subdomain> <page_title> <page_markdown>
seed_docs_site() {
    local org_id="$1"
    local subdomain="$2"
    local page_title="$3"
    local page_markdown="$4"
    local domain="https://${subdomain}.docs.buildwithfern.com"

    echo -n "  ${subdomain}.docs.buildwithfern.com ... "

    # Step 1: Start docs registration
    local init_response
    init_response=$(curl -s -X POST "$BASE_URL/v2/registry/docs/v2/init" \
        -H 'Content-Type: application/json' \
        -H 'Authorization: Bearer dummy-token' \
        -d "{
            \"orgId\": \"${org_id}\",
            \"domain\": \"${domain}\",
            \"customDomains\": [],
            \"filepaths\": []
        }")

    local registration_id
    registration_id=$(echo "$init_response" | python3 -c "import sys,json; print(json.load(sys.stdin)['docsRegistrationId'])" 2>/dev/null)

    if [ -z "$registration_id" ]; then
        echo "FAILED (could not start registration)"
        echo "    Response: $init_response"
        return 1
    fi

    # Step 2: Finish docs registration with a minimal docs definition
    local finish_status
    finish_status=$(curl -s -o /dev/null -w "%{http_code}" \
        -X POST "$BASE_URL/v2/registry/docs/register/${registration_id}" \
        -H 'Content-Type: application/json' \
        -H 'Authorization: Bearer dummy-token' \
        -d "{
            \"docsRegistrationId\": \"${registration_id}\",
            \"docsDefinition\": {
                \"pages\": {
                    \"getting-started\": {
                        \"markdown\": $(echo "$page_markdown" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read()))")
                    }
                },
                \"config\": {
                    \"navigation\": {
                        \"items\": [
                            {
                                \"type\": \"page\",
                                \"id\": \"getting-started\",
                                \"title\": \"${page_title}\"
                            }
                        ]
                    }
                }
            }
        }")

    if [ "$finish_status" -ge 200 ] && [ "$finish_status" -lt 300 ]; then
        echo "OK ($finish_status)"
    else
        echo "FAILED (finish returned $finish_status)"
        return 1
    fi
}

seed_docs_site "acme" "acme" "Getting Started" "# Welcome to Acme

This is the Acme API documentation.

## Quick Start

Install the SDK:
\`\`\`bash
npm install @acme/sdk
\`\`\`

Then initialize the client:
\`\`\`typescript
import { AcmeClient } from '@acme/sdk';
const client = new AcmeClient({ apiKey: 'your-key' });
\`\`\`
"

seed_docs_site "plantstore" "plantstore" "Plant Store API" "# Plant Store API

Welcome to the Plant Store API docs.

## Overview

The Plant Store API lets you manage your inventory of plants.

## Authentication

All requests require a Bearer token in the Authorization header.
"

echo ""

# ── 5. Verify Docs Sites ────────────────────
echo "--- Verifying Docs Sites (loadWithUrl) ---"

for subdomain in acme plantstore; do
    echo -n "  ${subdomain}.docs.buildwithfern.com ... "
    verify_status=$(curl -s -o /dev/null -w "%{http_code}" \
        -X POST "$BASE_URL/v2/registry/docs/load-with-url" \
        -H 'Content-Type: application/json' \
        -H 'Authorization: Bearer dummy-token' \
        -d "{\"url\": \"https://${subdomain}.docs.buildwithfern.com\"}")

    if [ "$verify_status" -ge 200 ] && [ "$verify_status" -lt 300 ]; then
        echo "OK ($verify_status)"
    else
        echo "FAILED ($verify_status)"
    fi
done

echo ""

echo "============================================"
echo "  Seeding complete!"
echo ""
echo "  Verify with:"
echo "    curl -s $BASE_URL/generators | python3 -m json.tool"
echo "    curl -s $BASE_URL/generators/cli | python3 -m json.tool"
echo "    curl -s -X POST $BASE_URL/v2/registry/docs/load-with-url \\"
echo "      -H 'Content-Type: application/json' \\"
echo "      -H 'Authorization: Bearer dummy-token' \\"
echo "      -d '{\"url\": \"https://acme.docs.buildwithfern.com\"}' | python3 -m json.tool"
echo "============================================"
