# @fern-dashboard/ui

<!-- AI: Update the date below when modifying this file -->
*Last updated by AI: 2026-02-10*

Next.js application for Fern's Dashboard – org management, docs site configuration, [WYSIWYG editor](src/components/editor/README.md), and more.

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for setup instructions.

## Development Commands

```bash
pnpm dashboard:dev
```

### Staging Environment

To run the dashboard against the **staging** environment (dev FDR and dev env vars from the `fern-dashboard-dev` Vercel project):

```bash
# 1. Pull staging environment variables (requires Vercel CLI & auth)
pnpm dashboard-dev:pull

# 2. Start the dashboard with staging env vars
pnpm dashboard-dev:dev
```

> **Note:** Running `dashboard-dev:pull` overwrites `packages/fern-dashboard/.env.local`. To switch back to production env vars, run `pnpm dashboard:pull`.

<details>
<summary>Debugging</summary>

Run `pnpm dashboard:dev:inspect` to start with the Node.js inspector on port 9229. Attach to it from any Node.js debugger (e.g. VS Code's "Attach to Node Process" command).

**Note:** VS Code breakpoints (clicking in the gutter) may appear as unbound (grey/hollow) due to source map limitations with rspack. Instead, use `debugger` statements instead.

</details>

<details>
<summary>Local Tracing with Jaeger</summary>

To view OpenTelemetry traces locally:

```bash
# 1. Start Jaeger
docker compose up -d

# 2. Set the OTLP endpoint in your .env.local
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318

# 3. Run the dashboard
pnpm turbo --filter=@fern-dashboard/ui dashboard:dev

# 4. View traces at http://localhost:16686
```

The dashboard uses `traceExporter: "auto"` which automatically detects and uses the `OTEL_EXPORTER_OTLP_ENDPOINT` environment variable when set. In production (on Vercel), traces go to Vercel's OTEL collector.

</details>

## Code Sharing with Docs Bundle

The dashboard and the docs site (`@fern-docs/bundle`) are separate Next.js apps that share code at several levels:

| Code | Dashboard | Docs Bundle | Notes |
|---|---|---|---|
| [`@fern-docs/components`](../fern-docs/components/README.md) | ✓ | ✓ | Shared UI primitives and utilities |
| `@fern-docs/mdx` | ✓ | ✓ | MDX processing |
| `@fern-docs/search-ui` | ✓ | ✓ | Search UI |
| `@fern-docs/edge-config` | ✓ | ✓ | Edge config |
| `@fern-api/fdr-sdk` | ✓ | ✓ | FDR SDK |
| [`components/navigation`](../fern-docs/components/README.md#navigation-module) | ✓ | — | Editor-only state management (`NavigationStore`) – defined in `@fern-docs/components` but only the dashboard imports it |
| [Docs rendering](src/docs/README.md) | fork | source | Dashboard forks a subset of bundle rendering code for usage as Client Components |
| [API ref type definitions](../fern-docs/components/README.md#parallel-implementation-pattern) | parallel impl | parallel impl | Both apps implement their own versions |
