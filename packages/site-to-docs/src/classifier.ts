import type { LanguageModelV1 } from "ai";
import { generateObject } from "ai";
import { z } from "zod";
import type {
    CrawlResult,
    DiscoveredTab,
    NavigationExtractionResult,
    NavigationHints,
    PageContext,
    PageNode,
    SiteStructure
} from "./types.js";

// ============================================================================
// Signal Extraction Functions
// These extract structured signals from HTML to provide rich context for classification.
// ============================================================================

/**
 * Extracts the text content from HTML, stripping tags.
 * Returns a truncated preview suitable for LLM context.
 */
export function extractTextPreview(html: string, maxLength: number = 2000): string {
    // Remove script and style tags with their content
    let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");

    // Remove all HTML tags
    text = text.replace(/<[^>]+>/g, " ");

    // Decode common HTML entities
    text = text
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");

    // Collapse whitespace
    text = text.replace(/\s+/g, " ").trim();

    // Truncate to max length
    if (text.length > maxLength) {
        return text.slice(0, maxLength) + "...";
    }
    return text;
}

/**
 * Extracts navigation structure from HTML, including section/page ordering.
 * Looks for the pattern: section heading (text element) followed by a container with links.
 *
 * Supports:
 * - `<heading>Section</heading><ul>..links..</ul>` (classic lists)
 * - `<heading>Section</heading><ol>..links..</ol>` (ordered lists)
 * - `<heading>Section</heading><div>..links..</div>` (card groups, nav containers)
 *
 * @param html - The HTML content to extract from
 * @param baseUrl - The base URL for resolving relative hrefs
 * @returns NavigationExtractionResult with URL-to-section mapping and navigation hints
 */
export function extractNavigationStructure(html: string, baseUrl: string): NavigationExtractionResult {
    const urlToSection = new Map<string, string>();
    const sections: string[] = [];
    const pagesBySection = new Map<string, string[]>();

    const resolvePathname = (href: string): string | undefined => {
        if (!href || href.startsWith("#") || href.startsWith("javascript:")) {
            return undefined;
        }
        try {
            return new URL(href, baseUrl).pathname;
        } catch {
            return undefined;
        }
    };

    // Helper to extract links from content and add to map, preserving order
    const extractLinks = (sectionName: string, content: string) => {
        // Track section order (first time we see this section)
        if (!pagesBySection.has(sectionName)) {
            sections.push(sectionName);
            pagesBySection.set(sectionName, []);
        }
        const sectionPages = pagesBySection.get(sectionName)!;

        const linkPattern = /<a[^>]*href=["']([^"']+)["']/gi;
        let linkMatch;
        while ((linkMatch = linkPattern.exec(content)) !== null) {
            const pathname = resolvePathname(linkMatch[1] ?? "");
            if (pathname && !urlToSection.has(pathname)) {
                urlToSection.set(pathname, sectionName);
                sectionPages.push(pathname);
            }
        }
    };

    // Pattern 1: Text heading followed by <ul> or <ol> with links
    const listPattern =
        /<(?:span|div|strong|b|h[2-6])[^>]*>([A-Z][^<]{1,40})<\/(?:span|div|strong|b|h[2-6])>\s*(?:<[^uo][^>]*>)*\s*<(?:ul|ol)[^>]*>([\s\S]*?)<\/(?:ul|ol)>/gi;
    let match;
    while ((match = listPattern.exec(html)) !== null) {
        const sectionName = (match[1] ?? "").trim();
        const listContent = match[2] ?? "";
        if (sectionName && listContent.includes("href=")) {
            extractLinks(sectionName, listContent);
        }
    }

    // Pattern 2: Text heading followed by <div> or <nav> with multiple links (card groups, nav containers)
    // More restrictive: requires at least 2 links to avoid false positives
    const containerPattern =
        /<(?:span|div|strong|b|h[2-6])[^>]*>([A-Z][^<]{1,40})<\/(?:span|div|strong|b|h[2-6])>\s*(?:<[^dn][^>]*>)*\s*<(?:div|nav)[^>]*>([\s\S]*?)<\/(?:div|nav)>/gi;
    while ((match = containerPattern.exec(html)) !== null) {
        const sectionName = (match[1] ?? "").trim();
        const containerContent = match[2] ?? "";
        // Require at least 2 links to reduce false positives
        const linkCount = (containerContent.match(/href=/gi) || []).length;
        if (sectionName && linkCount >= 2) {
            extractLinks(sectionName, containerContent);
        }
    }

    return {
        urlToSection,
        hints: {
            sections,
            pagesBySection
        }
    };
}

