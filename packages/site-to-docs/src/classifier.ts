import type { LanguageModelV1 } from "ai";
import { generateObject } from "ai";
import { z } from "zod";
import type {
    AggregatedSignals,
    CrawlResult,
    OrderedNavLink,
    PageContext,
    PageNode,
    PageType,
    SidebarSignal,
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
 * Extracts breadcrumb path from HTML.
 * Tries multiple common patterns in priority order:
 * 1. aria-label="breadcrumb" nav elements
 * 2. .breadcrumb or .breadcrumbs containers
 * 3. Schema.org BreadcrumbList structured data
 *
 * @returns Array of breadcrumb items, or empty array if none found
 */
export function extractBreadcrumbPath(html: string): string[] {
    const breadcrumbs: string[] = [];

    // Strategy 1: aria-label="breadcrumb" (most accessible pattern)
    const ariaMatch = html.match(/<nav[^>]*aria-label=["'](?:b|B)readcrumb["'][^>]*>([\s\S]*?)<\/nav>/i);
    if (ariaMatch) {
        const navContent = ariaMatch[1] ?? "";
        // Extract text from list items or links
        const items = navContent.matchAll(/<(?:li|a)[^>]*>([^<]+)</gi);
        for (const item of items) {
            const text = (item[1] ?? "").trim();
            if (text && !isSeparator(text)) {
                breadcrumbs.push(text);
            }
        }
        if (breadcrumbs.length > 0) {
            return breadcrumbs;
        }
    }

    // Strategy 2: .breadcrumb or .breadcrumbs class
    const classMatch = html.match(
        /<(?:nav|div|ol|ul)[^>]*class=["'][^"']*breadcrumbs?[^"']*["'][^>]*>([\s\S]*?)<\/(?:nav|div|ol|ul)>/i
    );
    if (classMatch) {
        const container = classMatch[1] ?? "";
        const items = container.matchAll(/<(?:li|a|span)[^>]*>([^<]+)</gi);
        for (const item of items) {
            const text = (item[1] ?? "").trim();
            if (text && !isSeparator(text)) {
                breadcrumbs.push(text);
            }
        }
        if (breadcrumbs.length > 0) {
            return breadcrumbs;
        }
    }

    // Strategy 3: Schema.org BreadcrumbList
    const schemaMatch = html.match(/<[^>]*itemtype=["'][^"']*BreadcrumbList["'][^>]*>([\s\S]*?)<\/(?:ol|ul|nav|div)>/i);
    if (schemaMatch) {
        const container = schemaMatch[1] ?? "";
        // Look for itemprop="name" or just link text
        const items = container.matchAll(/itemprop=["']name["'][^>]*>([^<]+)</gi);
        for (const item of items) {
            const text = (item[1] ?? "").trim();
            if (text && !isSeparator(text)) {
                breadcrumbs.push(text);
            }
        }
        if (breadcrumbs.length > 0) {
            return breadcrumbs;
        }

        // Fallback: just extract link text from schema container
        const links = container.matchAll(/<a[^>]*>([^<]+)</gi);
        for (const link of links) {
            const text = (link[1] ?? "").trim();
            if (text && !isSeparator(text)) {
                breadcrumbs.push(text);
            }
        }
    }

    return breadcrumbs;
}

/**
 * Checks if a string is likely a breadcrumb separator.
 */
function isSeparator(text: string): boolean {
    const separators = ["/", ">", "›", "»", "→", "·", "|", "-"];
    return separators.includes(text.trim()) || text.length === 0;
}

/**
 * Extracts top-level site navigation links from HTML.
 * Looks for primary navigation patterns:
 * 1. header nav links
 * 2. [role="navigation"] top-level links
 * 3. .sidebar or .nav-sidebar first-level items
 *
 * Filters out external links, social icons, and utility links.
 *
 * @returns Array of navigation link labels
 */
export function extractSiteNavigationLinks(html: string): string[] {
    const navLinks: string[] = [];
    const seen = new Set<string>();

    // Helper to add unique, filtered links
    const addLink = (text: string, href: string | null) => {
        const cleaned = text.trim();
        // Filter out common non-nav items
        if (!cleaned || cleaned.length > 50) {
            return;
        }
        if (seen.has(cleaned.toLowerCase())) {
            return;
        }
        // Skip external links
        if (href?.startsWith("http") && !href.includes(getBaseDomain(html))) {
            return;
        }
        // Skip utility links
        const utilityPatterns =
            /^(login|sign\s*in|sign\s*up|register|search|settings|profile|account|logout|sign\s*out)$/i;
        if (utilityPatterns.test(cleaned)) {
            return;
        }
        // Skip social icons (typically single characters or emoji)
        if (cleaned.length <= 2) {
            return;
        }

        seen.add(cleaned.toLowerCase());
        navLinks.push(cleaned);
    };

    // Strategy 1: Header nav links (highest priority)
    const headerNavMatch = html.match(/<header[^>]*>([\s\S]*?)<\/header>/i);
    if (headerNavMatch) {
        const headerContent = headerNavMatch[1] ?? "";
        const navMatch = headerContent.match(/<nav[^>]*>([\s\S]*?)<\/nav>/i);
        if (navMatch) {
            const navContent = navMatch[1] ?? "";
            const links = navContent.matchAll(/<a[^>]*(?:href=["']([^"']+)["'])?[^>]*>([^<]+)</gi);
            for (const link of links) {
                addLink(link[2] ?? "", link[1] ?? null);
            }
        }
    }

    // Strategy 2: [role="navigation"] top-level links
    const roleNavMatches = html.matchAll(/<[^>]*role=["']navigation["'][^>]*>([\s\S]*?)<\/(?:nav|div|ul)>/gi);
    for (const match of roleNavMatches) {
        // Only get direct links (not nested in sub-lists)
        const content = match[1] ?? "";
        // Remove nested lists to get only top-level
        const topLevel = content.replace(/<ul[^>]*>[\s\S]*?<\/ul>/gi, "");
        const links = topLevel.matchAll(/<a[^>]*(?:href=["']([^"']+)["'])?[^>]*>([^<]+)</gi);
        for (const link of links) {
            addLink(link[2] ?? "", link[1] ?? null);
        }
    }

    // Strategy 3: Sidebar navigation (first-level only)
    const sidebarMatch = html.match(
        /<(?:aside|nav|div)[^>]*class=["'][^"']*(?:sidebar|nav-sidebar|side-nav)[^"']*["'][^>]*>([\s\S]*?)<\/(?:aside|nav|div)>/i
    );
    if (sidebarMatch && navLinks.length === 0) {
        const content = sidebarMatch[1] ?? "";
        // Get first-level list items only
        const firstLevelPattern = /<li[^>]*>\s*<a[^>]*(?:href=["']([^"']+)["'])?[^>]*>([^<]+)</gi;
        const links = content.matchAll(firstLevelPattern);
        for (const link of links) {
            addLink(link[2] ?? "", link[1] ?? null);
        }
    }

    return navLinks;
}

/**
 * Extracts ordered sidebar navigation links from HTML.
 * Preserves DOM order and includes hrefs for matching against page URLs.
 *
 * Targets common sidebar patterns:
 * 1. <aside> elements containing navigation
 * 2. Elements with .sidebar, .side-nav, .nav-sidebar classes
 * 3. [role="navigation"] elements that appear to be sidebars
 *
 * @param html - The HTML content to extract from
 * @param baseUrl - The base URL for resolving relative hrefs
 * @returns Array of OrderedNavLink objects preserving DOM order
 */
export function extractOrderedSidebarLinks(html: string, baseUrl: string): OrderedNavLink[] {
    const links: OrderedNavLink[] = [];
    const seenHrefs = new Set<string>();

    // Helper to resolve relative URLs to absolute
    const resolveUrl = (href: string): string | null => {
        if (!href || href.startsWith("#") || href.startsWith("javascript:")) {
            return null;
        }
        try {
            return new URL(href, baseUrl).href;
        } catch {
            return null;
        }
    };

    // Helper to add a link if valid and not duplicate
    const addLink = (text: string, href: string) => {
        const cleaned = text.trim();
        // Filter out empty or very long text
        if (!cleaned || cleaned.length > 100) {
            return;
        }
        // Filter out single characters (likely icons)
        if (cleaned.length <= 2) {
            return;
        }

        const resolvedHref = resolveUrl(href);
        if (!resolvedHref) {
            return;
        }

        // Skip duplicates (same URL)
        if (seenHrefs.has(resolvedHref)) {
            return;
        }
        seenHrefs.add(resolvedHref);

        links.push({ text: cleaned, href: resolvedHref });
    };

    // Helper to extract links from HTML content
    const extractLinksFromContent = (content: string) => {
        // Match <a> elements with href and text
        const linkPattern = /<a[^>]*href=["']([^"']+)["'][^>]*>([^<]*(?:<[^/a][^>]*>[^<]*<\/[^>]+>[^<]*)*)</gi;
        let match;
        while ((match = linkPattern.exec(content)) !== null) {
            const href = match[1] ?? "";
            // Extract text content, removing nested tags
            const rawText = match[2] ?? "";
            const text = rawText.replace(/<[^>]+>/g, "").trim();
            if (text) {
                addLink(text, href);
            }
        }
    };

    // Strategy 1: <aside> elements (most specific for sidebars)
    const asideMatches = html.matchAll(/<aside[^>]*>([\s\S]*?)<\/aside>/gi);
    for (const match of asideMatches) {
        const content = match[1] ?? "";
        // Only process if it looks like navigation (contains multiple links)
        if ((content.match(/<a[^>]*href/gi) || []).length >= 3) {
            extractLinksFromContent(content);
        }
    }

    // Strategy 2: Elements with sidebar-related classes
    if (links.length === 0) {
        const sidebarClassPattern =
            /<(?:nav|div|section)[^>]*class=["'][^"']*(?:sidebar|side-nav|nav-sidebar|docs-nav|toc-nav)[^"']*["'][^>]*>([\s\S]*?)<\/(?:nav|div|section)>/gi;
        const sidebarMatches = html.matchAll(sidebarClassPattern);
        for (const match of sidebarMatches) {
            const content = match[1] ?? "";
            extractLinksFromContent(content);
        }
    }

    // Strategy 3: [role="navigation"] that appears to be a sidebar (not header nav)
    if (links.length === 0) {
        // First, remove header content to avoid picking up header navigation
        const htmlWithoutHeader = html.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "");
        const roleNavMatches = htmlWithoutHeader.matchAll(
            /<(?:nav|div)[^>]*role=["']navigation["'][^>]*>([\s\S]*?)<\/(?:nav|div)>/gi
        );
        for (const match of roleNavMatches) {
            const content = match[1] ?? "";
            // Only use if it has multiple links (likely a sidebar, not a simple nav)
            if ((content.match(/<a[^>]*href/gi) || []).length >= 5) {
                extractLinksFromContent(content);
                break; // Use first substantial navigation found
            }
        }
    }

    // Strategy 4: Look for navigation lists with doc-like structure
    if (links.length === 0) {
        const navListPattern =
            /<(?:ul|ol)[^>]*class=["'][^"']*(?:nav|menu|docs|pages)[^"']*["'][^>]*>([\s\S]*?)<\/(?:ul|ol)>/gi;
        const navListMatches = html.matchAll(navListPattern);
        for (const match of navListMatches) {
            const content = match[1] ?? "";
            if ((content.match(/<a[^>]*href/gi) || []).length >= 5) {
                extractLinksFromContent(content);
                break;
            }
        }
    }

    return links;
}

/**
 * Extracts the base domain from HTML (from canonical or og:url).
 */
function getBaseDomain(html: string): string {
    const canonicalMatch = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
    if (canonicalMatch?.[1]) {
        try {
            return new URL(canonicalMatch[1]).hostname;
        } catch {
            // Invalid URL
        }
    }
    const ogUrlMatch = html.match(/<meta[^>]*property=["']og:url["'][^>]*content=["']([^"']+)["']/i);
    if (ogUrlMatch?.[1]) {
        try {
            return new URL(ogUrlMatch[1]).hostname;
        } catch {
            // Invalid URL
        }
    }
    return "";
}

/**
 * Detects the current version displayed on the page.
 * Looks for:
 * 1. Selected option in version <select> dropdown
 * 2. [data-version] attribute value
 * 3. .version-badge or .version-selector text
 * 4. Version patterns in prominent badges
 *
 * @returns Version string (e.g., "v2") or undefined if not found
 */
export function detectVersion(html: string): string | undefined {
    // Strategy 1: Version select dropdown with selected option
    const selectMatch = html.match(
        /<select[^>]*(?:class|id|name)=["'][^"']*version[^"']*["'][^>]*>([\s\S]*?)<\/select>/i
    );
    if (selectMatch?.[1]) {
        const selectedMatch = selectMatch[1].match(/<option[^>]*selected[^>]*>([^<]+)</i);
        if (selectedMatch?.[1]) {
            const version = extractVersionString(selectedMatch[1]);
            if (version) {
                return version;
            }
        }
    }

    // Strategy 2: data-version attribute
    const dataVersionMatch = html.match(/data-version=["']([^"']+)["']/i);
    if (dataVersionMatch?.[1]) {
        const version = extractVersionString(dataVersionMatch[1]);
        if (version) {
            return version;
        }
    }

    // Strategy 3: .version-badge or .version-selector class
    const badgeMatch = html.match(/<[^>]*class=["'][^"']*version-(?:badge|selector|tag|pill)[^"']*["'][^>]*>([^<]+)</i);
    if (badgeMatch?.[1]) {
        const version = extractVersionString(badgeMatch[1]);
        if (version) {
            return version;
        }
    }

    // Strategy 4: Version in a button or dropdown trigger near "version" text
    const versionTriggerMatch = html.match(/(?:version|release)[^>]*>([^<]*v\d[^<]*)</i);
    if (versionTriggerMatch?.[1]) {
        const version = extractVersionString(versionTriggerMatch[1]);
        if (version) {
            return version;
        }
    }

    return undefined;
}

/**
 * Extracts a version string from text.
 * Matches patterns like: v1, v2.0, v1.2.3, 2.0, latest
 */
function extractVersionString(text: string): string | undefined {
    const trimmed = text.trim();

    // Match "latest" as a version
    if (/^latest$/i.test(trimmed)) {
        return "latest";
    }

    // Match v-prefixed versions: v1, v2, v1.0, v2.0.1
    const vMatch = trimmed.match(/\b(v\d+(?:\.\d+)*)/i);
    if (vMatch?.[1]) {
        return vMatch[1].toLowerCase();
    }

    // Match bare version numbers: 1.0, 2.0.1
    const numMatch = trimmed.match(/\b(\d+\.\d+(?:\.\d+)?)\b/);
    if (numMatch?.[1]) {
        return numMatch[1];
    }

    return undefined;
}

/**
 * Infers the page type based on content patterns.
 * Uses heuristics to classify as:
 * - "reference": API docs, endpoint references, schema documentation
 * - "guide": How-to guides, tutorials, step-by-step instructions
 * - "overview": Landing pages, introductions, index pages
 * - "unknown": Cannot determine
 *
 * @returns Inferred PageType
 */
export function inferPageType(html: string): PageType {
    const text = extractTextPreview(html, 1000);

    // Reference indicators: HTTP methods, parameter tables, code-heavy
    const hasHttpMethods = /\b(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+[/\w]/.test(html);
    const hasParamTable = /<table[^>]*>[\s\S]*?(?:parameter|param|field|type|required|optional)/i.test(html);
    const hasCodeBlocks = (html.match(/<pre/gi) || []).length > 2;
    const hasEndpointPath = /["'`]\/[a-z]+\/\{[a-z_]+\}["'`]/i.test(html);

    if (hasHttpMethods || hasEndpointPath || (hasParamTable && hasCodeBlocks)) {
        return "reference";
    }

    // Guide indicators: step-by-step, how-to, tutorial language
    const hasSteps = /step\s*[1-9]|step\s*\d+:/i.test(text);
    const hasHowTo = /how\s+to\b/i.test(text);
    const hasNumberedList = /<ol[^>]*>[\s\S]*?<li/i.test(html);
    const hasTutorialLanguage = /\b(tutorial|walkthrough|getting\s+started|quick\s*start)\b/i.test(text);

    if (hasSteps || hasHowTo || (hasNumberedList && hasTutorialLanguage)) {
        return "guide";
    }

    // Overview indicators: short content, many links, intro language
    const linkCount = (html.match(/<a\s+href/gi) || []).length;
    const hasOverviewLanguage = /\b(overview|introduction|welcome|about|what\s+is)\b/i.test(text);
    const isShort = text.length < 500;

    if (isShort && linkCount > 5 && hasOverviewLanguage) {
        return "overview";
    }

    // Additional check: if page has overview language but isn't short, still might be overview
    if (hasOverviewLanguage && linkCount > 8) {
        return "overview";
    }

    return "unknown";
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
    return {
        url: page.url,
        urlPathSegments: extractUrlPathSegments(page.url),
        pageTitle: page.title,
        breadcrumbPath: extractBreadcrumbPath(page.html),
        siteNavigationLinks: extractSiteNavigationLinks(page.html),
        detectedVersion: detectVersion(page.html),
        inferredPageType: inferPageType(page.html),
        contentSnippet: extractTextPreview(page.html, 400)
    };
}

// ============================================================================
// Phase 1: Site Structure Discovery
// Aggregates signals from ALL pages and uses LLM to identify products, versions, tabs.
// ============================================================================

/**
 * Aggregates navigation signals from all pages.
 * Extracts and deduplicates breadcrumbs, nav links, versions, sidebar signals,
 * header navigation items (tabs), and sidebar section groupings.
 */
export function aggregateNavigationSignals(pages: Map<string, PageNode>): AggregatedSignals {
    const breadcrumbRoots = new Set<string>();
    const navLinks = new Set<string>();
    const versions = new Set<string>();
    const breadcrumbPaths: string[][] = [];
    const sidebarSignals: SidebarSignal[] = [];

    for (const page of pages.values()) {
        const breadcrumbs = extractBreadcrumbPath(page.html);
        if (breadcrumbs.length > 0) {
            // Collect the root (first non-home item) for structure analysis
            const root = breadcrumbs.find((b) => b.toLowerCase() !== "home" && b.toLowerCase() !== "docs");
            if (root) {
                breadcrumbRoots.add(root);
            }
            // Keep a sample of full paths (limit to 20)
            if (breadcrumbPaths.length < 20) {
                breadcrumbPaths.push(breadcrumbs);
            }
        }

        const pageNavLinks = extractSiteNavigationLinks(page.html);
        for (const link of pageNavLinks) {
            navLinks.add(link);
        }

        const version = detectVersion(page.html);
        if (version) {
            versions.add(version);
        }

        // Extract ordered sidebar links for navigation ordering
        const sidebarLinks = extractOrderedSidebarLinks(page.html, page.url);
        if (sidebarLinks.length > 0) {
            sidebarSignals.push({ url: page.url, links: sidebarLinks });
        }
    }

    return {
        uniqueBreadcrumbRoots: Array.from(breadcrumbRoots),
        uniqueNavLinks: Array.from(navLinks),
        uniqueVersions: Array.from(versions),
        sampleBreadcrumbPaths: breadcrumbPaths,
        sidebarSignals
    };
}

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
                urlPattern: z.string().optional().describe("URL keyword if present (e.g., 'guides', 'api')")
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
                    .describe("Page URLs in the intended navigation order for this context, based on sidebar signals")
            })
        )
        .describe(
            "Page ordering per navigation context. Use sidebar navigation signals to determine the correct order. " +
                "Each unique combination of product/version/tab should have its own ordering. " +
                "For simple sites, use a single entry with empty contextKey."
        )
});

/**
 * Formats sidebar signals for the LLM prompt.
 * Groups by URL and shows the ordered navigation links.
 */
function formatSidebarSignals(sidebarSignals: SidebarSignal[], maxSignals: number = 10): string {
    if (sidebarSignals.length === 0) {
        return "(no sidebar navigation found)";
    }

    // Sample a representative subset of sidebar signals
    const sampled = sidebarSignals.slice(0, maxSignals);
    const lines: string[] = [];

    for (const signal of sampled) {
        lines.push(`Page: ${signal.url}`);
        for (let i = 0; i < Math.min(signal.links.length, 15); i++) {
            const link = signal.links[i];
            if (link) {
                lines.push(`  ${i + 1}. ${link.href} - ${link.text}`);
            }
        }
        if (signal.links.length > 15) {
            lines.push(`  ... and ${signal.links.length - 15} more links`);
        }
        lines.push("");
    }

    if (sidebarSignals.length > maxSignals) {
        lines.push(`... and ${sidebarSignals.length - maxSignals} more pages with sidebar navigation`);
    }

    return lines.join("\n");
}

/**
 * Formats all unique navigation links for the LLM prompt.
 * Groups links by URL prefix to help identify tabs and sections.
 */
function formatAllNavLinks(sidebarSignals: SidebarSignal[]): string {
    if (sidebarSignals.length === 0) {
        return "(no navigation links found)";
    }

    // Collect all unique links across all pages
    const allLinks = new Map<string, string>(); // href -> text
    for (const signal of sidebarSignals) {
        for (const link of signal.links) {
            if (!allLinks.has(link.href)) {
                allLinks.set(link.href, link.text);
            }
        }
    }

    // Group by first URL segment to show structure
    const byPrefix = new Map<string, Array<{ href: string; text: string }>>();
    for (const [href, text] of allLinks) {
        try {
            const pathname = new URL(href).pathname;
            const segments = pathname.split("/").filter(Boolean);
            const prefix = segments[0] ?? "(root)";
            if (!byPrefix.has(prefix)) {
                byPrefix.set(prefix, []);
            }
            byPrefix.get(prefix)!.push({ href: pathname, text });
        } catch {
            // Skip invalid URLs
        }
    }

    const lines: string[] = [];
    for (const [prefix, links] of byPrefix) {
        lines.push(`\n/${prefix}/:`);
        for (const link of links.slice(0, 15)) {
            lines.push(`  - "${link.text}" → ${link.href}`);
        }
        if (links.length > 15) {
            lines.push(`  ... and ${links.length - 15} more`);
        }
    }

    return lines.join("\n");
}

/**
 * Builds the Phase 1 prompt for site structure analysis.
 * @param allUrls - All page URLs (as pathnames)
 * @param aggregatedSignals - Aggregated navigation signals from all pages
 * @param entryPointUrl - The entry point URL where the crawl started (as pathname)
 */
export function buildSiteStructurePrompt(
    allUrls: string[],
    aggregatedSignals: AggregatedSignals,
    entryPointUrl?: string
): string {
    // Extract unique top-level path segments for product hint
    const topLevelSegments = new Set<string>();
    for (const url of allUrls) {
        const segments = url.split("/").filter(Boolean);
        if (segments.length > 0 && segments[0]) {
            topLevelSegments.add(segments[0]);
        }
    }

    return `Analyze this documentation site's structure to identify products, versions, tabs, and determine page ordering.

ENTRY POINT URL: ${entryPointUrl ?? "(not specified)"}
This is the URL where the user started the crawl. Consider this when determining page ordering.

URL PATTERNS (${allUrls.length} pages):
${allUrls.slice(0, 100).join("\n")}
${allUrls.length > 100 ? `\n... and ${allUrls.length - 100} more pages` : ""}

TOP-LEVEL URL SEGMENTS: ${Array.from(topLevelSegments).join(", ")}

=== ALL NAVIGATION LINKS (grouped by URL prefix) ===
These are all unique links found in navigation, grouped by their first URL segment:
${formatAllNavLinks(aggregatedSignals.sidebarSignals)}

=== OTHER NAVIGATION SIGNALS ===
- Unique breadcrumb roots: ${aggregatedSignals.uniqueBreadcrumbRoots.length > 0 ? aggregatedSignals.uniqueBreadcrumbRoots.join(", ") : "(none found)"}
- Unique nav links: ${aggregatedSignals.uniqueNavLinks.length > 0 ? aggregatedSignals.uniqueNavLinks.join(", ") : "(none found)"}
- Versions detected: ${aggregatedSignals.uniqueVersions.length > 0 ? aggregatedSignals.uniqueVersions.join(", ") : "(none found)"}

SAMPLE BREADCRUMB PATHS:
${
    aggregatedSignals.sampleBreadcrumbPaths
        .slice(0, 10)
        .map((p) => "  " + p.join(" > "))
        .join("\n") || "(none found)"
}

SIDEBAR NAVIGATION ORDER (for page ordering):
${formatSidebarSignals(aggregatedSignals.sidebarSignals)}

=== HOW TO IDENTIFY TABS ===
Tabs are the top-level navigation categories. Identify them by analyzing:

1. **Content types** - Different content types often get their own tab:
   - Landing/Welcome pages → "Docs" or "Home" tab
   - Tutorials and how-to guides → "Guides" tab
   - API endpoint documentation → "API Reference" tab
   - Release notes → "Changelog" tab

2. **Link text** - Navigation text like "Docs", "Guides", "API Reference" indicates tabs

3. **URL groupings** - Pages sharing a URL prefix may belong to the same tab

A tab can contain a single page (like a Welcome page) or many sections with multiple pages.

**SECTIONS** are groupings WITHIN a tab (determined in Phase 2, not here).

INSTRUCTIONS:
1. **Products**: Look at TOP-LEVEL URL SEGMENTS for distinct documentation areas.
   - urlPrefix MUST be the exact URL segment (lowercase)
   - If all pages share one top-level segment, leave products empty

2. **Versions**: Look for URL patterns like /v1/, /v-1/, /latest/
   - urlPattern MUST be the exact URL segment

3. **Tabs**: Identify top-level navigation categories
   - Analyze both link text AND URL patterns
   - urlPattern is optional - use if there's a clear URL segment
   - Don't miss landing/home pages - they often deserve their own "Docs" or "Home" tab
   - A site with Welcome + Guides + API typically has 3 tabs, not 2

4. **Context Orderings**: Determine page order per tab
   - Use SIDEBAR NAVIGATION ORDER for page sequence
   - A context is "product:version:tab" (empty string for simple sites)
   - Order introductory content first

Return JSON with products, versions, tabs, and contextOrderings arrays.`;
}

/**
 * Phase 1: Analyzes the site structure from all URLs and aggregated signals.
 * Returns the discovered products, versions, tabs, and context orderings.
 * @param pages - Map of URL to PageNode
 * @param model - Language model for LLM analysis
 * @param entryPointUrl - Optional entry point URL where crawl started
 */
export async function analyzeSiteStructure(
    pages: Map<string, PageNode>,
    model: LanguageModelV1,
    entryPointUrl?: string
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

    // Aggregate signals from all pages
    const aggregatedSignals = aggregateNavigationSignals(pages);

    // Call LLM to analyze structure
    const { object } = await generateObject({
        model,
        schema: siteStructureSchema,
        prompt: buildSiteStructurePrompt(allUrls, aggregatedSignals, entryPointPathname)
    });

    return {
        products: object.products,
        versions: object.versions,
        tabs: object.tabs.map((t) => ({
            name: t.name,
            urlPattern: t.urlPattern
        })),
        contextOrderings: object.contextOrderings.map((co) => ({
            contextKey: co.contextKey,
            orderedUrls: co.orderedUrls
        }))
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
 * Schema for Phase 2 classification.
 * Classifies tab, section, and isApiReference for each page.
 */
const sectionClassificationSchema = z.object({
    pages: z
        .array(
            z.object({
                url: z.string().describe("The URL of the page being classified"),
                tab: z
                    .string()
                    .describe(
                        "Tab name from discovered tabs. Use exact tab name. " +
                            "Assign 'Docs' or 'Home' tabs ONLY to landing/welcome pages. " +
                            "Assign 'Guides' to main documentation content. " +
                            "Assign 'API Reference' to API docs."
                    ),
                section: z
                    .string()
                    .describe(
                        "Section name for grouping (e.g., 'Getting Started', 'Authentication'). " +
                            "Use empty string '' for standalone pages that should appear at top level."
                    ),
                isApiReference: z
                    .boolean()
                    .describe("Whether this is an API reference page (endpoint docs, schemas, etc.)"),
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

/**
 * Context for Phase 2 classification, includes derived product/version.
 * Tab is assigned by the LLM in Phase 2, not derived deterministically.
 */
interface Phase2PageContext extends PageContext {
    derivedProduct?: string;
    derivedVersion?: string;
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

    if (ctx.breadcrumbPath.length > 0) {
        lines.push(`    Breadcrumbs: ${ctx.breadcrumbPath.join(" > ")}`);
    }

    lines.push(`    Page type hint: ${ctx.inferredPageType}`);
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

    return `Classify these ${contexts.length} documentation pages into tabs and sections.

DISCOVERED TABS:
${tabDescriptions || "No tabs discovered - use 'default' as tab name"}

${structureSummary.length > 0 ? `SITE STRUCTURE:\n${structureSummary.join("\n")}\n` : ""}
PAGES TO CLASSIFY:
${pagesContext}

INSTRUCTIONS:
For each page, determine:

1. **tab**: Which tab does this page belong to?
   CRITICAL TAB ASSIGNMENT RULES:
   - "Docs" or "Home" tabs are ONLY for landing/welcome pages (typically 1-2 pages)
   - "Guides" tabs get the BULK of documentation content:
     * Getting Started, Overview, Quickstart pages
     * Tutorials and how-to guides  
     * Feature documentation (capabilities, concepts)
     * Changelog entries
   - "API Reference" tabs are for API endpoint documentation
   - When in doubt between "Docs" and "Guides", choose "Guides" (it's the main content tab)
   - Use the exact tab name from DISCOVERED TABS above

2. **section**: Group related pages together OR use empty string "" for standalone pages
   - Use section names like "Getting Started", "Capabilities", "Tutorials" to group related pages
   - Use empty string "" for standalone pages at tab's top level
   - Use breadcrumbs as hints for section names
   - Common sections: "Getting Started", "Capabilities", "Tutorials", "Changelog"

3. **isApiReference**: Is this an API reference page?
   - TRUE for: endpoint documentation, API schemas, method references
   - FALSE for: guides about APIs, tutorials, conceptual docs

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
 */
async function classifySectionBatch(
    contexts: Phase2PageContext[],
    structure: SiteStructure,
    model: LanguageModelV1
): Promise<Map<string, { tab: string; section: string; isApiReference: boolean; cleanTitle: string }>> {
    const results = new Map<string, { tab: string; section: string; isApiReference: boolean; cleanTitle: string }>();

    const { object } = await generateObject({
        model,
        schema: sectionClassificationSchema,
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
    const { concurrency = 3, onProgress, maxGroupSize = 16 } = options;
    const { pages, rootUrl } = crawlResult;

    const total = pages.size;
    let llmCalls = 0;
    const warnings: string[] = [];

    // ========================================================================
    // PHASE 1: Site Structure Discovery
    // ========================================================================
    const structure = await analyzeSiteStructure(pages, model, rootUrl);
    llmCalls += 1;

    // Log discovered structure (info, not warnings)
    console.log(
        `[classifier] Phase 1 discovered: ${structure.products.length} product(s), ${structure.versions.length} version(s), ${structure.tabs.length} tab(s)`
    );
    if (structure.products.length > 0) {
        console.log(`  Products: ${structure.products.map((p) => `${p.name} (/${p.urlPrefix}/)`).join(", ")}`);
    }
    if (structure.versions.length > 0) {
        console.log(`  Versions: ${structure.versions.map((v) => `${v.name} (/${v.urlPattern}/)`).join(", ")}`);
    }
    if (structure.tabs.length > 0) {
        console.log(`  Tabs: ${structure.tabs.map((t) => t.name).join(", ")}`);
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
