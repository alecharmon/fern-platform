#!/bin/bash
set -e

# Script to seed the local FDR server with sample data for testing.
# Prerequisites: FDR server must be running locally on port 8080.
# Usage: ./seed-local-fdr.sh [options]
#   --url <base_url>       FDR server URL (default: http://localhost:8080)
#   --fern-dir <path>      Path to a fern project to publish docs from (optional)
#   --cli-path <path>      Path to local fern CLI (default: auto-detect from fern-sparse)

BASE_URL="http://localhost:8080"
FERN_DIR=""
CLI_PATH=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --url)
            BASE_URL="$2"
            shift 2
            ;;
        --fern-dir)
            FERN_DIR="$2"
            shift 2
            ;;
        --cli-path)
            CLI_PATH="$2"
            shift 2
            ;;
        *)
            # Legacy: first positional arg is base_url
            BASE_URL="$1"
            shift
            ;;
    esac
done

# Auto-detect CLI path if not specified
if [ -z "$CLI_PATH" ]; then
    # Try to find fern-sparse relative to fern-platform
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    POTENTIAL_CLI="$SCRIPT_DIR/../../fern-sparse/packages/cli/cli/dist/local/cli.cjs"
    if [ -f "$POTENTIAL_CLI" ]; then
        CLI_PATH="$POTENTIAL_CLI"
    fi
fi

# Clone fern-testing-umbrella if not already present
TESTING_REPO_DIR="/tmp/fern-testing-umbrella"
if [ ! -d "$TESTING_REPO_DIR" ]; then
    echo "Cloning fern-testing-umbrella to $TESTING_REPO_DIR..."
    git clone --depth 1 https://github.com/fern-api/fern-testing-umbrella "$TESTING_REPO_DIR"
    echo ""
fi

echo "============================================"
echo "  Seeding local FDR server"
echo "  Server: $BASE_URL"
if [ -n "$CLI_PATH" ] && [ -f "$CLI_PATH" ]; then
    echo "  CLI: $CLI_PATH"
    echo "  Testing repo: $TESTING_REPO_DIR"
fi
if [ -n "$FERN_DIR" ]; then
    echo "  Additional fern project: $FERN_DIR"
fi
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

# ── 0. Authentication Setup (for full dev mode) ──
# This section seeds auth0-mock tokens and Nursery users.
# Only runs if auth0-mock is available (i.e., running pnpm fdr:dev).

AUTH0_URL="http://localhost:3100"
VENUS_POSTGRES_CONTAINER="fdr-venus-postgres-1"

if curl -s --connect-timeout 2 "$AUTH0_URL/" > /dev/null 2>&1; then
    echo "--- Seeding Authentication ---"
    echo ""

    # Generate a token from auth0-mock using password grant
    echo -n "  Generating auth token from auth0-mock ... "
    TOKEN_RESPONSE=$(curl -s -X POST "$AUTH0_URL/oauth/token" \
        -H "content-type: application/x-www-form-urlencoded" \
        -d "grant_type=password&client_id=fern&client_secret=fern&username=test@example.com&password=password&audience=venus-dev")

    TOKEN=$(echo "$TOKEN_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token', ''))" 2>/dev/null)

    if [ -n "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
        # Save token to ~/.fern-local/token
        mkdir -p ~/.fern-local
        echo "$TOKEN" > ~/.fern-local/token
        echo "OK (saved to ~/.fern-local/token)"
    else
        echo "FAILED"
        echo "    Response: $TOKEN_RESPONSE"
    fi

    VENUS_URL="http://localhost:8089"

    # Create organizations via Venus (keeps auth0-mock and nursery in sync)
    # First check if orgs exist to avoid errors when auth0-mock already has them
    for org_id in fern acme plantstore; do
        echo -n "  Creating organization '$org_id' via Venus ... "

        # Check if the user already belongs to this org (the true test of correct state)
        member_check=$(curl -s -X POST \
            "$VENUS_URL/organizations/belongs-to-organization/$org_id" \
            -H "Authorization: Bearer $TOKEN")

        if [ "$member_check" = "true" ]; then
            echo "OK (already a member)"
            continue
        fi

        org_status=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$VENUS_URL/organizations/create" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $TOKEN" \
            -d "{\"organizationId\": \"$org_id\", \"artifactReadRequiresToken\": false}")
        if [ "$org_status" -ge 200 ] && [ "$org_status" -lt 300 ]; then
            echo "OK ($org_status)"
        elif [ "$org_status" -eq 409 ]; then
            # Auth0-mock ships with pre-seeded orgs that may not exist in nursery.
            # Delete from auth0-mock and recreate through Venus so both stay in sync
            # and the current user is added as a member.
            auth0_org_id=$(curl -s "$AUTH0_URL/api/v2/organizations/name/$org_id" 2>/dev/null \
                | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
            if [ -n "$auth0_org_id" ]; then
                curl -s -X DELETE "$AUTH0_URL/api/v2/organizations/$auth0_org_id" > /dev/null 2>&1
            fi
            retry_status=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$VENUS_URL/organizations/create" \
                -H "Content-Type: application/json" \
                -H "Authorization: Bearer $TOKEN" \
                -d "{\"organizationId\": \"$org_id\", \"artifactReadRequiresToken\": false}")
            if [ "$retry_status" -ge 200 ] && [ "$retry_status" -lt 300 ]; then
                echo "OK (recreated)"
            else
                echo "FAILED (recreate: $retry_status)"
            fi
        else
            echo "FAILED ($org_status)"
        fi
    done

    echo ""
else
    echo "--- Skipping Authentication ---"
    echo "  auth0-mock not running at $AUTH0_URL (only available with pnpm fdr:dev)"
    echo ""
fi

# ── Helper ────────────────────────────────────
# Load auth token if available (for full dev mode with Venus)
AUTH_TOKEN=""
if [ -f ~/.fern-local/token ]; then
    AUTH_TOKEN=$(cat ~/.fern-local/token)
fi

call() {
    local method="$1"
    local path="$2"
    local data="$3"
    local url="$BASE_URL$path"

    # Build auth header if token is available
    local auth_header=""
    if [ -n "$AUTH_TOKEN" ]; then
        auth_header="-H \"Authorization: Bearer $AUTH_TOKEN\""
    fi

    if [ "$method" = "PUT" ] || [ "$method" = "POST" ]; then
        local status
        if [ -n "$AUTH_TOKEN" ]; then
            status=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$url" \
                -H 'Content-Type: application/json' \
                -H "Authorization: Bearer $AUTH_TOKEN" \
                -d "$data")
        else
            status=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$url" \
                -H 'Content-Type: application/json' \
                -d "$data")
        fi
        if [ "$status" -ge 200 ] && [ "$status" -lt 300 ]; then
            echo "  OK ($status)"
        elif [ "$status" -eq 409 ]; then
            echo "  Already exists ($status)"
        else
            echo "  FAILED ($status)"
        fi
    else
        if [ -n "$AUTH_TOKEN" ]; then
            curl -s -X "$method" "$url" -H 'Content-Type: application/json' -H "Authorization: Bearer $AUTH_TOKEN" -d "$data"
        else
            curl -s -X "$method" "$url" -H 'Content-Type: application/json' -d "$data"
        fi
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

echo "============================================"
echo "  Seeding complete!"
echo ""
echo "  Verify with:"
echo "    curl -s $BASE_URL/generators | python3 -m json.tool"
echo "    curl -s $BASE_URL/generators/cli | python3 -m json.tool"
echo "============================================"
