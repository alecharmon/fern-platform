# MDX Remote Renderer

Sandboxed MDX compilation and rendering service for Fern documentation.

## Overview

The MDX Remote Renderer is a standalone Next.js application that safely renders MDX content in an isolated environment with no access to sensitive environment variables.

**Security Model**: User-provided MDX is potentially untrusted code. By executing compilation, evaluation, and rendering in a separate service, we protect the main bundle application from:
- Malicious code injection via MDX compilation (esbuild)
- Information disclosure via `new Function()` metadata extraction
- XSS attacks via SSR rendering

## Architecture

### How It Works

```
Bundle (Main App)
  │
  ├─ User visits /docs/my-page or /api-reference/endpoint
  │
  ├─ API Pages: Two-Phase Approach
  │   │
  │   ├─ Phase 1 (Before Render): Batch Cache
  │   │   serializeApiDescriptionsWithBatchCache(types, slug)
  │   │     ├─ Split types into chunks of 30
  │   │     ├─ Each chunk: unstable_cache check
  │   │     ├─ Cache miss: serialize 30 types → remote renderer
  │   │     ├─ Cache hit: return instantly (0ms, no HTTP)
  │   │     └─ Returns: Record<TypeId, SerializedType>
  │   │
  │   └─ Phase 2 (During Render): Per-Item Cache
  │       <MdxServerComponentProseSuspense mdx={endpoint.description} />
  │         └─ serialize(endpoint.description) → per-item cache → remote renderer
  │
  ├─ Docs/Changelog Pages: Per-Item Cache Only
  │   SharedPage collects all serialize() calls during React render
  │   ├─ Main content: serialize(pageMarkdown)
  │   └─ Changelog: serialize(entry1), serialize(entry2), ...
  │
  ├─ Multiple Serializer Instances:
  │   - Page content serializers (from shared-page.tsx):
  │     - React.cache() creates separate instances per useNextMdx value
  │     - useNextMdx=false (mdx-bundler) and useNextMdx=true (next-mdx-remote)
  │   - API description serializer (from serialize-description.ts)
  │   - Each serializer has its own queue[] and scheduled flag
  │   - Each batches independently → 2-3 HTTP requests per page
  │
  ├─ Batching (via setTimeout(0)):
  │   - 500 serialize() calls → 200 unique items (deduplication)
  │   - Queued in memory during async operations
  │   - setTimeout(0) creates batching window for parallel operations
  │   - Each serializer instance flushes independently
  │
  ├─ Cross-Request Cache Check (unstable_cache):
  │   - Cache key: [domain, content, options, cacheSeed()]
  │   - On cache hit: Return instantly (0ms, no HTTP call)
  │   - On cache miss: Continue to remote renderer
  │
  ├─ 2-3 HTTP POST /api/batch-serialize requests per page
  │   (Each serializer instance batches independently)
  │   {
  │     items: [
  │       { key: "hash1", content: "# Page", options: {...} },
  │       { key: "hash2", content: "Type description", options: {...} }
  │     ],
  │     loaderContext: {
  │       domain, edgeFlags, authState, metadata, language,
  │       files, mdxBundlerFiles, config, theme, layout, root,
  │       rootSlug, versionSlug, slugMap, useNextMdx
  │     }
  │   }
  │
  └─────────────────────────────────────────────────────────────
 
Remote Renderer (Sandboxed Service)
  │
  ├─ Receives batch of 200 items
  │
  ├─ Semaphore limits concurrent processing (20 at a time)
  │
  ├─ For each item:
  │   │
  │   ├─ Phase 1: Compile MDX (Vector 1)
  │   │   - serializeMdx(content, options)
  │   │   - Returns { code, jsxElements, engine }
  │   │
  │   ├─ Phase 2: Extract metadata (Vector 2)
  │   │   - getMDXExport(code) — executes compiled code via new Function()
  │   │   - Extracts: toc, frontmatter, Aside component
  │   │   - Safe: no env vars to exfiltrate
  │   │
  │   └─ Phase 3: Render to HTML (Vector 3)
  │       - renderToString(<Component />) with Next.js context providers
  │       - Returns: _contentHtml, _remoteMetadata
  │       - Safe: no env vars to exfiltrate
  │
  ├─ Returns results map: { hash1: result1, hash2: result2, ... }
  │
  └─────────────────────────────────────────────────────────────
 
Bundle (Main App)
  │
  ├─ Receives 200 results
  │
  ├─ Caches all results in unstable_cache (Next.js data cache)
  │
  ├─ Resolves all 500 serialize() promises with deduplicated results
  │
  └─ Continues rendering with pre-rendered HTML
      - MdxContent uses _contentHtml → RemoteMdxHydrator (no server-side new Function())
      - LayoutEvaluator uses _remoteMetadata (no getMDXExport on bundle)
      - API pages use _contentHtml for type descriptions
```