/**
 * Extracts URL path segments from a URL.
 * @example extractUrlPathSegments("https://example.com/platform/guides/intro") → ["platform", "guides", "intro"]
 */
export function extractUrlPathSegments(url: string): string[] {
    try {
        const parsed = new URL(url);
        return parsed.pathname.split("/").filter(Boolean);
    } catch {
        return [];
    }
}

/**
 * Builds a PageContext object from a PageNode.
 * Extracts all signals needed for classification.
 */
export function extractPageContext(page: PageNode): PageContext {
    // Extract navigation sections to find which section this page belongs to
    const { urlToSection } = extractNavigationStructure(page.html, page.url);
    let navSection: string | undefined;
    try {
        const pathname = new URL(page.url).pathname;
        navSection = urlToSection.get(pathname);
    } catch {
        // Invalid URL, skip navigation section lookup
    }

    return {
        url: page.url,
        urlPathSegments: extractUrlPathSegments(page.url),
        pageTitle: page.title,
        pageDescription: page.description,
        navSection,
        contentSnippet: extractTextPreview(page.html, 400)
    };
}

// ============================================================================
// Phase 1: Site Structure Discovery
// Analyzes ALL page URLs to identify products, versions, tabs.
// ============================================================================

/**
 * Schema for Phase 1 site structure analysis.
 */
const siteStructureSchema = z.object({
    products: z
        .array(
            z.object({
                name: z.string().describe("Display name (e.g., 'Platform', 'Wiki', 'CLI')"),
                urlPrefix: z.string().describe("Exact URL path segment in lowercase (e.g., 'platform', 'wiki', 'cli')")
            })
        )
        .describe(
            "Products = separate top-level documentation areas. Look at distinct top-level URL segments. If URLs start with different prefixes (e.g., /platform/ vs /wiki/), those are likely products."
        ),
    versions: z
        .array(
            z.object({
                name: z.string().describe("Display name (e.g., 'v1', 'v2', 'Latest')"),
                urlPattern: z.string().describe("Exact URL segment (e.g., 'v-1', 'v1', 'latest')")
            })
        )
        .describe("Versions found in URLs (e.g., /v1/, /v-2/, /latest/)"),
    tabs: z
        .array(
            z.object({
                name: z.string().describe("Display name (e.g., 'Guides', 'API Reference')"),
                urlPattern: z.string().optional().describe("URL keyword if present (e.g., 'guides', 'api')"),
                icon: z
                    .string()
                    .describe("Font Awesome icon name (short form, no 'fa-' prefix) that best represents this tab")
            })
        )
        .describe("Major navigation categories found in nav links or breadcrumbs"),
    contextOrderings: z
        .array(
            z.object({
                contextKey: z
                    .string()
                    .describe(
                        "Context identifier: 'product:version:tab' format, or empty string '' for simple sites with no products/versions/tabs"
                    ),
                orderedUrls: z
                    .array(z.string())
                    .describe(
                        "Page URLs in the intended navigation order for this context, based on navigation signals"
                    )
            })
        )
        .describe(
            "Page ordering per navigation context. Use navigation signals to determine the correct order. " +
                "Each unique combination of product/version/tab should have its own ordering. " +
                "For simple sites, use a single entry with empty contextKey."
        )
});

/**
 * Formats navigation hints for the LLM prompt.
 */
function formatNavigationHints(hints: NavigationHints): string {
    if (hints.sections.length === 0) {
        return "";
    }

    const lines: string[] = [
        "\n=== NAVIGATION ORDER HINTS (from HTML structure, use as suggestions) ===",
        `Sections in order: ${hints.sections.join(", ")}`
    ];

    // Show URLs per section (limit to avoid prompt bloat)
    for (const section of hints.sections.slice(0, 10)) {
        const urls = hints.pagesBySection.get(section) ?? [];
        if (urls.length > 0) {
            const displayUrls = urls.slice(0, 8);
            const suffix = urls.length > 8 ? ` (+${urls.length - 8} more)` : "";
            lines.push(`Pages in "${section}": ${displayUrls.join(", ")}${suffix}`);
        }
    }

    if (hints.sections.length > 10) {
        lines.push(`... and ${hints.sections.length - 10} more sections`);
    }

    lines.push(
        "",
        "NOTE: These are heuristic suggestions extracted from HTML navigation.",
        "Use them as hints when determining contextOrderings, but you may adjust based on URL patterns."
    );

    return lines.join("\n");
}

