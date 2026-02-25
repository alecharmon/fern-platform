# Fern Definition Registry

This repo contains the backend code for the Fern Definition Registry (FDR) as well as the packages/SDKs associated with it. This project is a TypeScript monorepo that uses [pnpm](https://pnpm.io/) workspaces with [Turbo](https://turbo.build) as the build system. The interface of the FDR API is defined in Fern. The application that serves the API is `fdr`, which runs on AWS ([ECS](https://aws.amazon.com/ecs/)) in a Dockerized format.

## Setup

- Make sure Node.js 18+ and pnpm are installed on your machine
- Make sure you have fern-api installed: `npm install -g fern-api`

Once you've cloned the repo to your favourite directory run the following:

```bash
pnpm
fern generate
```

This will install the dependencies for all workspaces, and generate the SDKs required by
the FDR app.

## Local Development

https://github.com/fern-api/fern-platform/raw/app/servers/fdr/local-dev-demo.mp4

The easiest way to run FDR locally is with `pnpm fdr:local` (from the repo root). This single command:

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
pnpm fdr:seed               # Seed against a running server on localhost:8080
```

To stop, press `Ctrl+C`. To tear down Docker infrastructure:

```bash
cd servers/fdr && docker compose -f docker-compose.local.yml down
```

## Development Commands

```bash
# Development
pnpm dev                           # Run with tsx watch mode

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
