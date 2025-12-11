# Contributing

Thanks for being here! Fern gives a lot of importance to being a community project, and we rely on your help as much as you rely on ours. If you have any feedback on what we could improve, please [open an issue](https://github.com/fern-api/fern/issues/new) to discuss it!

## Local development

Our repo uses [pnpm](https://pnpm.io/) to manage dependencies.

To get started:

**Step 1: Clone this repo**

```
git clone <...>
cd fern-platform
code .
```

**Step 2: Install dependencies**

```
pnpm install
```

(If pnpm is not installed, installing specific version `10.11.0` is recommended using `curl -fsSL https://get.pnpm.io/install.sh | env PNPM_VERSION=10.11.0 sh -`)

### Compiling

To compile the packages in this monorepo, run `pnpm compile`.

### Tests

This repo contains both unit tests and integration (end-to-end) tests.

To run the unit tests: `pnpm test`.

#### Important: Always Include Test Fixtures

**When contributing code changes, you must always include test fixtures to validate your changes.** This is a critical requirement for maintaining code quality and preventing regressions.

**When to add/update test fixtures:**
- Adding new API endpoints → Create test cases in `servers/fdr/src/__test__/` or `servers/fai/tests/`
- Modifying FDR/FAI APIs → Add integration tests that exercise the new/changed functionality
- Changing docs rendering → Create test MDX files or documentation fixtures
- Fixing bugs → Add a test that reproduces the bug and verifies the fix
- Changing database schema → Add migration tests and data fixtures

**Example workflow for FDR changes:**
```bash
# 1. Add test fixtures
# Example: servers/fdr/src/__test__/local/my-feature.test.ts

# 2. Run tests
pnpm --filter=@fern-platform/fdr test

# 3. For integration tests (requires Docker)
pnpm --filter=@fern-platform/fdr test:local

# 4. Commit both source and test changes
git add servers/fdr/src/
git add servers/fdr/src/__test__/
git commit -m "feat(fdr): add new feature with tests"
```

**Example workflow for docs UI changes:**
```bash
# 1. Create test fixtures
# Example: packages/fern-docs/bundle/src/__test__/my-feature.test.ts

# 2. Run dev server to test manually
pnpm docs:dev

# 3. Run automated tests
pnpm --filter=@fern-docs/bundle test

# 4. Commit changes
git add packages/fern-docs/bundle/
git commit -m "feat(docs): add new feature with tests"
```

For more detailed guidance on fixture testing, see the "Testing Changes with Fixtures" section in [CLAUDE.md](./CLAUDE.md).

### Lint/formatting

This repo uses [Biome](https://biomejs.dev) for linting and formatting.
- Check for lint issues: `pnpm lint:biome`
- Check for format issue: `pnpm format:check`
- Auto-format: `pnpm format`

### Docs UI

To build and run the NextJS docs UI, first make sure vercel is installed:

- `npm install -g vercel`

From the fern-platform repository, link vercel to the Fern project:

- `vercel link --project prod.ferndocs.com`
- When prompted to setup the project, say `yes`
- When prompted what scope should contain the project, say `fern`
- When prompted to link to the project, say `yes`

Then, run `vercel pull`, which will create `/fern-platform/.vercel/.env.development.local`
Then, copy that file (creating if necessary) to `/fern-platform/packages/fern-docs/bundle/.env.local`
Finally, to run the dev server, `cd packages/fern-docs/bundle` and run `pnpm docs:dev`, which should begin running on `localhost:3000`

To set a dev docs domain, add a `NEXT_PUBLIC_DOCS_DOMAIN` to `.env.local`. For instance:

- `NEXT_PUBLIC_DOCS_DOMAIN=customer.docs.buildwithfern.com`

Finally, run `pnpm docs:dev`. This compiles and runs a NextJS app that communicates with our cloud production environment.

### Dashboard UI

Follow a similar set of steps as for setting up the docs UI above:

- `vercel pull` from the `packages/fern-dashboard` directory, which will create `packages/fern-dashboard/.vercel/.env.development.local`
- Then, copy that file (creating if necessary) to `packages/fern-dashboard/.env.local`
- Finally, to run the dev server, run `pnpm turbo --filter=@fern-dashboard/ui dashboard:dev`

## Testing in Staging

### PR previews

After pushing a commit to a PR, vercel will automatically generate a preview URL for that PR, i.e.

```
fern-prod-it1bn6vh9-buildwithfern.vercel.app
```

To access the preview for a given customer site, use the following pattern:

```
https://fern-prod-it1bn6vh9-buildwithfern.vercel.app/api/fern-docs/preview?host=proficientai.docs.buildwithfern.com
```

### Before deploying

Before cutting a release from `main`, we test our changes in a staging environment. All production URLs have a secret staging URL:

```
https://vellum.docs.buildwithfern.com -> https://vellum.docs.staging.buildwithfern.com
https://docs.buildwithfern.com -> https://fern.docs.staging.buildwithfern.com
https://documentation.sayari.com -> https://sayari.docs.staging.buildwithfern.com
```

## Docs Local Testing

To test the docs bundle locally, you'll need to

- Build the bundle locally
- Point the fern cli to your local bundle

To simplify this process, use the following scripts:

```bash
pnpm docs:local-bundle:build  # Builds the bundle locally and puts it in a zip file at the repo root called docs_bundle.tar.gz
pnpm docs:local-bundle:deploy  # Unzips the bundle into ~/.fern/app-preview-local/.next, and runs setup steps

# You can then use the local bundle by running
fern docs dev --bundle-path ~/.fern/app-preview-local/.next
```
