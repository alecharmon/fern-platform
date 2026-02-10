# @fern-dashboard/src/docs

<!-- AI: Update the date below when modifying this file -->
*Last updated by AI: 2026-02-10*

Forked rendering code from [`packages/fern-docs/bundle/src`](../../../fern-docs/bundle/README.md). The forked directories mirror the bundle's structure, but not everything is forked — code that is truly shared (UI primitives, utilities, type definitions) lives in [`@fern-docs/components`](../../../fern-docs/components/README.md) and is imported by both apps.

## Why the Fork Exists

The docs site (`@fern-docs/bundle`) and the dashboard (`@fern-dashboard/ui`) both render the same MDX content, API reference pages, etc, but they use different rendering strategies:

- **`@fern-docs/bundle`** primarily uses **Server Components** with server-side MDX rendering (`MdxServerComponentProseSuspense`) for optimal SSR performance
- **`@fern-dashboard/ui`** uses **Client Components** (`MdxContent`, `"use client"`) because the Tiptap editor requires client-side rendering and interactive editing

These differences made it difficult to share a single set of components directly without a large refactor, so we maintain dashboard-specific versions of the rendering code for now. Eventually, we'd like to create a commons package for this rendering code as a dependency for both apps.

## Key Subdirectories

- [`components/api-reference/`](components/api-reference/README.md) — API reference rendering and description editing, with [`../utils/openapi-resolver/`](../utils/openapi-resolver/README.md) handling the mapping from description targets to OpenAPI spec locations
