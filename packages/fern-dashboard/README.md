# Set up

```bash
pnpm install
npm install -g vercel

cd packages/fern-dashboard

# to dev against dev environment
vercel link # link to fern-dashboard-dev
vercel env pull .env.local
pnpm turbo --filter=@fern-dashboard/ui dashboard:dev

# to dev against prodenvironment
vercel link # link to fern-dashboard
vercel env pull .env.local
pnpm turbo --filter=@fern-dashboard/ui dashboard:dev
```

## Debugging

To debug the dashboard with Node.js inspector:

```bash
# From repo root
pnpm dashboard:dev:inspect

# Or from this directory
pnpm dashboard:dev:inspect
```

This starts the dev server with the Node.js debugger listening on port 9229.

### Attaching VS Code

1. Start the dashboard with `pnpm dashboard:dev:inspect`
2. Wait for the server to be ready (you should see "Debugger listening on ws://127.0.0.1:9229/...")
3. In VS Code, open the Debug panel and select "Next.js: attach to server"
4. Press F5 to attach

### Setting Breakpoints

**Note:** VS Code breakpoints (clicking in the gutter) may appear as unbound (grey/hollow) due to source map limitations with rspack. Instead, use `debugger` statements directly in your code:

```typescript
function myFunction() {
  debugger; // Execution will pause here when debugger is attached
  // ... rest of your code
}
```

The `debugger` statement will pause execution when the Node.js inspector is attached.

## Local Tracing with Jaeger

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

## Components library

We're using [shadcn](https://ui.shadcn.com/) for our components. To add a
component, go to the shadcn component page and run the `Installation` command:

````
pnpm dlx shadcn@latest add <component>
```
````
