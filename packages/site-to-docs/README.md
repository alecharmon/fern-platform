# site-to-docs

<!-- AI agents: update this date when modifying the README -->
> Last updated: 2026-02-04

Converts existing documentation websites into Fern documentation projects. This package crawls a documentation site, classifies its pages, and generates a complete Fern project with markdown files, navigation configuration, and OpenAPI stubs.

## Overview

The site-to-docs agent uses a multi-phase approach to convert websites into structured Fern documentation:

1. **Crawling** - BFS traversal of the site to collect all pages
2. **Navigation Heuristics** - Parse HTML and extract hints relevant to navigation
3. **Classification** - Two-phase LLM analysis to understand site structure
4. **Assign Filenames** - Generate consistent slugs and file paths
5. **Markdown Conversion** - Transform HTML content preserving structure
6. **`docs.yml` Generation** - Generate Fern navigation tree
7. **Branding Extraction** - Capture logos, colors, and favicons
8. **Write Output** - Generate the complete Fern project
9. **Validate** - Run `fern generate --docs --preview` to verify

## Approach

### Crawling

The crawler performs a breadth-first search starting from the root URL:

- Respects `maxPages` and `maxDepth` limits to bound crawl scope
- Follows same origin links extracted from both HTML anchors and JSON slug fields (for React/Next.js apps)
- Normalizes URLs and handles redirects
- Respects canonical URLs to avoid duplicate content
- Builds a graph of pages with forward and backward link relationships

### Navigation Heuristics

Before classification, the agent extracts hints relevant to navigation from HTML:

- Identifies section headings followed by link lists
- Preserves the original ordering of sections and pages within sections
- Aggregates hints across all pages, preferring the entry point page's ordering
- These hints are passed to the LLM as suggestions, not hard constraints

### Classification

Classification uses two LLM passes to understand site structure:

**Phase 1 (Site Structure Discovery):**
- Analyzes all URLs in a single call
- Identifies products (separate documentation areas like "Platform" vs "CLI")
- Identifies versions (e.g., v1, v2, latest)
- Identifies tabs (major navigation categories)
- Determines page ordering per navigation context

**Phase 2 (Section Classification):**
- Groups pages by URL prefix for efficient batching
- Derives product/version from URL patterns deterministically
- Uses LLM only for tab assignment, section grouping, and API reference detection
- Cleans up page titles by removing boilerplate

This two-phase approach minimizes LLM calls while maintaining classification accuracy.

### Markdown Conversion

HTML to Markdown conversion uses Mozilla Readability (Firefox's Reader Mode algorithm):

- Extracts main content, stripping navigation, sidebars, and footers
- Converts to GitHub Flavored Markdown using unified/rehype-remark
- Escapes MDX-sensitive characters (`{`, `}`) using HTML entities
- Rewrites internal links to use Fern slugs
- Detects and skips soft 404 pages (error pages that return 200)
- Generates YAML frontmatter with title and description

### `docs.yml` Generation

The navigation builder creates Fern's `docs.yml` structure:

- Supports three modes: simple (sections only), tabbed, and multi-product
- Products require separate `.yml` files per Fern specification
- Versions within products also get separate files
- Tab order is derived from page order (first appearance wins)
- Section order uses LLM-provided orderings with HTML hints as tiebreakers
- API reference pages are collected into an OpenAPI stub instead of markdown

### Branding Extraction

Automatically extracts visual identity from the source site:

- Logo URLs from header images and meta tags
- Favicon from link tags
- Accent colors from CSS custom properties
- Downloads and saves assets locally

## Usage

### Scripts

```bash
pnpm dev       # Run CLI directly via tsx (no compile step)
pnpm compile   # Build TypeScript to dist/
pnpm test      # Run tests with Vitest
pnpm clean     # Remove dist/ and tsc cache
```

### Local Development

```bash
pnpm dev https://docs.example.com --organization my-org --site-id my-docs --verbose
```

### CLI

```bash
npx site-to-docs https://docs.example.com \
  --organization my-org \
  --site-id my-docs \
  --max-pages 256 \
  --max-depth 10 \
  --verbose
```

### Programmatic

```typescript
import { runAgent } from "@fern-api/site-to-docs";

const result = await runAgent({
  url: "https://docs.example.com",
  outputDir: "./output",
  organization: "my-org",
  siteId: "my-docs",
  maxPages: 128,
  maxDepth: 8,
  verbose: true,
  onProgress: (event) => {
    console.log(event);
  }
});

console.log(`Converted ${result.writtenFiles.length} files`);
console.log(`Warnings: ${result.warnings.join("\n")}`);
```

## Development Caching

For faster iteration during development, use the cache flags:

```bash
# Cache crawler results (skip re-crawling)
npx site-to-docs https://docs.example.com -o ./output --crawler-cache

# Cache both crawler and classifier results
npx site-to-docs https://docs.example.com -o ./output --crawler-cache --classifier-cache
```

Cache files are stored in `.cache/` alongside the output directory.

## Environment Variables

- `ANTHROPIC_API_KEY` - Required in `packages/site-to-docs/.env` for LLM classification (Claude)

## Limitations

- Requires JavaScript-rendered content to be present in initial HTML (no JS execution during crawl)
- API reference pages are stubbed into OpenAPI format, not fully converted
- Complex interactive components may not convert cleanly to markdown e.g. Fern Components
- Rate limiting may affect large sites; consider adjusting `maxPages`
