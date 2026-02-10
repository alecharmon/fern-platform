# fern-platform

This monorepo contains Fern's documentation platform and related services. It uses pnpm workspaces and Turbo for monorepo orchestration.

**Key directories:**
- `packages/` - Shared libraries and UI components
  - [`fern-docs/bundle/`](packages/fern-docs/bundle/README.md) - Next.js docs UI application for rendering documentation sites
  - [`fern-docs/components/`](packages/fern-docs/components/README.md) - Shared code used by docs and dashboard
  - [`fern-dashboard/`](packages/fern-dashboard/README.md) - Next.js dashboard UI application including org management, docs site configuration, [WYSIWYG editor](packages/fern-dashboard/src/components/editor/README.md), and more
  - `commons/` - Shared utilities (docs-auth, docs-loader, docs-server, etc.)
  - `fdr-sdk/`, `fai-sdk/` - Generated SDK packages
- `servers/` - Backend services
  - [`fdr/`](servers/fdr/README.md) - Fern Definition Registry (Node.js/Express with Prisma)
  - [`fai/`](servers/fai/README.md) - Fern AI service (Python/FastAPI with Poetry)
  - `fai-discord/` - Discord bot for FAI (Python)
  - [`fern-bot/`](servers/fern-bot/README.md) - GitHub bot service
  - [`self-hosted/`](servers/self-hosted/README.md) - Self-hosted deployment utilities
- `fern/` - Fern API definitions and (internal) documentation
- `scripts/` - Build and deployment scripts

## Development Commands

```bash
pnpm install

pnpm compile          # Compile TypeScript packages
pnpm codegen          # Run codegen (Prisma, etc.)

pnpm lint             # Run all linters (biome + eslint + style + format check)
pnpm format           # Format code with Biome

pnpm test             # Run all tests (Vitest)
pnpm test:update      # Run tests and update snapshots

# Run tests for specific service
pnpm --filter=@fern-platform/fdr test
pnpm --filter=@fern-platform/fdr test:local  # FDR tests against local DB
```

See [README.md](README.md) for complete monorepo setup and commands.

### Docs UI (Next.js)

See [packages/fern-docs/bundle/README.md](packages/fern-docs/bundle/README.md) for setup and commands.

### Dashboard UI (Next.js)

See [packages/fern-dashboard/README.md](packages/fern-dashboard/README.md) for setup and commands.

### FDR Server (Node.js/Express)

See [servers/fdr/README.md](servers/fdr/README.md) for setup and commands.

### FAI Server (Python/FastAPI)

See [servers/fai/README.md](servers/fai/README.md) for setup and commands.

## Key Services

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
- **Package Manager**: `pnpm 10.27.0` (enforced via `packageManager` field)
- **Preinstall hook**: Enforces pnpm usage only

## Testing Philosophy

- **Unit tests**: Located alongside source files with `.test.ts` or `.spec.ts` extensions
- **Integration tests**: `servers/fdr/src/__test__/local/` (requires Docker Compose for local DB)
- **E2E tests**: `servers/fdr/src/__test__/ete/`
- **Test framework**: Vitest for TypeScript, Pytest for Python
- **CI**: All tests run on every push in `.github/workflows/ci.yml`
- **Fixture Testing**: Always include test fixtures to validate your changes (see "Testing Changes with Fixtures" section below)

## Testing Changes with Fixtures

**IMPORTANT**: Always include test fixtures to validate your changes. This is a critical requirement for all code changes in this repository.

### When to Add/Update Test Fixtures

You must include test fixtures when:
- **Adding new API endpoints**: Create test cases in the appropriate test directory (e.g., `servers/fdr/src/__test__/`)
- **Modifying FDR API**: Add integration tests that exercise the new/changed functionality
- **Changing docs rendering**: Create test documentation sites or MDX fixtures to verify rendering
- **Updating FAI features**: Add test cases with sample queries and expected responses
- **Fixing bugs**: Add a test that reproduces the bug and verifies the fix
- **Changing database schema**: Add migration tests and data fixtures

### How to Test with Fixtures

**For FDR Server Changes:**
```bash
# 1. Add test fixtures in servers/fdr/src/__test__/
# Example: servers/fdr/src/__test__/local/my-feature.test.ts

# 2. Run unit tests
pnpm --filter=@fern-platform/fdr test

# 3. Run integration tests (requires Docker)
pnpm --filter=@fern-platform/fdr test:local

# 4. Verify changes work as expected
```

**For Docs UI Changes:**
```bash
# 1. Create test MDX files or documentation fixtures
# Example: packages/fern-docs/bundle/src/__test__/fixtures/

# 2. Run dev server to test manually
pnpm docs:dev

# 3. Run automated tests
pnpm --filter=@fern-docs/bundle test

# 4. Test with a real docs site using local bundle
pnpm docs:local-bundle:build
pnpm docs:local-bundle:deploy
fern docs dev --bundle-path ~/.fern/app-preview-local/.next
```

