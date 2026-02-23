# Local FDR Testing Quick Reference

Quick guide for testing FDR server changes locally with the CLI and frontend. This connects the CLI to use a local tarball of the fern SDK, and runs your local FDR in a docker container.

| Command | Description |
|---------|-------------|
| `pnpm fdr:dev` | Start FDR server with infrastructure (default: info logs) |
| `pnpm fdr:dev -- debug` | Start FDR server with debug logging |
| `pnpm fdr-lambda:dev` | Start FDR Lambda server (port 8081) |
| `pnpm fdr:stop` | Stop FDR server and infrastructure |
| `pnpm fdr:reset` | Reset Prisma database (drops all tables and re-runs migrations) |
| `pnpm fdr:link-to-cli` | Link local FDR SDKs to CLI for testing |
| `pnpm fdr:unlink-from-cli` | Unlink and restore published SDK versions |

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
- ✅ Local SQS (LocalStack) for PDF export queue

**Log levels:** `error`, `warn`, `info` (default), `debug`, `verbose`, `silly`

## 📋 Available Commands

```bash
# Start/stop FDR server
pnpm fdr:dev                    # Start with default (info) logging
pnpm fdr:dev -- debug           # Start with debug logging
pnpm fdr:dev -- verbose         # Start with verbose logging
pnpm fdr:stop                   # Stop FDR infrastructure

```

## 🔗 SDK Linking Supported

You can link the local FDR SDKs to the CLI for testing SDK changes without publishing!

```bash
pnpm fdr:link-to-cli
```

This will:
- Build and pack `@fern-api/ui-core-utils` (dependency)
- Build and pack `@fern-api/fdr-sdk`
- Use pnpm overrides to install these local versions in the CLI

**Important**: The local SDK may have API differences from the published version the CLI expects, which can cause TypeScript errors. You'll need to update the CLI code to match the local SDK API.

## 🔄 Typical Workflow

```bash
# 1. Start everything

# 2. Make changes to FDR code

# 3. Rebuild SDK and/or FDR (if needed)
pnpm turbo --filter=@fern-api/fdr-sdk compile
pnpm --filter=@fern-platform/fdr compile

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

## 🎨 Dashboard Setup

To connect the dashboard to local FDR, add to `packages/fern-dashboard/.env.local`:

```bash
FDR_SERVER_URL="http://localhost:8080"
```

**Note:** You'll also need to seed test docs data in your local FDR database for the dashboard to work properly. See the "Seeding Test Data for Dashboard" section below for details.

## 🧹 Clean Up

```bash
# Stop FDR infrastructure
pnpm fdr:stop

# (optional) Reset database state (drops all tables and re-runs migrations)
pnpm fdr:reset

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


## 🎨 Seeding Test Data for Dashboard

When testing the dashboard locally, you need docs sites registered in your local FDR database.

### Seed Test Docs

Use the seed script to create test docs data:

```bash
cd servers/fdr

# Using default values (sarahs-editor-test-site.docs.buildwithfern.com/subdomain3)
DATABASE_URL="postgresql://fdr:fdr1!@localhost:5432/fdr?schema=public" pnpm tsx scripts/seed-test-docs.ts

# With custom domain, path, and org ID
DATABASE_URL="postgresql://fdr:fdr1!@localhost:5432/fdr?schema=public" pnpm tsx scripts/seed-test-docs.ts example.docs.buildwithfern.com /api-reference my-org

# For root path (no subpath)
DATABASE_URL="postgresql://fdr:fdr1!@localhost:5432/fdr?schema=public" pnpm tsx scripts/seed-test-docs.ts example.docs.buildwithfern.com root my-org
```

**Arguments:**
- `domain` - The docs domain (e.g., `example.docs.buildwithfern.com`)
- `path` - The path (e.g., `/subdomain` or `root` for root). Use `root` for empty path.
- `orgId` - The organization ID (e.g., `my-org`)

**To match your Fern project**: Use values from your `fern/docs.yml` (`instances[0].url`) and `fern/fern.config.json` (`organization`).

### Verify Seeded Data

```bash
cd servers/fdr
DATABASE_URL="postgresql://fdr:fdr1!@localhost:5432/fdr?schema=public" pnpm tsx scripts/verify-test-docs.ts
```