/**
 * Builds the Phase 1 prompt for site structure analysis.
 * @param allUrls - All page URLs (as pathnames)
 * @param entryPointUrl - The entry point URL where the crawl started (as pathname)
 * @param navigationHints - Optional navigation hints from HTML (heuristic)
 */
export function buildSiteStructurePrompt(
    allUrls: string[],
    entryPointUrl?: string,
    navigationHints?: NavigationHints
): string {
    // Extract unique top-level path segments for product hint
    const topLevelSegments = new Set<string>();
    for (const url of allUrls) {
        const segments = url.split("/").filter(Boolean);
        if (segments.length > 0 && segments[0]) {
            topLevelSegments.add(segments[0]);
        }
    }

    // Format navigation hints if provided
    const hintsSection = navigationHints ? formatNavigationHints(navigationHints) : "";

    return `Analyze this documentation site's structure to identify products, versions, tabs, and determine page ordering.

ENTRY POINT URL: ${entryPointUrl ?? "(not specified)"}
This is the URL where the user started the crawl. Consider this when determining page ordering.

URL PATTERNS (${allUrls.length} pages):
${allUrls.slice(0, 100).join("\n")}
${allUrls.length > 100 ? `\n... and ${allUrls.length - 100} more pages` : ""}

TOP-LEVEL URL SEGMENTS: ${Array.from(topLevelSegments).join(", ")}
${hintsSection}
=== HOW TO IDENTIFY TABS vs SECTIONS ===

You have two key signals:
1. **TOP-LEVEL URL SEGMENTS** (shown above) → Typically indicate **tabs**
2. **NAVIGATION HINTS** (if shown above) → Typically indicate **sections within a tab**

**TABS** are top-level navigation categories (shown in the tab bar):
- Tabs represent major content divisions (e.g., main docs tab, API Reference tab)
- Tabs typically correspond to distinct top-level URL segments (e.g., /api/, /docs/)
- A site typically has 2-4 tabs

**SECTIONS** are groupings WITHIN a tab (shown in the sidebar):
- Sections group related pages within a tab
- Navigation hints typically represent sections, NOT tabs
- If something appears in navigation hints but doesn't have its own distinct top-level URL segment, it's typically a section within another tab

**Example**:
- TOP-LEVEL URL SEGMENTS: overview, quickstart, capabilities, tutorials, api
- NAVIGATION HINTS: "Get Started", "Capabilities", "Tutorials"
- Result: "api" segment → separate API Reference tab; navigation hints → sections within the main documentation tab

INSTRUCTIONS:
1. **Products**: Look at TOP-LEVEL URL SEGMENTS for distinct documentation areas.
   - urlPrefix MUST be the exact URL segment (lowercase)
   - If all pages share one top-level segment, leave products empty

2. **Versions**: Look for URL patterns like /v1/, /v-1/, /latest/
   - urlPattern MUST be the exact URL segment

3. **Tabs**: Identify from TOP-LEVEL URL SEGMENTS, not navigation hints
   - Only create a tab if there's a distinct URL segment OR fundamentally different content type (like API Reference)
   - Navigation hints typically represent sections WITHIN tabs, not tabs themselves
   - urlPattern is optional - use if there's a clear URL segment
   - **icon**: Choose an appropriate Font Awesome icon name (short form, no "fa-" prefix) based on the tab's purpose

4. **Context Orderings**: Determine page order per tab
   - A context is "product:version:tab" (empty string for simple sites)
   - Order introductory content first (overview, getting-started, quickstart)
   - Group related pages together
   - **Use NAVIGATION ORDER HINTS above as suggestions** for section/page ordering within tabs

Return JSON with products, versions, tabs (including icons), and contextOrderings arrays.`;
}

/**
 * Phase 1: Analyzes the site structure from all URLs.
 * Returns the discovered products, versions, tabs, and context orderings.
 * @param pages - Map of URL to PageNode
 * @param model - Language model for LLM analysis
 * @param entryPointUrl - Optional entry point URL where crawl started
 * @param navigationHints - Optional navigation hints from HTML (heuristic)
 */