**For FAI Service Changes:**
```bash
# 1. Add test fixtures in servers/fai/tests/
# Example: servers/fai/tests/test_my_feature.py

# 2. Run tests
cd servers/fai
poetry run pytest -sv

# 3. Test manually with local FAI server
pnpm fai:dev
```

**For API Definition Changes:**
```bash
# 1. Update Fern definition in fern/apis/fdr/ or fern/apis/fai/

# 2. Validate the definition
pnpm fern check

# 3. Regenerate SDK
pnpm fdr:generate  # or pnpm fai:generate

# 4. Add tests that use the new SDK features
# Example: packages/fdr-sdk/__test__/my-feature.test.ts

# 5. Run tests
pnpm test
```

### Best Practices

- **Test locally first**: Always run tests locally before pushing to ensure your changes work
- **Use appropriate test types**: Unit tests for isolated logic, integration tests for service interactions, E2E tests for full workflows
- **Create realistic fixtures**: Use realistic data that represents actual use cases
- **Test edge cases**: Include fixtures for error conditions, boundary cases, and unusual inputs
- **Document test fixtures**: Add comments explaining what each test fixture validates
- **Keep tests focused**: Each test should validate a specific behavior or scenario
- **Run full test suite**: Before creating a PR, run `pnpm test` to ensure nothing breaks

### Common Testing Patterns

**Testing a new FDR endpoint:**
```typescript
// servers/fdr/src/__test__/local/my-endpoint.test.ts
import { describe, it, expect } from 'vitest';
import { FdrClient } from '@fern-api/fdr-sdk';

describe('My New Endpoint', () => {
  it('should handle valid requests', async () => {
    const client = new FdrClient({ ... });
    const result = await client.myEndpoint({ ... });
    expect(result).toMatchObject({ ... });
  });

  it('should handle error cases', async () => {
    // Test error handling
  });
});
```

**Testing docs rendering:**
```typescript
// packages/fern-docs/bundle/src/__test__/my-feature.test.ts
import { describe, it, expect } from 'vitest';
import { serializeMdx } from '../mdx/bundler/serialize';

describe('My Docs Feature', () => {
  it('should render custom component correctly', async () => {
    const mdx = '# Test\n<CustomComponent prop="value" />';
    const result = await serializeMdx(mdx);
    expect(result).toContain('expected-output');
  });
});
```

**Testing FAI functionality:**
```python
# servers/fai/tests/test_my_feature.py
import pytest
from fai.routes.my_feature import my_function

def test_my_feature():
    """Test that my feature works correctly."""
    result = my_function(input_data)
    assert result == expected_output

def test_my_feature_error_handling():
    """Test error handling in my feature."""
    with pytest.raises(ValueError):
        my_function(invalid_input)
```

### Verifying Changes

Before committing, always:
1. Run relevant tests: `pnpm test` or `pnpm --filter=<package> test`
2. Check for type errors: `pnpm compile`
3. Run linting: `pnpm lint`
4. Test manually if applicable (run dev server, test with real data)
5. Review test output to ensure all tests pass
6. Commit both source changes and test fixtures together

## Common Workflows

### Making changes to FDR API
1. Update Fern definition in `fern/apis/fdr/`
2. Run `pnpm fern check` to validate
3. Run `pnpm fdr:generate` to regenerate SDK
4. Update server implementation in `servers/fdr/src/`
5. **Add test fixtures** in `servers/fdr/src/__test__/`
6. Run tests: `pnpm --filter=@fern-platform/fdr test`

### Making changes to docs UI
1. Work in `packages/fern-docs/bundle/src/`
2. Run dev server: `pnpm docs:dev`
3. **Add test fixtures** for new components or rendering logic
4. Test locally with a docs site or use local bundle
5. Run tests: `pnpm --filter=@fern-docs/bundle test`

### Making changes to dashboard/editor
1. Work in `packages/fern-dashboard/src/` (see [Dashboard README](packages/fern-dashboard/README.md))
2. For editor changes, see [Editor README](packages/fern-dashboard/src/components/editor/README.md) for architecture and RSC serialization details
3. Run dev server: `pnpm dashboard:dev`
4. **Add test fixtures** for new components or rendering logic
5. Run tests: `pnpm --filter=@fern-dashboard/ui test`

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
- `dashboard:dev` - Dashboard platform

## Branch Strategy

- **Main branch**: `app` (not `main`)
- All feature branches should target `app`
- CI runs on all branches
- Deployments happen via tagged releases or merges to `app`

## Pull Request Guidelines

When creating pull requests in this repository:

1. **PR Title**: Must follow semantic commit message rules with format `<action>(<realm>): <description>` where:
   - `<action>` is one of: `chore`, `devex`, `feat`, `fix`, `ui`
   - `<realm>` is one of: `fdr`, `dashboard`, `ask-fern`, `editor`, `docs`
2. **Assignee**: Always assign the person who prompted you to create the PR as the assignee
3. **Description**: Follow the PR template in `.github/pull_request_template.md`
4. **Testing**: Ensure all tests pass before marking PR as ready for review
