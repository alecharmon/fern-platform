# @fern-platform/supabase

Shared Supabase client and database type definitions for the Fern platform. Includes migration tracking with CI checks for both dev and prod environments.

## Projects

| Environment | Project ID | Dashboard |
|-------------|-----------|-----------|
| **Dev** | `hpgcvygnvocaluwunkwi` | [fern-dashboard-dev](https://supabase.com/dashboard/project/hpgcvygnvocaluwunkwi) |
| **Prod** | `mygothwbccfcegfpjtoh` | [fern-dashboard](https://supabase.com/dashboard/project/mygothwbccfcegfpjtoh) |

## Prerequisites

Install the [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started):

```bash
# macOS
brew install supabase/tap/supabase

# Linux (deb)
curl -L -o supabase.deb https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.deb
sudo dpkg -i supabase.deb
```

You also need Docker running for the local Supabase stack.

## Development Workflow

### 1. Start the local Supabase stack

```bash
pnpm db:start
```

This spins up a local Postgres (+ Auth, Storage, etc.) via Docker. Access Studio at http://127.0.0.1:54323.

### 2. Write and test migrations locally

Create a new migration:

```bash
# Auto-generate from schema changes made in local Studio
pnpm db:diff -f <migration_name>

# Or create an empty migration file to write manually
supabase migration new <migration_name>
```

Reset the local database to verify migrations apply cleanly:

```bash
pnpm db:reset
```

### 3. Push migrations to dev

```bash
pnpm db:push:dev
```

This links to the dev project and pushes all unapplied migrations. You'll be prompted for confirmation.

### 4. Regenerate TypeScript types

```bash
# From local database (recommended after writing migrations)
pnpm generate:types

# From remote dev
pnpm generate:types:dev

# From remote prod
pnpm generate:types:prod
```

### 5. Open a PR

CI will run two checks when migration files change (schema drift checks are commented out pending Infisical migration):

| Check | What it catches | Status |
|-------|----------------|--------|
| **Check for unapplied migrations (prod)** | Migrations in repo not yet applied to prod | Active |
| **Check for unapplied migrations (dev)** | Migrations in repo not yet applied to dev | Active |
| **Check for untracked schema changes (prod)** | Direct changes on prod without a migration | Disabled |
| **Check for untracked schema changes (dev)** | Direct changes on dev without a migration | Disabled |

### 6. Apply migrations to prod before merging

```bash
pnpm db:push:prod
```

CI will fail until prod has all migrations applied. Once applied, CI goes green and you can merge.

### 7. Stop the local stack when done

```bash
pnpm db:stop
```

## Commands Reference

| Command | Description |
|---------|-------------|
| `pnpm db:start` | Start local Supabase stack (Postgres + services) |
| `pnpm db:stop` | Stop local Supabase stack |
| `pnpm db:reset` | Drop and recreate local DB, apply all migrations |
| `pnpm db:diff` | Generate a migration from local schema changes |
| `pnpm db:push:dev` | Push migrations to dev project |
| `pnpm db:push:prod` | Push migrations to prod project |
| `pnpm db:push:prod:dry-run` | Preview what would be pushed to prod |
| `pnpm generate:types` | Regenerate TypeScript types from local DB |
| `pnpm generate:types:dev` | Regenerate types from remote dev |
| `pnpm generate:types:prod` | Regenerate types from remote prod |

## Handling Schema Drift

If someone modifies a database directly (via Supabase dashboard or SQL editor) without creating a migration, CI will detect it.

To fix:

```bash
# Link to the project with drift
supabase link --project-ref <project-id>

# Generate a migration capturing the untracked changes
supabase db diff --linked -f <descriptive_name>

# Verify it applies cleanly
pnpm db:reset
```

## Environment Variables

| Variable | Description | Used by |
|----------|-------------|---------|
| `SUPABASE_URL` | Supabase project URL | Runtime client (`client.ts`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for server-side access | Runtime client (`client.ts`) |
| `SUPABASE_ACCESS_TOKEN` | Personal access token for CLI operations | CI workflow, `db:push`, `supabase link` |

## File Structure

```
supabase-client/
  src/
    index.ts              # Package exports
    client.ts             # Singleton Supabase client
    errors.ts             # Error types and factory
    database.types.ts     # Auto-generated DB types (do not edit manually)
  supabase/
    config.toml           # Local Supabase configuration
    migrations/           # Versioned migration files
```