## Performance Optimizations

### Lazy Slots
API type definitions store render instructions (data) instead of pre-rendered JSX in the slots context. Types render on-demand when the user expands collapsed sections. For API pages with many types (like VAPI with 900+ type definitions), this eliminates ~1,000 JSX tree serializations during SSR.

**Implementation**:
- `TypeDefinitionSlotsServer` stores `SlotData` (shape + types + lang) instead of JSX when remote rendering enabled
- `TypeDefinitionSlot` (bundle-specific client component) renders `TypeReferenceDefinitions` on-demand
- `isSlotData()` discriminator distinguishes data vs legacy JSX slots

**Impact**: Reduces SSR from rendering 900+ components to ~20-50 top-level properties for complex APIs

**Referenced Type Descriptions**: When a property/variant has no description of its own but
inherits one from a referenced type (e.g., finish_reason referencing an enum), ObjectProperty and DiscriminatedUnionVariant resolve serializedDescription
from the referenced TypeDefinition via unwrapped.visitedTypeIds. Without this, descriptions from referenced types render as raw
markdown in the lazy slots client context (where getMdxSerializer() is unavailable).

### Batch Caching (API Descriptions)
Type descriptions cached in chunks of 30 instead of individually. Two-level caching strategy:

**High-Level (API Descriptions)**:
- **File**: `bundle/src/server/remote-renderer/batch-cache-api-descriptions.ts`
- **Strategy**: Split types into chunks of 30, cache each chunk with `unstable_cache`
- **Cache Key**: `api-desc:{hash}:chunk{N}` where hash = SHA-256(type IDs + descriptions)
- **Tags**: `[slug, "api-descriptions"]`
- **TTL**: 900 seconds (15 min)
- **Self-Healing**: If any chunk expires, only that chunk re-serializes
- **Impact**: 94% reduction in cache operations (352 → 20 lookups) for large APIs

**Low-Level (Everything Else)**:
- **File**: `bundle/src/server/remote-renderer/batch-serializer.ts`
- **Strategy**: Per-item `unstable_cache` wrapping setTimeout(0) batching
- **Scope**: Page content, endpoint descriptions, changelog entries
- **Cache Key**: `[domain, content, cacheSeed()]` + options
- **Tags**: `[${domain}:mdx, "serializeMdx"]`

The two layers coexist without conflicts — batch cache prevents most per-item cache lookups for API pages, while per-item cache handles docs pages efficiently.

### Batching
- **Per-serializer batching**: Each serializer instance maintains its own queue
  - Page content: React.cache() ensures single instance per `useNextMdx` value per request
  - API descriptions: Module-level cache() ensures single instance per request
- **Batching window** (API descriptions only): Uses `setTimeout(0)` to create batching window
  - API descriptions serialize in parallel via `Promise.all()`, need event loop window
  - Allows parallel operations to queue before flush
  - Without this, each description would flush individually
- **Result**: 2-3 HTTP requests per page (one per serializer instance)
  - Each batch combines many calls (e.g., 50+ type descriptions in one batch)

### Deduplication
- Hashes content + options to identify duplicate items
- Typical deduplication: hundreds of calls → fewer unique items (common for API pages with shared type descriptions)

### Cross-Request Caching
- Next.js `unstable_cache` wraps batching logic
- Cache key: `[domain, content, options, cacheSeed()]`
- Second request returns instantly without HTTP call

### Plain Text Short-Circuit
- Regex check skips MDX compilation for simple text like `"Logs user into the system."`
- Many API type descriptions are plain text and benefit from this optimization

### Semaphore (Remote)
- Limits concurrent MDX compilations to 20 on remote renderer
- Prevents memory spikes from simultaneous esbuild processes

### React.cache() Singleton
- Ensures single serializer instance per request
- All `serializeDescription()` calls share same queue and batch together

## Error Handling
### Partial Batch Failures
The endpoint uses Promise.allSettled for batch processing:

If one item fails to compile/render, only that item returns null

All other items in the batch succeed normally

Failed items are logged with their key for debugging

### Fallback Behavior
If the remote renderer is unreachable, the batch serializer throws and the page fails to render