export async function analyzeSiteStructure(
    pages: Map<string, PageNode>,
    model: LanguageModelV1,
    entryPointUrl?: string,
    navigationHints?: NavigationHints
): Promise<SiteStructure> {
    // Collect all URLs as pathnames
    const allUrls = Array.from(pages.keys()).map((url) => {
        try {
            return new URL(url).pathname;
        } catch {
            return url;
        }
    });

    // Convert entry point to pathname for consistency
    let entryPointPathname: string | undefined;
    if (entryPointUrl) {
        try {
            entryPointPathname = new URL(entryPointUrl).pathname;
        } catch {
            entryPointPathname = entryPointUrl;
        }
    }

    // Call LLM to analyze structure
    const { object } = await generateObject({
        model,
        schema: siteStructureSchema,
        prompt: buildSiteStructurePrompt(allUrls, entryPointPathname, navigationHints)
    });

    return {
        products: object.products,
        versions: object.versions,
        tabs: object.tabs.map((t) => ({
            name: t.name,
            urlPattern: t.urlPattern,
            icon: t.icon
        })),
        contextOrderings: object.contextOrderings.map((co) => ({
            contextKey: co.contextKey,
            orderedUrls: co.orderedUrls
        })),
        // Pass through section order from navigation hints (extracted from HTML)
        sectionOrder: navigationHints?.sections
    };
}

// ============================================================================
// Phase 1 → Phase 2 Bridge: Deterministic Derivation
// Uses SiteStructure patterns to assign product/version from URL patterns.
// Tab assignment is handled by Phase 2 LLM for better accuracy.
// ============================================================================

/**
 * Derives product and version from URL using the discovered site structure.
 * Tab assignment is NOT done here - it's handled by Phase 2 LLM based on content.
 */
export function deriveFromStructure(
    url: string,
    structure: SiteStructure
): { derivedProduct?: string; derivedVersion?: string } {
    let pathname: string;
    try {
        pathname = new URL(url).pathname.toLowerCase();
    } catch {
        pathname = url.toLowerCase();
    }

    const result: { derivedProduct?: string; derivedVersion?: string } = {};

    // Match product by URL prefix
    for (const product of structure.products) {
        if (
            pathname.includes(`/${product.urlPrefix.toLowerCase()}/`) ||
            pathname.startsWith(`/${product.urlPrefix.toLowerCase()}`)
        ) {
            result.derivedProduct = product.name;
            break;
        }
    }

    // Match version by URL pattern
    for (const version of structure.versions) {
        if (
            pathname.includes(`/${version.urlPattern.toLowerCase()}/`) ||
            pathname.includes(`/${version.urlPattern.toLowerCase()}`)
        ) {
            result.derivedVersion = version.name;
            break;
        }
    }

    // If site has versions but this page doesn't match any, assign to default "Latest" version
    // This ensures proper Fern versioning structure where non-versioned pages are "latest"
    if (!result.derivedVersion && structure.versions.length > 0) {
        result.derivedVersion = "Latest";
    }

    // NOTE: Tab assignment removed - handled by Phase 2 LLM based on page content/title

    return result;
}

// ============================================================================
// Phase 2: Section Classification
// Uses site structure context to classify sections and isApiReference.
// ============================================================================

/**
 * Creates the schema for Phase 2 classification with discovered tabs and sections in the description.
 * This ensures the LLM has context about available tabs and sections at the schema level.
 */
function createSectionClassificationSchema(discoveredTabs: DiscoveredTab[], sectionOrder?: string[]) {
    const tabNames = discoveredTabs.map((t) => t.name);
    const tabDescription =
        tabNames.length > 0
            ? `Tab name. Strongly prefer one of: ${tabNames.join(", ")}. ` +
              `Use "${tabNames[0]}" for general documentation content. ` +
              `Only create a NEW tab name if content is fundamentally different from ALL discovered tabs.`
            : "Tab name for this page. Use a descriptive name like 'Documentation', 'API Reference', 'Guides', etc.";

    const sectionDescription =
        `Section name for grouping related pages. Group pages with similar topics together. ` +
        `Use empty string '' only for truly standalone pages like a welcome/landing page.`;

    return z.object({
        pages: z
            .array(
                z.object({
                    url: z.string().describe("The URL of the page being classified"),
                    tab: z.string().describe(tabDescription),
                    section: z.string().describe(sectionDescription),
                    isApiReference: z
                        .boolean()
                        .describe(
                            "TRUE only for actual HTTP endpoint documentation (e.g., GET /users). " +
                                "FALSE for intro pages, auth guides, tutorials even if in API section."
                        ),
                    cleanTitle: z
                        .string()
                        .describe(
                            "Clean page title with extraneous info removed: " +
                                "strip site name suffixes (e.g., ' | My Docs'), " +
                                "remove redundant product/version prefixes already in structure, " +
                                "remove boilerplate like 'Docs:', 'Guide:', 'Reference:'. " +
                                "Keep concise and descriptive."
                        )
                })
            )
            .describe("Tab, section, API classification, and cleaned title for each page")
    });
}

