#!/bin/bash
set -e

# Complete setup script for local FDR development
# This sets up everything you need to test FDR changes in the CLI and frontend

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLATFORM_ROOT="$(dirname "$SCRIPT_DIR")"
CLI_ROOT="$(dirname "$PLATFORM_ROOT")/fern"

echo "🔧 Setting up complete local FDR development environment..."
echo ""

# Step 1: Start FDR infrastructure
echo "1️⃣  Starting FDR infrastructure..."
bash "$SCRIPT_DIR/start-local-fdr.sh" &
FDR_PID=$!

# Wait for FDR to be ready
echo ""
echo "⏳ Waiting for FDR to be ready (this may take ~30 seconds)..."
sleep 30

# Check if FDR is running
if curl -s http://localhost:8080/health > /dev/null 2>&1; then
    echo "✅ FDR is running at http://localhost:8080"
else
    echo "⚠️  FDR health check failed, but continuing setup..."
fi

# Step 2: Link FDR SDK to CLI
echo ""
echo "2️⃣  Linking local FDR SDK to CLI..."
bash "$SCRIPT_DIR/link-fdr-sdk-to-cli.sh"

# Step 3: Configure CLI to use local FDR
echo ""
echo "3️⃣  Configuring CLI to use local FDR..."
if [ -d "$CLI_ROOT" ]; then
    cd "$CLI_ROOT"

    # Create or update .env file
    if [ -f ".env" ]; then
        # Update existing .env
        if grep -q "FERN_REGISTRY_URL" .env; then
            sed -i.bak 's|FERN_REGISTRY_URL=.*|FERN_REGISTRY_URL=http://localhost:8080|' .env
            rm -f .env.bak
        else
            echo "FERN_REGISTRY_URL=http://localhost:8080" >> .env
        fi
    else
        # Create new .env
        echo "FERN_REGISTRY_URL=http://localhost:8080" > .env
    fi

    echo "✅ CLI configured to use local FDR"
else
    echo "⚠️  CLI directory not found at $CLI_ROOT, skipping CLI configuration"
fi

# Step 4: Instructions for frontend
echo ""
echo "4️⃣  Frontend configuration:"
echo ""
echo "   To configure the docs frontend to use local FDR, add to"
echo "   packages/fern-docs/bundle/.env.local:"
echo ""
echo "   NEXT_PUBLIC_FDR_ORIGIN=http://localhost:8080"
echo ""

# Final instructions
echo ""
echo "🎉 Local development environment is ready!"
echo ""
echo "📝 What's running:"
echo "  - FDR Server:  http://localhost:8080"
echo "  - PostgreSQL:  localhost:5432"
echo "  - Redis:       localhost:6379"
echo "  - S3 Mock:     localhost:9090"
echo ""
echo "🔧 Next steps:"
echo "  1. CLI is configured and ready to use"
echo "  2. Make changes to FDR or FDR SDK in this repo"
echo "  3. Rebuild: pnpm turbo --filter=@fern-api/fdr-sdk compile"
echo "  4. Test in CLI: cd $CLI_ROOT && pnpm build && pnpm cli [command]"
echo ""
echo "🛑 To stop everything:"
echo "  - Stop FDR:    pnpm fdr:stop"
echo "  - Unlink SDK:  pnpm fdr:unlink-from-cli"
echo ""
echo "💡 FDR server is running in the background (PID: $FDR_PID)"
echo "   You can attach to logs with: cd servers/fdr && pnpm dev"
