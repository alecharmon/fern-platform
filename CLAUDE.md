# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is the Fern Platform monorepo containing Fern's documentation platform and related services. It uses pnpm workspaces and Turbo for monorepo orchestration.

**Main directories:**
- `packages/` - Shared libraries and UI components
  - `fern-docs/bundle` - Next.js docs UI application
  - `fern-dashboard/` - Next.js dashboard UI application
  - `commons/` - Shared utilities (docs-auth, docs-loader, docs-server, etc.)
  - `fdr-sdk/`, `fai-sdk/` - Generated SDK packages
- `servers/` - Backend services
  - `fdr/` - Fern Definition Registry (Node.js/Express with Prisma)
  - `fai/` - Fern AI service (Python/FastAPI with Poetry)
  - `fai-discord/` - Discord bot for FAI (Python)
  - `fern-bot/` - GitHub bot service
  - `self-hosted/` - Self-hosted deployment utilities
- `fern/` - Fern API definitions and documentation
- `scripts/` - Build and deployment scripts

## Development Commands

### Installation
```bash
pnpm install
```

### Building and Compiling
```bash
pnpm compile           # Compile TypeScript packages
pnpm build             # Build all packages (runs compile + codegen)
pnpm turbo compile     # Use turbo to compile with caching
pnpm codegen           # Run codegen (Prisma, etc.)
```

### Linting and Formatting
```bash
pnpm lint              # Run all linters (biome + style)
pnpm lint:biome        # Run Biome linter
pnpm lint:style        # Run stylelint for SCSS
pnpm lint:fix          # Auto-fix linting issues

pnpm format            # Format code with Biome
pnpm format:check      # Check formatting
pnpm format:yaml:fix   # Format YAML files with Prettier
```

### Testing
```bash
pnpm test              # Run all tests (Vitest)
pnpm test:update       # Run tests and update snapshots

# Run tests for specific service
pnpm --filter=@fern-platform/fdr test
pnpm --filter=@fern-platform/fdr test:local  # FDR tests against local DB
```

To run a single test file:
```bash
# Navigate to the package directory or use --filter
pnpm --filter=<package-name> vitest <path-to-test-file>
```

### Fern API Definitions
```bash
pnpm fern check                    # Validate Fern API definitions
pnpm fern generate --api fdr       # Generate FDR SDK
pnpm fern generate --api fai       # Generate FAI SDK
```

Note: Fern commands are prefixed with `pnpm` since Fern is a workspace dependency.

## Service-Specific Commands

### Docs UI (Next.js)
```bash
# Development
pnpm docs:dev                      # Run docs dev server (localhost:3000)
pnpm turbo docs:dev                # Run with turbo

# Building
pnpm docs:build                    # Production build
pnpm docs:local-bundle:build       # Build local bundle
pnpm docs:local-bundle:deploy      # Deploy bundle to ~/.fern/app-preview-local/

# Using local bundle with Fern CLI
fern docs dev --bundle-path ~/.fern/app-preview-local/.next

# Self-hosted builds
pnpm docs:self-hosted-bundle:build
pnpm docs:self-served-bundle:build
```

**Setup:** First-time setup requires linking with Vercel:
```bash
npm install -g vercel
vercel link --project prod.ferndocs.com
vercel pull
cp .vercel/.env.development.local packages/fern-docs/bundle/.env.local
```

Set `NEXT_PUBLIC_DOCS_DOMAIN` in `.env.local` to test with a specific domain.

### Dashboard UI (Next.js)
```bash
# Development
pnpm turbo --filter=@fern-dashboard/ui dashboard:dev

# Setup
cd packages/fern-dashboard
vercel pull
cp .vercel/.env.development.local .env.local
```

### FDR Server (Node.js/Express)
```bash
# Development
cd servers/fdr
pnpm dev                           # Run with tsx watch mode

# Database migrations
pnpm db:migrate:local              # Run migrations locally
pnpm db:migrate:dev                # Run migrations on dev
pnpm db:migrate:prod               # Run migrations on prod

# Testing
pnpm test                          # Unit tests
pnpm test:local                    # Integration tests with local DB
```

### FAI Server (Python/FastAPI)
```bash
cd servers/fai

# Install dependencies
curl -sSL https://install.python-poetry.org | python - -y --version 1.5.1
poetry install

# Development
pnpm fai:dev                       # Run local FAI server (from root)

# Linting and formatting
make code-cleanup                  # Run ruff formatter/linter
poetry run mypy .                  # Type checking

# Testing
poetry run pytest -sv
```