/**
 * Context for Phase 2 classification, includes derived product/version.
 * Tab is assigned by the LLM in Phase 2, not derived deterministically.
 */
interface Phase2PageContext extends PageContext {
    derivedProduct?: string;
    derivedVersion?: string;
}

/**
 * Extracts a suggested section name from URL path segments.
 * The second-to-last segment often indicates the section.
 * E.g., /docs/tutorials/searching-plants -> "tutorials"
 */
function getSuggestedSectionFromUrl(segments: string[]): string | undefined {
    if (segments.length < 2) {
        return undefined;
    }
    // Get second-to-last segment as potential section name
    const potentialSection = segments[segments.length - 2];
    if (!potentialSection) {
        return undefined;
    }
    // Skip common non-section segments
    const skipSegments = ["docs", "guides", "api", "v1", "v2", "latest", "pages"];
    if (skipSegments.includes(potentialSection.toLowerCase())) {
        // Try third-to-last if second-to-last is skipped
        if (segments.length >= 3) {
            const alternative = segments[segments.length - 3];
            if (alternative && !skipSegments.includes(alternative.toLowerCase())) {
                return alternative;
            }
        }
        return undefined;
    }
    return potentialSection;
}

/**
 * Renders a page context for the Phase 2 LLM prompt.
 */
function renderPhase2Context(ctx: Phase2PageContext, index: number): string {
    const lines = [
        `[${index + 1}] URL: ${ctx.url}`,
        `    Title: ${ctx.pageTitle}`,
        `    Path: ${ctx.urlPathSegments.join(" / ") || "(root)"}`
    ];

    // Add page description if available
    if (ctx.pageDescription) {
        lines.push(
            `    Description: ${ctx.pageDescription.slice(0, 150)}${ctx.pageDescription.length > 150 ? "..." : ""}`
        );
    }

    // Show what was derived from structure (product/version only - tab assigned by LLM)
    const derived: string[] = [];
    if (ctx.derivedProduct) {
        derived.push(`product=${ctx.derivedProduct}`);
    }
    if (ctx.derivedVersion) {
        derived.push(`version=${ctx.derivedVersion}`);
    }
    if (derived.length > 0) {
        lines.push(`    Derived: ${derived.join(", ")}`);
    }

    // Add possible section (heuristic - extracted from HTML structure)
    if (ctx.navSection) {
        lines.push(`    Possible section (from HTML): "${ctx.navSection}"`);
    }

    // Add URL-based section hint as fallback
    const suggestedSection = getSuggestedSectionFromUrl(ctx.urlPathSegments);
    if (suggestedSection && !ctx.navSection) {
        // Only show URL hint if no navigation section found
        const titleCase = suggestedSection.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        lines.push(`    Section (from URL): "${titleCase}"`);
    }

    lines.push(`    Content: ${ctx.contentSnippet.slice(0, 150)}...`);

    return lines.join("\n");
}

/**
 * Builds the Phase 2 prompt for tab and section classification.
 * LLM assigns tabs based on content type, not URL patterns.
 */
