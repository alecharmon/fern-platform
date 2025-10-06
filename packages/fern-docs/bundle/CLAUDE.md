# CLAUDE.md - Fern Docs Bundle Package

## Overview
The main Next.js application that powers Fern's documentation platform. This is the core docs rendering engine that serves customer documentation sites.

## Purpose
Renders beautiful, interactive API documentation websites from Fern definitions, supporting multiple documentation formats, search, and AI-powered features.

## Tech Stack
- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS, CSS Modules
- **Search**: Algolia, Ask Fern AI
- **MDX**: For markdown content with React components

## Development

### Setup
```bash
npm install -g vercel
vercel link --project prod.ferndocs.com
vercel pull
cp .vercel/.env.development.local packages/fern-docs/bundle/.env.local
```

### Commands
```bash
# Development
pnpm docs:dev                      # Run dev server (localhost:3000)
pnpm turbo docs:dev                # Run with turbo

# Building
pnpm docs:build                    # Production build
pnpm docs:local-bundle:build       # Build local bundle
pnpm docs:local-bundle:deploy      # Deploy to ~/.fern/app-preview-local/

# Self-hosted
pnpm docs:self-hosted-bundle:build
pnpm docs:self-served-bundle:build
```

### Testing with Fern CLI
```bash
# Use local bundle with Fern CLI
fern docs dev --bundle-path ~/.fern/app-preview-local/.next
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

## Architecture Notes
- Server-side rendering for SEO
- Edge functions for auth and routing
- Fetches docs from FDR at build/runtime
- Supports multiple deployment targets (Vercel, self-hosted)
- Uses ISR (Incremental Static Regeneration)

## Environment Variables
Key variables in `.env.local`:
- `NEXT_PUBLIC_DOCS_DOMAIN`: Domain for testing
- `NEXT_PUBLIC_FDR_ORIGIN`: FDR API endpoint
- `NEXT_PUBLIC_POSTHOG_API_KEY`: Analytics
- `ALGOLIA_*`: Search configuration
- `NEXT_PUBLIC_FAI_ORIGIN`: AI service endpoint

## Deployment
- **Production**: Deployed to Vercel
- **Preview**: Automatic preview deployments for PRs
- **Staging**: Available at `*.docs.staging.buildwithfern.com`
- **Self-hosted**: Can be deployed as Docker container

## Related Packages
- `@fern-docs/components`: Shared UI components
- `@fern-docs/mdx`: MDX processing
- `@fern-platform/fdr-sdk`: API registry client
- `@fern-platform/fai-sdk`: AI features
- `@fern-platform/snippets`: Code examples