To disable remote rendering and fall back to local rendering: set USE_REMOTE_RENDERING=false

No code changes needed — the bundle automatically uses createCachedMdxSerializer instead

## API Endpoints

### `POST /api/batch-serialize`
Batch MDX compilation, evaluation, and rendering endpoint.

**Request**:
```typescript
{
  items: Array<{
    key: string,           // Hash of content + options
    content: string,       // MDX source code
    options: {
      filename?: string,
      toc?: boolean,
      scope?: Record<string, unknown>,
      slug?: string,
      pathname?: string    // For usePathname() during SSR
    }
  }>,
  loaderContext: {
    domain: string,
    edgeFlags: EdgeFlags,
    authState: AuthState,     // Used for scope.authed in MDX conditionals, not for API auth
    metadata: DocsMetadata,
    language: string,
    files: Record<string, FileData>,
    mdxBundlerFiles: Record<string, string>,
    config?: any,
    theme?: any,
    layout?: any,
    root?: any,
    rootSlug?: Slug,          // For replaceHref link rewriting
    versionSlug?: Slug,       // For versioned link rewriting
    slugMap?: Array<[string, { slug: Slug }]>,  // Navigation slug map for link resolution
    useNextMdx?: boolean      // Toggle next-mdx-remote vs mdx-bundler engine
  }
}
```

**Response**:
```typescript
Record<string, {
  code: string,                    // Compiled JavaScript
  frontmatter?: Frontmatter,       // Extracted frontmatter
  jsxElements: string[],           // JSX component names
  engine: "esbuild" | "next-remote" | "plaintext",
  styles?: string[],               // CSS modules
  _contentHtml: string,            // Pre-rendered HTML (Vector 3)
  _remoteMetadata: {               // Pre-computed metadata (Vector 2)
    toc: TableOfContentsItem[],
    frontmatter: Record<string, unknown>,
    hasAside: boolean,
    asideHtml?: string
  }
} | null>
```

**Phases**:
1. **Semaphore Acquire**: Limit concurrent processing
2. **Vector 1**: Compile MDX via `serializeMdx(content, options)`
3. **Vector 2**: Extract metadata via `getMDXExport(code)`
4. **Vector 3**: Render HTML via `renderToString(<Component />)`
5. **Semaphore Release**: Free slot for next item

### `GET /api/health`
Health check endpoint for monitoring.

**Response**:
```json
{
  "status": "ok",
  "service": "mdx-remote-renderer",
  "timestamp": "2026-02-25T12:34:56.789Z"
}
```

## Configuration

### Bundle Environment Variables

```bash
# Remote renderer URL (required for remote rendering)
REMOTE_RENDERER_URL=http://localhost:3005

# Feature flag (opt-in security model)
USE_REMOTE_RENDERING=true

# Optional: Enable detailed per-item debug logs
NEXT_PUBLIC_DEBUG_REMOTE_RENDERER=true
```

**Behavior**:
- If `REMOTE_RENDERER_URL` not set → Falls back to local rendering
- If `USE_REMOTE_RENDERING` not `"true"` → Falls back to local rendering
- Otherwise → Uses remote batch serialization
- If `NEXT_PUBLIC_DEBUG_REMOTE_RENDERER=true` → Shows per-item cache/batching logs (noisy, debug only)

### Shadow Mode

Shadow mode fires-and-forgets the same serialize requests to a remote renderer while using local rendering as the primary path. The shadow response is discarded — only errors are logged. This allows detecting remote rendering bugs on real production traffic without any user impact.

Shadow mode is **automatically enabled** for all Vercel deployments when the rendering mode is "disabled" (i.e., `USE_REMOTE_RENDERING` is not set to `"true"`). No additional environment variables are needed.

| Environment | Shadow target | Batch serialize path |
|---|---|---|
| Production (`VERCEL_ENV=production`) | True remote renderer (`REMOTE_RENDERER_URL`) | `/api/batch-serialize` |
| Preview/dev Vercel projects | Local remote builder (self-referencing URL) | `/api/fern-docs/remote-mdx/batch-serialize` |
| Local development | Off | — |

**How it works**:
1. Request hits `SharedPage` or `AnnouncementPage` → `useRemoteMDXRendering()` evaluates once
2. If mode is `"disabled"` and the deployment is on Vercel (production or preview/dev) → `shadow: true`
3. The local serializer is wrapped with `withShadowRemoteSerializer`, which:
   - Returns the local result immediately (zero latency impact)
   - Queues a shadow call to the remote renderer via the existing batching infra
   - Shadow calls batch naturally via `setTimeout(0)` into one HTTP request
   - Shadow response is discarded; errors logged as `[shadow-remote]` warnings