export function buildSectionClassificationPrompt(contexts: Phase2PageContext[], structure: SiteStructure): string {
    const pagesContext = contexts.map((ctx, i) => renderPhase2Context(ctx, i)).join("\n\n");

    // Build detailed tab list with descriptions
    const tabDescriptions = structure.tabs
        .map((t) => `- "${t.name}"${t.urlPattern ? ` (URL pattern: ${t.urlPattern})` : ""}`)
        .join("\n");

    // Summarize the discovered structure
    const structureSummary: string[] = [];
    if (structure.products.length > 0) {
        structureSummary.push(`Products: ${structure.products.map((p) => p.name).join(", ")}`);
    }
    if (structure.versions.length > 0) {
        structureSummary.push(`Versions: ${structure.versions.map((v) => v.name).join(", ")}`);
    }

    // Build section hints for the prompt
    const sectionHints =
        structure.sectionOrder && structure.sectionOrder.length > 0
            ? `\nDISCOVERED SECTIONS (from site navigation, in display order):\n${structure.sectionOrder.map((s) => `- "${s}"`).join("\n")}\n`
            : "";

    return `Classify these ${contexts.length} documentation pages into tabs and sections.

DISCOVERED TABS:
${tabDescriptions || "No tabs discovered - use 'default' as tab name"}
${sectionHints}
${structureSummary.length > 0 ? `SITE STRUCTURE:\n${structureSummary.join("\n")}\n` : ""}
PAGES TO CLASSIFY:
${pagesContext}

INSTRUCTIONS:
For each page, determine:

1. **tab**: Which tab does this page belong to?
   - STRONGLY PREFER using one of the exact tab names from DISCOVERED TABS above
   - Use the FIRST discovered tab for general documentation content (guides, tutorials, overviews)
   - Only use other discovered tabs if the content clearly belongs there (e.g., API reference pages go in API tabs)
   - If unsure or content could fit multiple tabs, use the first discovered tab
   - Only create a NEW tab name if content is fundamentally different from ALL discovered tabs
   - If no tabs were discovered, use "default" for all pages

2. **section**: Group related pages together OR use empty string "" for standalone pages
   - If "Possible section (from HTML)" is shown for a page, use it as a strong hint
   - If "Section (from URL)" is shown, use it as a hint
   - If DISCOVERED SECTIONS are listed above, prefer using those exact names when they match
   - Group pages with similar topics/purposes together under a descriptive section name
   - Introductory pages (overview, quickstart, introduction) should be grouped together
   - Only use empty string "" for truly standalone pages like a Welcome/landing page

3. **isApiReference**: Is this an ACTUAL API endpoint documentation page?
   - TRUE ONLY for pages that document specific HTTP endpoints (e.g., "GET /users", "POST /plants")
   - Look for: HTTP methods in title (GET, POST, PUT, DELETE, PATCH), endpoint paths, request/response schemas
   - FALSE for: Introduction pages, authentication guides, quickstarts, tutorials about APIs
   - IMPORTANT: Being in an "API Reference" URL path does NOT automatically make it isApiReference
   - Example FALSE: "Introduction", "Authentication", "Getting Started with the API"
   - Example TRUE: "Get Users", "Create Plant", "Delete Resource"

4. **cleanTitle**: Clean up the page title
   - Remove site name suffixes (e.g., "Auth | MyCompany Docs" → "Auth")
   - Remove product/version info already captured in site structure (e.g., "Platform - Authentication" → "Authentication")
   - Remove common boilerplate prefixes like "Docs:", "Guide:", "API:", "Reference:"
   - Remove separator patterns like " - ", " | ", " :: " that precede site names
   - Keep the title concise, descriptive, and suitable for navigation display

Return JSON with a 'pages' array containing tab, section, isApiReference, and cleanTitle for each page.`;
}

// Keep the old function signature for backwards compatibility in tests
export function buildClassificationPrompt(contexts: PageContext[]): string {
    return buildSectionClassificationPrompt(
        contexts.map((ctx) => ({ ...ctx })),
        { products: [], versions: [], tabs: [], contextOrderings: [] }
    );
}

// ============================================================================
// Page Grouping
// Groups pages by URL prefix for batched classification.
// ============================================================================

/**
 * Extracts the URL prefix (parent path) from a URL.
 * Used for grouping sibling pages together.
 *
 * @example
 * extractUrlPrefix("https://example.com/docs/guides/intro") → "docs/guides"
 * extractUrlPrefix("https://example.com/api") → ""
 */
export function extractUrlPrefix(url: string): string {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);
    // Remove the last segment to get the parent path
    if (segments.length <= 1) {
        return "";
    }
    return segments.slice(0, -1).join("/");
}

/**
 * Options for grouping pages by prefix.
 */
export interface GroupPagesOptions {
    /** Maximum pages per group (default: 16) */
    maxGroupSize?: number;
}

/**
 * Result of grouping pages by prefix.
 */
export interface GroupPagesResult {
    /** The grouped pages */
    groups: PageContext[][];
    /** Warnings about groups that were split */
    warnings: string[];
}

/**
 * Groups pages by their URL prefix for batched classification.
 * Pages with the same prefix are likely siblings and should share classification context.
 *
 * @param pages - Map of URL to PageNode from the crawl result
 * @param options - Options including maxGroupSize
 * @returns GroupPagesResult with groups and any warnings
 */