## Architecture

### FDR (Fern Definition Registry)
- **Purpose**: Backend API for storing and retrieving API definitions and documentation
- **Stack**: Node.js, Express, Prisma (PostgreSQL), Redis
- **Location**: `servers/fdr/`
- **API**: Defined in `fern/apis/fdr/`
- **SDK**: Generated at `packages/fdr-sdk/`

FDR is deployed to ECS. PRs merged to main with FDR changes auto-deploy to dev. Production releases use tags: `fdr@<version>`.

### FAI (Fern AI)
- **Purpose**: AI-powered features for documentation (search, chat, etc.)
- **Stack**: Python, FastAPI, Poetry
- **Location**: `servers/fai/`
- **API**: Defined in `fern/apis/fai/`
- **SDK**: Generated at `packages/fai-sdk/`

### Docs Platform
- **Purpose**: Next.js application for rendering documentation sites
- **Stack**: Next.js 15, React 19, TypeScript
- **Location**: `packages/fern-docs/bundle/`
- **Components**: `packages/fern-docs/components/`
- **Search**: `packages/fern-docs/search-server/` (Algolia, Ask Fern)

The docs platform communicates with FDR to fetch documentation definitions and renders them dynamically.

### Dashboard
- **Purpose**: Internal dashboard for managing Fern projects
- **Stack**: Next.js 15, React 19, TypeScript, Prisma
- **Location**: `packages/fern-dashboard/`

## Deployment and Releases

### Tagging Releases
Different services use different tag formats:
- FDR: `fdr@<version>` (e.g., `fdr@1.2.3`)
- FAI SDK: `fai-sdk@*` triggers SDK publishing workflow
- Self-hosted docs: Tags trigger `publish-self-hostable-docs.yml` workflow

### CI/CD
- **CI**: `.github/workflows/ci.yml` - Runs on all branches
  - Compile, build, format checks
  - Linting (Biome, stylelint)
  - Tests (Vitest, Pytest)
  - Dependency checks
- **Preview deployments**: Vercel creates preview URLs for PRs

Access preview for a customer site:
```
https://<vercel-preview-url>/api/fern-docs/preview?host=<customer>.docs.buildwithfern.com
```

### Staging
Production URLs have staging equivalents:
```
https://vellum.docs.buildwithfern.com -> https://vellum.docs.staging.buildwithfern.com
https://docs.buildwithfern.com -> https://fern.docs.staging.buildwithfern.com
```

## Package Manager and Node Version

- **Node**: `>=22.0.0` (required)
- **Package Manager**: `pnpm 10.11.0` (enforced via `packageManager` field)
- **Preinstall hook**: Enforces pnpm usage only

## Testing Philosophy

- **Unit tests**: Located alongside source files with `.test.ts` or `.spec.ts` extensions
- **Integration tests**: `servers/fdr/src/__test__/local/` (requires Docker Compose for local DB)
- **E2E tests**: `servers/fdr/src/__test__/ete/`
- **Test framework**: Vitest for TypeScript, Pytest for Python
- **CI**: All tests run on every push in `.github/workflows/ci.yml`

## Common Workflows

### Making changes to FDR API
1. Update Fern definition in `fern/apis/fdr/`
2. Run `pnpm fern check` to validate
3. Run `pnpm fdr:generate` to regenerate SDK
4. Update server implementation in `servers/fdr/src/`
5. Run tests: `pnpm --filter=@fern-platform/fdr test`

### Making changes to docs UI
1. Work in `packages/fern-docs/bundle/src/`
2. Run dev server: `pnpm docs:dev`
3. Test locally with a docs site or use local bundle
4. Run tests: `pnpm --filter=@fern-docs/bundle test`

### Adding a new dependency
```bash
# To workspace root
pnpm add <package>

# To specific package
pnpm --filter=<package-name> add <dependency>

# After adding, check for issues
pnpm depcheck
```

## Turborepo Cache

This monorepo uses Turborepo for build caching. Key tasks defined in `turbo.json`:
- `build` - Depends on `compile`, `codegen`
- `compile` - Compiles TypeScript
- `test` - Depends on `compile`
- `docs:dev`, `docs:build` - Special tasks for docs platform

## Branch Strategy

- **Main branch**: `app` (not `main`)
- All feature branches should target `app`
- CI runs on all branches
- Deployments happen via tagged releases or merges to `app`