4. Shadow logs use `[RemoteBatchSerializer:SHADOW]` prefix to distinguish from primary traffic

**Coverage**: Shadow mode covers `shared-page.tsx` (main page rendering) and `AnnouncementPage` (announcement banner). API description serialization is not shadowed.

**Note on serverless**: Shadow requests are fire-and-forget promises. In Vercel serverless functions, the function may terminate after sending the response, so shadow requests may not always complete. This is acceptable since shadow is purely for error detection.

### Remote Renderer Environment Variables

**Required**: None! The remote renderer has **zero required environment variables** - this is the core security feature.

**Optional**:
- `NEXT_PUBLIC_DEBUG_REMOTE_RENDERER`: Set to `"true"` to enable detailed per-item debug logs on both bundle and remote renderer. Default: off. Use for debugging cache behavior, batching, and individual MDX compilation. Production should leave this off to avoid log spam (pages with many items would produce hundreds of log lines).

## Webpack Configuration

### Bundle Imports
The remote renderer imports bundle components using webpack aliases:

```typescript
// next.config.ts
config.resolve.alias = {
  "@bundle": path.resolve(__dirname, "../bundle/src"),
  // node: protocol aliases...
};
```

**Usage**:
```typescript
// @ts-expect-error - Webpack resolves @bundle/* at runtime
import { serializeMdx } from "@bundle/mdx/bundler/serialize";
```

### Directive Stripping
Strips `"server-only"` imports to allow bundle code in API routes:

```typescript
config.module.rules.push({
  test: /\.(ts|tsx|js)$/,
  include: [
    path.resolve(__dirname, "../bundle/src"),
    path.resolve(__dirname, "../../commons")
  ],
  use: [{
    loader: "string-replace-loader",
    options: {
      search: 'import "server-only";',
      replace: "// server-only import removed by webpack",
      flags: "g"
    }
  }]
});
```
Why: Bundle code uses "server-only" to prevent client imports, and "use client" for React client components. Pages Router API routes are server-only by definition and don't enforce these boundaries, so we can safely strip both directives.
## Local Development

### Start Remote Renderer
```bash
# From monorepo root
pnpm remote-mdx:dev
```

Runs on `http://localhost:3005`

### Start Bundle with Remote Rendering
```bash
# In bundle .env.local
REMOTE_RENDERER_URL=http://localhost:3005
USE_REMOTE_RENDERING=true

# Start bundle
pnpm docs:dev
```

### Clear Cache
```bash
# Bundle cache
rm -rf packages/fern-docs/bundle/.next/cache

# Remote renderer cache
rm -rf packages/fern-docs/mdx-remote-renderer/.next/cache
```

### Test Endpoints
```bash
# Health check
curl http://localhost:3005/api/health

# Batch serialize (see logs in remote renderer terminal)
# Visit any docs page on localhost:3000 and check remote renderer logs
```

## Logging

### Summary Logs (always on)
```
[batch-serialize] 📥 Received batch of 150 items for domain: example.docs.buildwithfern.com
[batch-serialize] 📤 Complete: 150/150 successful (5234ms total, ~35ms/item)
```

### Debug Logs (`NEXT_PUBLIC_DEBUG_REMOTE_RENDERER=true`)
```
[batch-serialize]   [1/150] Processing: page.mdx
[batch-serialize]     ⚙️  Vector 1: Compiling MDX (1234 chars)...
[batch-serialize]     ✅ Compiled (engine: esbuild, jsxElements: 5)
[batch-serialize]     📊 Vector 2: Extracting metadata via getMDXExport...
[batch-serialize]       Created 5 component overrides
[batch-serialize]       Extracted: toc (3 items), frontmatter (2 fields)
[batch-serialize]     🎨 Vector 3: Rendering to HTML...
[batch-serialize]       Using pathname for SSR context: /_/example/_/_/_/docs/my-page
[batch-serialize]       Main content: 5678 chars
[batch-serialize]     ✅ Complete (123ms)
```

### Bundle Logs

**Production logs (always on):**
```
[RemoteBatchSerializer] 🚀 Flushing batch: 200 calls, 150 unique items → POST .../api/batch-serialize
[RemoteBatchSerializer] ✅ Received results: 150/150 successful (523ms)
```

