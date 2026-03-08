# Local FDR Testing Quick Reference

Quick guide for testing FDR server changes locally with the CLI and frontend. This connects the CLI to use a local tarball of the fern SDK, and runs your local FDR in a docker container.

| Command | Description |
|---------|-------------|
| `pnpm fdr:dev` | Start FDR from source with hot-reload + Venus/Nursery/Auth0-Mock/Postgres |
| `pnpm fdr:dev:stop` | Stop the full dev environment |
| `pnpm fdr:seed` | Seed local FDR with test data (generators, docs, **and auth token**) |
| `pnpm fdr:local` | Start FDR with minimal local infrastructure (no Venus stack) |
| `pnpm fdr:local:stop` | Stop the minimal local infrastructure |
| `pnpm fdr-lambda:dev` | Start FDR Lambda server (port 8081) |
| `pnpm fdr:reset` | Reset Prisma database (drops all tables and re-runs migrations) |
| `pnpm fdr:link-to-cli` | Link local FDR SDKs to CLI for testing |
| `pnpm fdr:unlink-from-cli` | Unlink and restore published SDK versions |

## 🚀 Quick Start

```bash
# Start full dev environment (FDR from source with hot-reload + Venus stack)
pnpm fdr:dev
```

This starts everything you need:
- FDR server at http://localhost:8080 (from source, with hot-reload via `tsx --watch`)
- Venus at http://localhost:8089
- Auth0 Mock at http://localhost:3100
- Nursery (internal to Docker network, accessed by Venus)
- PostgreSQL (FDR) at localhost:5432
- PostgreSQL (Venus/Nursery) at localhost:5433
- Redis at localhost:6379
- S3 Mock at localhost:9090
- LocalStack (SQS) at localhost:4566

