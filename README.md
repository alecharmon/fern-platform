# :herb: Fern Platform

This monorepo contains Fern's documentation platform and related services. It uses pnpm workspaces and Turbo for monorepo orchestration.

## Development Commands

### Building and Compiling

```bash
pnpm install
pnpm compile           # Compile TypeScript packages
pnpm build             # Build all packages (runs compile + codegen)
pnpm turbo compile     # Use turbo to compile with caching
pnpm codegen           # Run codegen (Prisma, etc.)
```

### Linting and Formatting

```bash
pnpm lint              # Run all linters (biome + eslint + style + format check)
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

## API Definitions

All API Definitions should be defined in Fern. These definitions will be
documented in our [internal documentation website](https://fern-internal.docs.buildwithfern.com/).

To check your API Definitions run `pnpm fern check`. All Fern commands
should be prefixed with `pnpm` since our fern dependency is managed
by our workspace root.

> Note: To upgrade fern run `pnpm upgrade fern-api`.

## Services

### FDR (Fern Definition Registry)

FDR is the backend for Fern's docs product and provides an API to
store and retrieve API Definitions as well as docs. It's API is defined
[here](./fern/apis/fdr/).

FDR is implemented as a Node.js Express server and hosted on ECS. Any PR
that is merged to main and contains changes to FDR, will automatically
be deployed to our dev stack.

To release FDR on prod, you need to tag a release with the format "fdr@<tag>"
on this repository.

## Agent Context Files (CLAUDE.md / AGENTS.md)

### What goes in CLAUDE.md vs README.md

The `CLAUDE.md` file from the current working directory is **automatically loaded into every context window** ([source](https://claude.com/blog/using-claude-md-files): "Your CLAUDE.md file becomes part of Claude's system prompt. Every conversation starts with this context already loaded"). Other markdown files, including `README.md`, are only accessed when an agent explicitly reads them via a tool call, so they can be comprehensive.

`AGENTS.md` files contain `@CLAUDE.md`, making CLAUDE.md the single source of truth. AGENTS.md exists as a cross-tool compatibility shim so that agents from different tools all receive the same context.


| | CLAUDE.md / AGENTS.md | README.md |
|---|---|---|
| **Loaded** | Automatically, every conversation | On-demand via tool calls |
| **Content** | Essential, universally-applicable context | Package-specific references |

Some guidelines:
- **Put in CLAUDE.md**: monorepo structure, systems architecture, conventions, workflows, etc.
- **Put in README.md files**: setup guides, development commands, key files, etc.

**Important README.md files should be hyperlinked** directly from the root CLAUDE.md – this will help agents determine where to find information that might require additional tool calls.

**Avoid partial summaries in CLAUDE.md.** A bulleted feature list or concept explanation looks "complete enough" that agents stop exploring and skip the linked README — missing the architecture diagrams, file tables, and setup details that actually matter. Prefer a one-line description + link over a multi-line summary that duplicates the target.

## Contributing
See [CONTRIBUTING.md](./CONTRIBUTING.md)
