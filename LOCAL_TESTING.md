# Local FDR Testing Quick Reference

Quick guide for testing FDR server changes locally with the CLI and frontend. This connects the CLI to use a local tarball of the fern SDK, and runs your local FDR in a docker container.

| Command | Description |
|---------|-------------|
| `pnpm fdr:dev` | Start FDR server with infrastructure (default: info logs) |
| `pnpm fdr:dev -- debug` | Start FDR server with debug logging |
| `pnpm fdr-lambda:dev` | Start FDR Lambda server (port 8081) |
| `pnpm fdr:stop` | Stop FDR server and infrastructure |
| `pnpm fdr:link-to-cli` | Link local FDR SDKs to CLI for testing |
| `pnpm fdr:unlink-from-cli` | Unlink and restore published SDK versions |
| `pnpm fdr:generate` | Regenerate FDR SDK from API definition |
| `pnpm fdr-lambda:generate` | Regenerate FDR Lambda SDK from API definition |

## 🚀 Quick Start

```bash
# Start local FDR server (default log level: info)
pnpm fdr:dev

# Start with debug logging
pnpm fdr:dev -- debug

# Start with verbose logging
pnpm fdr:dev -- verbose
```

This starts everything you need:
- ✅ FDR server at http://localhost:8080
- ✅ PostgreSQL, Redis, S3 Mock

**Log levels:** `error`, `warn`, `info` (default), `debug`, `verbose`, `silly`

## 📋 Available Commands

```bash
# Start/stop FDR server
pnpm fdr:dev                    # Start with default (info) logging
pnpm fdr:dev -- debug           # Start with debug logging
pnpm fdr:dev -- verbose         # Start with verbose logging
pnpm fdr:stop                   # Stop FDR infrastructure

# Regenerate SDK from API definition
pnpm fdr:generate
```

## 🔗 SDK Linking Supported

You can link the local FDR SDKs to the CLI for testing SDK changes without publishing!

```bash
pnpm fdr:link-to-cli
```

This will:
- Build and pack `@fern-api/ui-core-utils` (dependency)
- Build and pack `@fern-api/fdr-sdk`
- Generate and pack `@fern-fern/fdr-cjs-sdk`
- Use pnpm overrides to install these local versions in the CLI

**Important**: The local SDK may have API differences from the published version the CLI expects, which can cause TypeScript errors. You'll need to update the CLI code to match the local SDK API.

## 🔄 Typical Workflow

```bash
# 1. Start everything

# 2. Make changes to FDR code

# 3. Rebuild SDK (if needed)
pnpm turbo --filter=@fern-api/fdr-sdk compile

# 4. Test in CLI -- use build.local.cjs -- this compiles with FDR set to localhost
cd ../fern && pnpm fern-local:build

# 5. Run FDR in docker
pnpm fdr:dev

# 6. Can test FE by configuring the global variables below, in the Frontend Setup section

# 7. Clean up when done
cd ../fern-platform && pnpm fdr:stop && pnpm fdr:unlink-from-cli
```

## 🌐 Local Services

When running locally:
- **FDR API**: http://localhost:8080
- **FDR Lambda API**: http://localhost:8081
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379
- **S3 Mock**: localhost:9090

## 🔗 Testing FDR Lambda Endpoints

The FDR Lambda provides endpoints for efficient retrieval of individual API endpoints. To test locally:

```bash
# Terminal 1: Start FDR server (required for infrastructure)
pnpm fdr:dev

# Terminal 2: Start FDR Lambda server
pnpm fdr-lambda:dev
```

**Available Lambda endpoints:**
- `POST http://localhost:8081/v2/registry/docs/load-docs-for-url`
- `POST http://localhost:8081/v2/registry/docs/metadata-for-url`
- `POST http://localhost:8081/v2/registry/docs/delete`
- `POST http://localhost:8081/v2/registry/docs/ensure-docs-in-s3`
- `GET http://localhost:8081/v2/registry/api/load/{apiDefinitionId}/endpoint/{endpointId}`
- `GET http://localhost:8081/v2/registry/api/load/{apiDefinitionId}/endpoint?method=GET&path=/users`

**Example: Retrieve a single endpoint**
```bash
# First, register an API definition with FDR on port 8080
# Then retrieve a specific endpoint by ID:
curl http://localhost:8081/v2/registry/api/load/{apiDefinitionId}/endpoint/{endpointId}

# Or by method and path:
curl "http://localhost:8081/v2/registry/api/load/{apiDefinitionId}/endpoint?method=GET&path=/users"
```

## 🎯 Frontend Setup

To connect the docs frontend to local FDR, add to `packages/fern-docs/bundle/.env.local`:

```bash
NEXT_PUBLIC_FDR_ORIGIN=http://localhost:8080
NEXT_PUBLIC_DOCS_DOMAIN="localhost:3000"
NEXT_PUBLIC_IS_LOCAL=1
```

And then you'll need to point the `/api/fern-docs/preview?host=` to your preview URL that was uploaded to your local FDR

## 🧹 Clean Up

```bash
# Stop FDR infrastructure
pnpm fdr:stop

# Unlink SDK from CLI
pnpm fdr:unlink-from-cli
```

## Troubleshooting

You may need to change loadWithUrl.ts to include `domainWithoutStaging`

```
    if (isLocal()) {
        const response = await provideRegistryService().docs.v2.read.getDocsForUrl({
            url: FdrAPI.Url(domainWithoutStaging)
        });
```

You may need to set `            OVERRIDE_FDR_ORIGIN: "http://localhost:8080",` in build.local.cjs