**Prerequisites:**
1. Clone the [venus](https://github.com/fern-api/venus) repo as a sibling directory (next to `fern-platform`), or set `VENUS_REPO_PATH`
2. Clone the [auth0-mock](https://github.com/fern-api/auth0-mock) repo as a sibling directory, or set `AUTH0_MOCK_PATH`

To change the log level, edit `servers/fdr/.env.local.dev` and set `LOG_LEVEL=debug`.

After starting the dev environment, run `pnpm fdr:seed` to seed test data and set up authentication.

### Minimal local mode (no Venus stack)

If you don't need Venus/Auth0/Nursery and just want FDR with basic infrastructure:

```bash
pnpm fdr:local                  # Start minimal FDR (no auth)
pnpm fdr:local:stop             # Stop minimal infrastructure
```

## 📋 Available Commands

```bash
# Full dev environment (with Venus stack + hot-reload)
pnpm fdr:dev                    # Start everything + FDR from source
pnpm fdr:dev:stop               # Stop docker containers

# Minimal local mode (no Venus stack)
pnpm fdr:local                  # Start minimal FDR
pnpm fdr:local:stop             # Stop minimal infrastructure
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
# 1. Start the dev environment
pnpm fdr:dev

# 2. Seed test data and get auth token
pnpm fdr:seed

# 3. Make changes to FDR code (hot-reload will pick them up)

# 4. (If needed) Rebuild SDK
pnpm turbo --filter=@fern-api/fdr-sdk compile

# 5. Test in CLI -- use build.local.cjs -- this compiles with FDR set to localhost
cd ../fern-sparse && pnpm fern-local:build

# 6. Run CLI commands (token is already set by fdr:seed)
node packages/cli/cli/dist/local/cli.cjs generate --docs

# 7. Can test FE by configuring the global variables below, in the Frontend Setup section

# 8. Clean up when done
cd ../fern-platform && pnpm fdr:dev:stop && pnpm fdr:unlink-from-cli
```

## 🌐 Local Services

When running `pnpm fdr:dev`:
- **FDR API**: http://localhost:8080 (from source, hot-reload)
- **FDR Lambda API**: http://localhost:8081
- **Venus**: http://localhost:8089
- **Auth0 Mock**: http://localhost:3100
- **PostgreSQL (FDR)**: localhost:5432
- **PostgreSQL (Venus)**: localhost:5433
- **Redis**: localhost:6379
- **S3 Mock**: localhost:9090
- **LocalStack (SQS)**: localhost:4566
- **Upstash Mock**: http://localhost:8079 (Redis REST API)
- **Edge Config Mock**: http://localhost:8078

### Pre-seeded Mock Data

The `local-mocks` container auto-seeds on startup from `servers/local-mocks/`:
- **[`redis-seed.json`](servers/local-mocks/redis-seed.json)**: Domain settings for `acme.docs.buildwithfern.com`, `plantstore.docs.buildwithfern.com`
- **[`edge-config.json`](servers/local-mocks/edge-config.json)**: Feature flags (seo-enabled, authentication, etc.)

### Auth0 Mock & Authentication

The **Auth0 Mock** ([auth0-mock repo](https://github.com/fern-api/auth0-mock)) provides local OAuth authentication. It's pre-seeded with:

**Test User:**
- Email: `test@example.com`
- Password: `password`
- User ID: `auth0|test-user-1`

**Pre-seeded Organizations** (defined in [`auth0-mock/src/store.ts`](https://github.com/fern-api/auth0-mock/blob/main/src/store.ts)):
- `fern` - Required for seeding generators/CLI releases
- `acme` - For testing docs
- `plantstore` - For testing docs
- `test-org` - Default test organization

The test user is a member of all organizations with `admin` and `cli` roles.

### CLI Authentication

The local CLI (built with `build.local.mjs`) stores tokens in `~/.fern-local/token`.

**Option 1: Use `pnpm fdr:seed` (Recommended)**

The seed script automatically generates and saves the auth token:

```bash
pnpm fdr:seed
```

This will:
1. Generate a token from auth0-mock
2. Save it to `~/.fern-local/token`
3. Seed Nursery with the test user and organizations
4. Seed FDR with generators, releases, and test docs

**Option 2: Manual token generation**

```bash
# Get a token from auth0-mock and store it
curl -s -X POST http://localhost:3100/oauth/token \
  -H "content-type: application/x-www-form-urlencoded" \
  -d "grant_type=password&client_id=fern&client_secret=fern&username=test@example.com&password=password&audience=venus-dev" \
  | jq -r '.access_token' > ~/.fern-local/token

# Now run CLI commands
node /path/to/cli.cjs generate --docs
```

**Important:** If you restart `pnpm fdr:dev`, the auth0-mock container regenerates its RSA keys, invalidating existing tokens. Run `pnpm fdr:seed` again to get a fresh token.

### How Authentication Works

The full dev environment uses a chain of services for authentication:

```
CLI/FDR Request → Venus → Auth0 Mock
                    ↓
                 Nursery (org data)
```

1. **Auth0 Mock** issues JWT tokens and stores user/org memberships
2. **Nursery** stores organization metadata (maps org names to Auth0 org IDs)
3. **Venus** validates tokens and checks org membership by querying both

**Seed files for authentication:**
- [`auth0-mock/src/store.ts`](https://github.com/fern-api/auth0-mock/blob/main/src/store.ts) - Users, orgs, and memberships
- [`scripts/seed-local-fdr.sh`](scripts/seed-local-fdr.sh) - Seeds Nursery with org data and generates auth token

## 🔗 Testing FDR Lambda Endpoints

The FDR Lambda provides endpoints for efficient retrieval of individual API endpoints. To test locally:

```bash
# Terminal 1: Start FDR server (required for infrastructure)
pnpm fdr:dev

# Terminal 2: Start FDR Lambda server
pnpm fdr-lambda:dev
```

**Available Lambda endpoints:**
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

## 📁 Seed Files Reference

All seed files that control local dev data:

| File | Purpose | When to Modify |
|------|---------|----------------|
| [`auth0-mock/src/store.ts`](https://github.com/fern-api/auth0-mock/blob/main/src/store.ts) | Users, organizations, memberships, roles | Add new test users or orgs |
| [`scripts/seed-local-fdr.sh`](scripts/seed-local-fdr.sh) | Main seed script (auth, generators, docs) | Add generators, CLI versions, or docs |
| [`servers/local-mocks/redis-seed.json`](servers/local-mocks/redis-seed.json) | Domain → org mappings for docs | Add new docs domains |
| [`servers/local-mocks/edge-config.json`](servers/local-mocks/edge-config.json) | Feature flags | Enable/disable features |
| [`servers/fdr/docker-compose.dev.yml`](servers/fdr/docker-compose.dev.yml) | Docker service configuration | Change ports, env vars |

**After modifying auth0-mock**, rebuild the container:
```bash
docker compose -f servers/fdr/docker-compose.dev.yml build auth0-mock
docker compose -f servers/fdr/docker-compose.dev.yml up -d auth0-mock
pnpm fdr:seed  # Get fresh token
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
# Stop full dev environment
pnpm fdr:dev:stop

# Stop minimal local environment
pnpm fdr:local:stop

# (optional) Reset database state (drops all tables and re-runs migrations)
pnpm fdr:reset

# Unlink SDK from CLI
pnpm fdr:unlink-from-cli
```

## Troubleshooting

### Authentication Issues

**401 Unauthorized or 403 Forbidden errors:**

1. **Token expired or invalid** - Auth0-mock generates new RSA keys on restart, invalidating old tokens:
   ```bash
   pnpm fdr:seed  # Regenerates token and re-seeds Nursery
   ```

2. **Missing org membership** - The user must belong to the org. Check auth0-mock has the org:
   ```bash
   curl -s http://localhost:3100/api/v2/organizations | jq
   curl -s "http://localhost:3100/api/v2/users/auth0%7Ctest-user-1/organizations" | jq
   ```

3. **Nursery missing org data** - Venus needs org → auth0_id mapping:
   ```bash
   docker exec fdr-venus-postgres-1 psql -U postgres -d nursery -c \
     "SELECT owner_id, convert_from(data, 'UTF8') FROM owners;"
   ```
   If orgs are missing, run `pnpm fdr:seed` to re-seed.

4. **Venus caching** - Venus caches org membership. Restart it:
   ```bash
   docker compose -f servers/fdr/docker-compose.dev.yml restart venus
   ```

### Other Issues

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
