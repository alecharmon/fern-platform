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