export function groupPagesByPrefix(pages: Map<string, PageNode>, options: GroupPagesOptions = {}): GroupPagesResult {
    const { maxGroupSize = 16 } = options;
    const prefixMap = new Map<string, PageContext[]>();

    for (const [url, page] of pages) {
        const prefix = extractUrlPrefix(url);
        const context = extractPageContext(page);

        let group = prefixMap.get(prefix);
        if (!group) {
            group = [];
            prefixMap.set(prefix, group);
        }

        group.push(context);
    }

    // Split large groups to stay within context limits
    const groups: PageContext[][] = [];
    const warnings: string[] = [];

    for (const [prefix, group] of prefixMap) {
        if (group.length <= maxGroupSize) {
            groups.push(group);
        } else {
            // Track that this group was split
            const numChunks = Math.ceil(group.length / maxGroupSize);
            warnings.push(
                `maxGroupSize limit (${maxGroupSize}) exceeded for prefix "${prefix || "(root)"}" with ${group.length} pages. Split into ${numChunks} batches, which may affect classification consistency.`
            );

            // Split into smaller groups
            for (let i = 0; i < group.length; i += maxGroupSize) {
                groups.push(group.slice(i, i + maxGroupSize));
            }
        }
    }

    return { groups, warnings };
}

// ============================================================================
// Consistency Enforcement
// Post-processing to normalize classifications.
// ============================================================================

/**
 * Normalizes section and tab names across all pages for consistency.
 * Handles case variations and hyphenated names.
 */
export function enforceConsistency(pages: Map<string, PageNode>): void {
    // Normalize sections
    normalizeField(pages, "section");
    // Normalize tabs
    normalizeField(pages, "tab");
}

/**
 * Normalizes a specific field across all pages.
 */
function normalizeField(pages: Map<string, PageNode>, field: "section" | "tab"): void {
    const fieldCounts = new Map<string, Map<string, number>>();

    for (const page of pages.values()) {
        const value = page.classification?.[field];
        if (!value) {
            continue;
        }

        // Normalize to lowercase for grouping
        const normalized = value.toLowerCase().replace(/[-_]/g, " ");
        let variants = fieldCounts.get(normalized);
        if (!variants) {
            variants = new Map();
            fieldCounts.set(normalized, variants);
        }
        variants.set(value, (variants.get(value) ?? 0) + 1);
    }

    // Build a mapping from any variant to the most common form
    const fieldMapping = new Map<string, string>();
    for (const variants of fieldCounts.values()) {
        // Find the most common variant
        let bestVariant = "";
        let bestCount = 0;
        for (const [variant, count] of variants) {
            if (count > bestCount) {
                bestCount = count;
                bestVariant = variant;
            }
        }
        // Map all variants to the best one
        for (const variant of variants.keys()) {
            fieldMapping.set(variant, bestVariant);
        }
    }

    // Apply normalization
    for (const page of pages.values()) {
        const value = page.classification?.[field];
        if (value && fieldMapping.has(value)) {
            page.classification![field] = fieldMapping.get(value)!;
        }
    }
}

// ============================================================================
// Main Classification Function
// Single-pass classification with rich context.
// ============================================================================

/**
 * Options for the classifyPages function.
 */
export interface ClassifyPagesOptions {
    /** Maximum number of concurrent classification requests (default: 3) */
    concurrency?: number;
    /** Callback for progress updates */
    onProgress?: (classified: number, total: number) => void;
    /** Maximum pages per batch group (default: 16) */
    maxGroupSize?: number;
    /** Navigation hints extracted from HTML (heuristic, optional) */
    navigationHints?: NavigationHints;
}

/**
 * Result of the classification process.
 */
export interface ClassificationResult {
    /** Number of LLM calls made */
    llmCalls: number;
    /** Number of groups processed */
    groups: number;
    /** Warnings generated during classification */
    warnings: string[];
    /** Site structure discovered in Phase 1 (includes contextOrderings) */
    siteStructure: SiteStructure;
}

/**
 * Phase 2: Classifies a batch of pages to determine tab, section, isApiReference, and cleanTitle.
 * Product/version are derived from URL patterns; tab is assigned by LLM based on content.
 * Uses dynamic schema with discovered tabs to provide context to the LLM.
 */
