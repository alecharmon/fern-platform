# Local Testing

## Quick Start

From the repository root, run:

```bash
pnpm fdr:dev
```

This will:
1. Start Docker infrastructure (PostgreSQL, Redis, S3 Mock)
2. Run database migrations
3. Build and start the FDR server on http://localhost:8080

## After Making Code Changes

The local dev server does not auto-reload. After making changes, you need to rebuild.

### Changes to FDR server code (`servers/fdr`)

```bash
# From the servers/fdr directory
pnpm build:tsup:cjs
```

### Changes to FDR SDK (`packages/fdr-sdk`)

If you added logging or made changes to the SDK (e.g., converters, API definitions):

```bash
# First compile the SDK
pnpm --filter=@fern-api/fdr-sdk compile

# Then rebuild the FDR server
pnpm build:tsup:cjs
```

Then restart the server with `pnpm fdr:dev` (or just `node cjs/server.cjs` if infrastructure is already running).

## Manual Setup

If you prefer to run steps individually:

```bash
cd servers/fdr

# 1. Start infrastructure
docker compose -f docker-compose.local.yml up -d

# 2. Run migrations
pnpm db:migrate:local

# 3. Build the server
pnpm build:tsup:cjs

# 4. Start the server (with required env vars)
LOCAL_MODE_OVERRIDE=true \
DATABASE_URL="postgresql://fdr:fdr1!@localhost:5432/fdr?schema=public" \
S3_ACCESS_KEY=fern_admin \
S3_SECRET_KEY=fern_admin \
S3_ENDPOINT=http://localhost:9090 \
S3_BUCKET_NAME=fdr \
S3_FORCE_PATH_STYLE=true \
node cjs/server.cjs
```

## Stopping Infrastructure

```bash
cd servers/fdr
docker compose -f docker-compose.local.yml down
```

## Services

When running locally, the following services are available:

| Service    | URL                    |
|------------|------------------------|
| FDR Server | http://localhost:8080  |
| PostgreSQL | localhost:5432         |
| Redis      | localhost:6379         |
| S3 Mock    | localhost:9090 (API)   |
| S3 Mock UI | localhost:9191         |

## Testing Docker Build

```bash
docker build -f servers/fdr/Dockerfile --target installer .
```

## Troubleshooting

### ESM/TypeScript Issues

The FDR server uses the CJS bundle (`cjs/server.cjs`) instead of running TypeScript directly with `tsx` due to ESM compatibility issues with Fern-generated code. If you see errors about missing exports or ESM modules, ensure you're running the CJS bundle.
