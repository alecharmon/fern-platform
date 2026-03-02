# @fern-docs/bundle

Next.js application that renders Fern Docs sites.

## Setup

First-time setup requires linking with Vercel:

```bash
npm install -g vercel
vercel link --project prod.ferndocs.com
vercel pull
cp .vercel/.env.development.local packages/fern-docs/bundle/.env.local
```

Set `NEXT_PUBLIC_DOCS_DOMAIN` in `.env.local` to test with a specific domain.

See [CONTRIBUTING.md](../../../CONTRIBUTING.md) for more details.

## Development Commands

### Development Server

```bash
pnpm docs:dev          # Run docs dev server (localhost:3000)
pnpm turbo docs:dev    # Run with turbo
```

### Building

```bash
pnpm docs:build                    # Production build
pnpm docs:local-bundle:build       # Build local bundle
pnpm docs:local-bundle:deploy      # Deploy bundle to ~/.fern/app-preview-local/
```

### Local Bundle

To use the Fern CLI with a local bundle:

```bash
fern docs dev --bundle-path ~/.fern/app-preview-local/.next
```

### Self-Hosted Builds

```bash
pnpm docs:self-hosted-bundle:build
```

## Key Features
- Dynamic documentation rendering
- API reference generation
- MDX support for rich content
- Multi-version documentation
- Search (Algolia + AI)
- Dark/light theme support
- Code snippet generation
- Interactive API playground

## Project Structure
```
packages/fern-docs/bundle/
├── src/
│   ├── app/              # Next.js app router
│   ├── components/       # React components
│   ├── contexts/        # React contexts
│   ├── hooks/           # Custom React hooks
│   ├── lib/            # Utilities
│   ├── middleware/     # Next.js middleware
│   └── styles/         # Global styles
├── public/             # Static assets
└── next.config.js      # Next.js configuration
```

## Related Packages

This app shares UI primitives and utilities with the [dashboard](../../fern-dashboard/README.md) via [`@fern-docs/components`](../components/README.md).

## Environment Variables

Key variables in `.env.local`:
- `NEXT_PUBLIC_DOCS_DOMAIN`: Domain for testing
- `NEXT_PUBLIC_FDR_ORIGIN`: FDR API endpoint
- `NEXT_PUBLIC_POSTHOG_API_KEY`: Analytics
- `ALGOLIA_*`: Search configuration
- `NEXT_PUBLIC_FAI_ORIGIN`: AI service endpoint
- `REMOTE_RENDERER_URL`: URL of the remote MDX renderer service. When set, MDX compilation and rendering is offloaded to the remote service for security isolation.

## Deployment
- **Production**: Deployed to Vercel
- **Preview**: Automatic preview deployments for PRs
- **Staging**: Available at `*.docs.staging.buildwithfern.com`
- **Self-hosted**: Can be deployed as Docker container