**Debug logs (set `NEXT_PUBLIC_DEBUG_REMOTE_RENDERER=true` on bundle):**
```
[RemoteBatchSerializer] ⚡ Plain text short-circuit for "The user's ID"
[RemoteBatchSerializer] 💾 Cache miss - queueing for batch: description (Type ID...)
[RemoteBatchSerializer] 📝 Queued item #1: description
[RemoteBatchSerializer] ⏰ Scheduling flush via setTimeout(0) (first item in batch)
[RemoteBatchSerializer] ✅ Cache miss resolved: description (45ms)

# On subsequent request:
[RemoteBatchSerializer] ⚡ Cache hit: page.mdx (0ms, no HTTP call)
```

## Why Pages Router (Not App Router)?

We use **Pages Router** (`pages/api/*.ts`) for API routes instead of App Router (`app/api/*/route.ts`).

**App Router restrictions that block us:**
- `react-dom/server` imports (`renderToString`) are blocked in App Router route handlers
- This is a hardcoded restriction in Next.js's bundler, not strippable via webpack

**Pages Router benefits:**
- No restrictions on `react-dom/server`
- Simpler syntax: `export default function handler(req, res)`
- Always Node.js runtime (no Edge Runtime confusion)

## Deployment

### Production Checklist
- [ ] Deploy remote renderer to separate service
- [ ] Ensure remote renderer has **no sensitive environment variables**
- [ ] Configure `REMOTE_RENDERER_URL` in bundle
- [ ] Set `USE_REMOTE_RENDERING=true` in bundle
- [ ] Test health endpoint: `GET /api/health`
- [ ] Monitor remote renderer logs for errors

### Rollback Plan
If issues occur, immediately disable remote rendering:
```bash
# Bundle .env
USE_REMOTE_RENDERING=false
```

Bundle automatically falls back to local rendering. No code changes needed.

## Notable Files

**Bundle - Remote Rendering & Caching**:
- `bundle/src/server/remote-renderer/batch-cache-api-descriptions.ts` — Chunked batch caching for API type descriptions (30 per chunk)
- `bundle/src/server/remote-renderer/batch-serializer.ts` — DataLoader-style batching client with per-item `unstable_cache` integration
- `bundle/src/server/remote-renderer/feature-flags.ts` — Feature flag logic (`USE_REMOTE_RENDERING`)

**Bundle - Serialization Pipeline**:
- `bundle/src/mdx/plugins/serialize-type-definition-descriptions.ts` — Walks type definitions and serializes all nested descriptions
- `bundle/src/mdx/plugins/serialize-description.ts` — Individual MDX description serializer with `React.cache()` singleton
- `bundle/src/mdx/bundler/component.tsx` — NextMdxRemoteComponent with React globals merged into scope

**Bundle - Lazy Slots**:
- `bundle/src/components/api-reference/type-definitions/TypeDefinitionSlot.tsx` — On-demand slot renderer (bundle-specific client component)
- `bundle/src/components/api-reference/type-definitions/TypeDefinitionSlotsServer.tsx` — Creates data slots vs JSX slots based on feature flag
- `../../components/src/api-reference/type-definitions/TypeDefinitionSlotsClient.tsx` — Slot data types + `isSlotData()` discriminator
- `bundle/src/components/api-reference/type-definitions/ObjectProperty.tsx` — Resolves serializedDescription from referenced types
- `bundle/src/components/api-reference/type-definitions/DiscriminatedUnionVariant.tsx` — Same referenced-type resolution for union variants

**Bundle - Content Components (use batch cache)**:
- `bundle/src/components/api-reference/endpoints/EndpointContent.tsx`
- `bundle/src/components/api-reference/websockets/WebSocket.tsx`
- `bundle/src/components/api-reference/webhooks/WebhookContent.tsx`
- `bundle/src/components/api-reference/grpcs/GrpcContent.tsx`
- `bundle/src/components/api-reference/graphql/GraphqlContent.tsx`

**Bundle - Rendering**:
- `bundle/src/components/shared-page.tsx` — Remote serializer initialization and option threading
- `bundle/src/mdx/components/RemoteMdxHydrator.tsx` — Client swap component (static HTML → live React tree)
- `bundle/src/components/layouts/LayoutEvaluator.tsx` — Uses `_remoteMetadata` to skip local `getMDXExport()`

**Remote Renderer**:
- `pages/api/batch-serialize.tsx` — Main batch endpoint (all three vectors)
- `pages/api/health.ts` — Health check endpoint
- `next.config.ts` — Webpack aliases, directive stripping, `@bundle` resolution
