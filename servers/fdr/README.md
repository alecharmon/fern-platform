# Fern Definition Registry

This repo contains the backend code for the Fern Definition Registry (FDR) as well as the packages/SDKs associated with it. This project is a TypeScript monorepo that uses [pnpm](https://pnpm.io/) workspaces with [Turbo](https://turbo.build) as the build system. The application that serves the API is `fdr`, which runs on AWS ([ECS](https://aws.amazon.com/ecs/)) in a Dockerized format.

## Architecture

FDR uses **Fastify** as the HTTP framework and **oRPC** ([orpc.dev](https://orpc.dev)) for defining and serving API endpoints.

- **Server entry point**: `src/server.ts` — Fastify server that mounts oRPC route handlers via `OpenAPIHandler`
- **Controllers**: `src/controllers/` — Each domain (tokens, snippets, docs, git, etc.) has a router file that defines oRPC routes using `os.route()`
- **Contracts**: `packages/fdr-sdk/src/orpc-client/` — Zod schemas and oRPC contracts that define the API interface, shared between server and client
- **Client SDK**: `packages/fdr-sdk/src/orpc-client/client.ts` — Type-safe oRPC client generated from the contracts

### Adding or modifying endpoints

1. Define the Zod input/output schemas and oRPC contract in `packages/fdr-sdk/src/orpc-client/<domain>/contract.ts`
2. Create or update the client in `packages/fdr-sdk/src/orpc-client/<domain>/client.ts`
3. Implement the server-side handler in `src/controllers/<domain>/` using `os.route()`
4. Mount the router in `src/server.ts` using `mountOrpc()`

## Setup

- Make sure Node.js 22+ and pnpm are installed on your machine

Once you've cloned the repo, install dependencies from the repository root:

```bash
pnpm install
```

## Local Development

https://github.com/fern-api/fern-platform/raw/app/servers/fdr/local-dev-demo.mp4

There are two modes for running FDR locally. Both are run from the repo root.

### Minimal local mode (no auth)

The easiest way to run FDR locally is with `pnpm fdr:local`. This single command:

1. Starts Docker infrastructure (Postgres, Redis, S3 Mock, LocalStack, Python Lambda)
2. Runs database migrations
3. Compiles workspace dependencies and builds the CJS bundle
4. Starts the FDR server on `http://localhost:8080`
5. Seeds the database with sample data (generators, CLI releases, docs sites)

```bash
# From the repo root:
pnpm fdr:local              # Start server + auto-seed (default log level: info)
pnpm fdr:local debug        # Start with debug logging
```

Once running, you can test the APIs:

```bash
# Health check
curl http://localhost:8080/health

# List all generators
curl -s http://localhost:8080/generators | python3 -m json.tool

# List CLI releases
curl -s http://localhost:8080/generators/cli | python3 -m json.tool

# Load a docs site
curl -s -X POST http://localhost:8080/v2/registry/docs/load-with-url \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer dummy-token' \
  -d '{"url": "https://acme.docs.buildwithfern.com"}' | python3 -m json.tool
```

The seed script can also be run independently:

```bash
pnpm fdr:seed               # Seed generators, CLI releases, and docs from fern-testing-umbrella

# Seed + publish additional docs from a custom fern project
pnpm fdr:seed -- --fern-dir /path/to/your/fern/project

# With explicit CLI path
pnpm fdr:seed -- --cli-path /path/to/cli.cjs
```

The seed script will:
1. Seed generators and CLI releases via curl
2. Clone [fern-testing-umbrella](https://github.com/fern-api/fern-testing-umbrella) to `/tmp/fern-testing-umbrella` (if not already present)
3. Publish docs from all projects in fern-testing-umbrella using the local Fern CLI

To publish docs, you need to build the local CLI first:

```bash
cd /path/to/fern-sparse/packages/cli/cli && node build.local.mjs
```

The CLI path auto-detects from `../fern-sparse/packages/cli/cli/dist/local/cli.cjs` relative to the fern-platform repo.

To stop, press `Ctrl+C`. To tear down Docker infrastructure:

```bash
pnpm fdr:local:stop
```

### Full dev environment (with Venus auth stack + hot-reload)

For development with authentication and hot-reload:

```bash
pnpm fdr:dev          # Start FDR from source (tsx --watch) + Venus/Auth0-Mock/Postgres/Redis/S3
pnpm fdr:dev:stop     # Stop the full dev environment
```

This starts FDR from source with hot-reload via `tsx --watch`, plus the full Venus authentication stack (Venus, Auth0 Mock, Nursery), PostgreSQL, Redis, S3 Mock, LocalStack (SQS), and local mocks for Upstash/Edge Config.

**Local mocks included** (see `servers/local-mocks/`):
- Upstash REST API: `http://localhost:8079` (seed data: `redis-seed.json`)
- Edge Config: `http://localhost:8078` (seed data: `edge-config.json`)

```bash
# Seed Redis data
docker exec -it fdr-redis-1 redis-cli HSET domain-settings:example.com defaultBasepath /docs

# Update Edge Config at runtime
curl -X PATCH http://localhost:8078/items -H "Content-Type: application/json" \
  -d '{"items": [{"operation": "upsert", "key": "seo-enabled", "value": ["example.com"]}]}'
```

**Prerequisites:** Clone the [venus](https://github.com/fern-api/venus) repo as a sibling directory (next to `fern-platform`), or set the `VENUS_REPO_PATH` environment variable.

See [LOCAL_TESTING.md](./LOCAL_TESTING.md) for the full reference including frontend/dashboard setup and SDK linking.

## Development Commands

```bash
# Development
pnpm fdr:dev                       # Full dev environment with hot-reload (from repo root)
pnpm fdr:local                     # Minimal local mode (from repo root)

# Database migrations
pnpm db:migrate:local              # Run migrations locally
pnpm db:migrate:dev                # Run migrations on dev
pnpm db:migrate:prod               # Run migrations on prod

# Testing
pnpm test                          # Unit tests
pnpm test:local                    # Integration tests with local DB
```

### Environment Variables

#### CLI Permission Checks (Optional)

The following environment variables enable CLI permission checks when publishing documentation. Permission checks are only applied to organizations listed in `CLI_PERMISSION_CHECK_ORG_IDS`.

```bash
# Auth0 Management API (for CLI permission checks)
AUTH0_DOMAIN=your-tenant.us.auth0.com
AUTH0_CLIENT_ID=your-m2m-client-id
AUTH0_CLIENT_SECRET=your-m2m-client-secret
AUTH0_ROLES={"admin":"rol_xxx","editor":"rol_xxx","viewer":"rol_xxx","cli":"rol_xxx","fine_grain":"rol_xxx"}

# Supabase (for fine-grained permissions)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

When enabled for an organization, users must have the `cli` or `admin` role in Auth0 to publish documentation. For existing docs sites, fine-grained permissions can also be checked via Supabase.