async function classifySectionBatch(
    contexts: Phase2PageContext[],
    structure: SiteStructure,
    model: LanguageModelV1
): Promise<Map<string, { tab: string; section: string; isApiReference: boolean; cleanTitle: string }>> {
    const results = new Map<string, { tab: string; section: string; isApiReference: boolean; cleanTitle: string }>();

    // Create schema dynamically with discovered tabs and sections in the description
    const schema = createSectionClassificationSchema(structure.tabs, structure.sectionOrder);

    const { object } = await generateObject({
        model,
        schema,
        prompt: buildSectionClassificationPrompt(contexts, structure)
    });

    for (const pageResult of object.pages) {
        results.set(pageResult.url, {
            tab: pageResult.tab,
            section: pageResult.section,
            isApiReference: pageResult.isApiReference,
            cleanTitle: pageResult.cleanTitle
        });
    }

    return results;
}

/**
 * Classifies all pages using a two-phase approach.
 * Updates each PageNode's classification property in place.
 *
 * Phase 1: Site Structure Discovery (1 LLM call)
 * - Analyzes ALL URLs + aggregated nav signals
 * - Discovers products, versions, tabs
 *
 * Phase 2: Section Classification (N LLM calls, batched)
 * - Derives product/version/tab from URL patterns (deterministic)
 * - Uses LLM only for section + isApiReference
 *
 * @returns Result including stats and warnings
 */
export async function classifyPages(
    crawlResult: CrawlResult,
    model: LanguageModelV1,
    options: ClassifyPagesOptions = {}
): Promise<ClassificationResult> {
    const { concurrency = 3, onProgress, maxGroupSize = 16, navigationHints } = options;
    const { pages, rootUrl } = crawlResult;

    const total = pages.size;
    let llmCalls = 0;
    const warnings: string[] = [];

    // ========================================================================
    // PHASE 1: Site Structure Discovery
    // ========================================================================
    const structure = await analyzeSiteStructure(pages, model, rootUrl, navigationHints);
    llmCalls += 1;

    // Log discovered structure
    const parts: string[] = [];
    if (structure.products.length > 0) {
        parts.push(`${structure.products.length} product(s)`);
    }
    if (structure.versions.length > 0) {
        parts.push(`${structure.versions.length} version(s)`);
    }
    if (structure.tabs.length > 0) {
        parts.push(`${structure.tabs.length} tab(s)`);
    }
    if (parts.length > 0) {
        console.log(`  Discovered: ${parts.join(", ")}`);
    }
    if (structure.tabs.length > 0) {
        console.log(`  Tabs: ${structure.tabs.map((t) => `${t.name} (${t.icon ?? "no icon"})`).join(", ")}`);
    }

    // ========================================================================
    // PHASE 2: Section Classification
    // ========================================================================

    // Group pages by URL prefix and extract context
    const { groups, warnings: groupWarnings } = groupPagesByPrefix(pages, { maxGroupSize });
    warnings.push(...groupWarnings);
    let classified = 0;

    // Enhance each group with derived product/version/tab
    const enhancedGroups: Phase2PageContext[][] = groups.map((group) =>
        group.map((ctx) => ({
            ...ctx,
            ...deriveFromStructure(ctx.url, structure)
        }))
    );

    // Process groups in parallel batches
    for (let i = 0; i < enhancedGroups.length; i += concurrency) {
        const batch = enhancedGroups.slice(i, i + concurrency);

        const batchResults = await Promise.all(batch.map((group) => classifySectionBatch(group, structure, model)));
        llmCalls += batch.length;

        // Apply results - combine derived fields with LLM-determined section/isApiReference
        for (let j = 0; j < batch.length; j++) {
            const group = batch[j];
            const groupResults = batchResults[j];

            if (!group || !groupResults) {
                continue;
            }

            for (const ctx of group) {
                const sectionResult = groupResults.get(ctx.url);
                const page = pages.get(ctx.url);

                if (page && sectionResult) {
                    page.classification = {
                        product: ctx.derivedProduct,
                        version: ctx.derivedVersion,
                        tab: sectionResult.tab, // From LLM, not derived
                        section: sectionResult.section,
                        isApiReference: sectionResult.isApiReference
                    };
                    // Apply cleaned title if provided
                    if (sectionResult.cleanTitle) {
                        page.title = sectionResult.cleanTitle;
                    }
                    classified++;
                    onProgress?.(classified, total);
                }
            }
        }
    }

    // Post-process for consistency
    enforceConsistency(pages);

    return {
        llmCalls,
        groups: enhancedGroups.length,
        warnings,
        siteStructure: structure
    };
}
