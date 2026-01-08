import type { CrawlOptions, CrawlResult, PageNode } from "./types.js";

/**
 * Normalizes a URL by removing fragments, query params, trailing slashes, and lowercasing the hostname.
 */
export function normalizeUrl(url: string): string {
    const parsed = new URL(url);
    // Remove fragment
    parsed.hash = "";
    // Remove query parameters (for deduplication - docs pages with ?explorer=true are same content)
    parsed.search = "";
    // Remove trailing slash (except for root)
    if (parsed.pathname !== "/" && parsed.pathname.endsWith("/")) {
        parsed.pathname = parsed.pathname.slice(0, -1);
    }
    // Lowercase hostname
    parsed.hostname = parsed.hostname.toLowerCase();
    return parsed.toString();
}

/**
 * Extracts the page title from HTML content.
 * Tries <title> tag first, then <h1>, then falls back to URL path.
 */
export function extractTitle(html: string, url: string): string {
    // Try <title> tag
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch?.[1]) {
        return titleMatch[1].trim();
    }

    // Try first <h1> tag
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (h1Match?.[1]) {
        return h1Match[1].trim();
    }

    // Fall back to URL path
    const parsed = new URL(url);
    const path = parsed.pathname;
    if (path === "/") {
        return parsed.hostname;
    }
    // Convert path to title: /getting-started/intro -> "Intro"
    const lastSegment = path.split("/").filter(Boolean).pop() ?? "";
    return lastSegment.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Extracts the page description from HTML content.
 * Tries meta description tag first, then og:description.
 */
export function extractDescription(html: string): string | undefined {
    // Try <meta name="description"> tag
    const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
    if (descMatch?.[1]) {
        return descMatch[1].trim();
    }

    // Also try the reverse attribute order: content before name
    const descMatch2 = html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']description["']/i);
    if (descMatch2?.[1]) {
        return descMatch2[1].trim();
    }

    // Try og:description
    const ogMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i);
    if (ogMatch?.[1]) {
        return ogMatch[1].trim();
    }

    // Also try the reverse attribute order for og:description
    const ogMatch2 = html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:description["']/i);
    if (ogMatch2?.[1]) {
        return ogMatch2[1].trim();
    }

    return undefined;
}

/**
 * Extracts the URL slug from a URL path.
 * Examples:
 *   https://docs.example.com/getting-started -> "getting-started"
 *   https://docs.example.com/ -> ""
 */
export function extractSlug(url: string): string {
    const parsed = new URL(url);
    const path = parsed.pathname;
    // Remove leading/trailing slashes and return
    return path.replace(/^\/+|\/+$/g, "");
}

/**
 * Extracts the canonical URL from HTML content if present.
 * Looks for <link rel="canonical" href="..."> tag.
 *
 * @param html - The HTML content to search
 * @param baseUrl - The base URL for resolving relative canonical URLs
 * @returns The normalized canonical URL if found and same-origin, null otherwise
 *
 * @example
 * extractCanonicalUrl('<link rel="canonical" href="/docs/intro">', new URL('https://example.com/old'))
 * // Returns: 'https://example.com/docs/intro'
 */
export function extractCanonicalUrl(html: string, baseUrl: URL): string | null {
    // Match <link rel="canonical" href="..."> with rel and href in either order
    const canonicalRegex = /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i;
    const canonicalRegexAlt = /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["'][^>]*>/i;

    const match = html.match(canonicalRegex) ?? html.match(canonicalRegexAlt);
    if (match?.[1]) {
        try {
            const canonical = new URL(match[1], baseUrl);
            // Only return same-origin canonical URLs
            if (canonical.origin === baseUrl.origin) {
                return normalizeUrl(canonical.toString());
            }
        } catch {
            // Invalid URL, ignore
        }
    }
    return null;
}

/**
 * Helper to add a resolved URL to the links set if it's valid and same-origin.
 */
function addLinkIfValid(links: Set<string>, href: string, baseUrl: URL): void {
    // Skip non-http links, anchors, javascript, mailto, tel
    if (
        href.startsWith("#") ||
        href.startsWith("javascript:") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        href.startsWith("data:")
    ) {
        return;
    }

    try {
        // Resolve relative URLs against base
        const resolved = new URL(href, baseUrl);

        // Only include same-origin links
        if (resolved.origin !== baseUrl.origin) {
            return;
        }

        // Only include http/https
        if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
            return;
        }

        // Skip common non-content paths
        const pathname = resolved.pathname.toLowerCase();
        if (pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|css|js|woff|woff2|ttf|eot|pdf|zip|tar|gz)$/i)) {
            return;
        }

        links.add(normalizeUrl(resolved.toString()));
    } catch {
        // Invalid URL, skip
    }
}

/**
 * Extracts all internal links from HTML content.
 * Returns normalized, deduplicated URLs that match the base origin.
 *
 * Extracts links from:
 * 1. href="..." attributes in anchor tags
 * 2. "slug":"..." fields in JSON data (for React/Next.js apps)
 */
export function extractLinks(html: string, baseUrl: URL): string[] {
    const links: Set<string> = new Set();

    // 1. Extract from href attributes in anchor tags
    const hrefRegex = /href=["']([^"']+)["']/gi;
    let match: RegExpExecArray | null;

    while ((match = hrefRegex.exec(html)) !== null) {
        const href = match[1];
        if (href) {
            addLinkIfValid(links, href, baseUrl);
        }
    }

    // 2. Extract from JSON slug fields (for React/Next.js apps like Fern docs)
    // Matches patterns like "slug":"platform/guides/overview" (unescaped quotes)
    const slugRegex = /"slug"\s*:\s*"([^"]+)"/gi;
    while ((match = slugRegex.exec(html)) !== null) {
        const slug = match[1];
        if (slug && !slug.startsWith("http")) {
            // Construct URL from slug (add leading slash if missing)
            const href = slug.startsWith("/") ? slug : "/" + slug;
            addLinkIfValid(links, href, baseUrl);
        }
    }

    // 3. Extract from JSON slug fields with escaped quotes (for Next.js RSC payloads)
    // Matches patterns like \"slug\":\"platform/guides/overview\" (escaped quotes in serialized JSON)
    const escapedSlugRegex = /\\"slug\\"\s*:\s*\\"([^"\\]+)\\"/gi;
    while ((match = escapedSlugRegex.exec(html)) !== null) {
        const slug = match[1];
        if (slug && !slug.startsWith("http")) {
            // Construct URL from slug (add leading slash if missing)
            const href = slug.startsWith("/") ? slug : "/" + slug;
            addLinkIfValid(links, href, baseUrl);
        }
    }

    return Array.from(links);
}

interface QueueItem {
    url: string;
    depth: number;
}

/**
 * Performs a BFS crawl of a website starting from the root URL.
 * Returns a graph of pages with their content and link relationships.
 */
export async function crawlSite(options: CrawlOptions): Promise<CrawlResult> {
    const { rootUrl, maxPages, maxDepth, onProgress } = options;

    // Normalize the root URL
    const normalizedRoot = normalizeUrl(rootUrl);

    // Initialize data structures
    const pages = new Map<string, PageNode>();
    const edges = new Map<string, string[]>();
    const backlinks = new Map<string, string[]>();
    const visited = new Set<string>();
    const queued = new Set<string>(); // Track URLs already in queue to avoid duplicates
    const queue: QueueItem[] = [{ url: normalizedRoot, depth: 0 }];
    queued.add(normalizedRoot);
    const warnings: string[] = [];
    let maxDepthExceededCount = 0;

    while (queue.length > 0 && pages.size < maxPages) {
        const item = queue.shift();
        if (!item) {
            break;
        }

        const { url, depth } = item;

        // Skip if already visited
        if (visited.has(url)) {
            continue;
        }
        visited.add(url);

        try {
            // Fetch the page
            const response = await fetch(url, {
                headers: {
                    "User-Agent": "fern/site-to-docs/1.0",
                    Accept: "text/html,application/xhtml+xml"
                }
            });

            // Skip non-HTML responses
            const contentType = response.headers.get("content-type") ?? "";
            if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
                continue;
            }

            // Skip non-2xx responses
            if (!response.ok) {
                continue;
            }

            // Get the final URL after redirects and normalize it
            const finalUrl = normalizeUrl(response.url);

            // Skip if we've already crawled this destination (via a different redirect)
            if (pages.has(finalUrl)) {
                continue;
            }

            // Also mark final URL as visited to avoid re-crawling via different paths
            visited.add(finalUrl);

            const html = await response.text();

            // Check for canonical URL - if this page declares a different canonical,
            // and we've already seen that canonical, skip this page as a duplicate
            const canonicalUrl = extractCanonicalUrl(html, new URL(finalUrl));
            if (canonicalUrl && canonicalUrl !== finalUrl) {
                // If canonical URL is already visited or in pages, this is a duplicate
                if (visited.has(canonicalUrl) || pages.has(canonicalUrl)) {
                    continue;
                }
                // Mark canonical as visited so we prefer it if we encounter it later
                visited.add(canonicalUrl);
            }

            // Create page node using the final URL (after redirects)
            const pageNode: PageNode = {
                url: finalUrl,
                slug: extractSlug(finalUrl),
                title: extractTitle(html, finalUrl),
                description: extractDescription(html),
                html,
                children: []
            };

            pages.set(finalUrl, pageNode);

            // Extract and process links (use finalUrl as the canonical source)
            const links = extractLinks(html, new URL(finalUrl));
            edges.set(finalUrl, links);

            // Build backlinks
            for (const link of links) {
                const existing = backlinks.get(link) ?? [];
                existing.push(finalUrl);
                backlinks.set(link, existing);
            }

            // Add unvisited links to queue (if within depth limit)
            if (depth < maxDepth) {
                for (const link of links) {
                    if (!visited.has(link) && !queued.has(link)) {
                        queue.push({ url: link, depth: depth + 1 });
                        queued.add(link);
                    }
                }
            } else {
                // Track links that weren't added due to depth limit
                for (const link of links) {
                    if (!visited.has(link) && !queued.has(link)) {
                        maxDepthExceededCount++;
                    }
                }
            }

            // Report progress
            onProgress?.(pages.size, queue.length);
        } catch {
            // Log and continue on fetch errors
            // In a real implementation, might want to track failed URLs
        }
    }

    // Generate warnings for exceeded limits
    if (pages.size >= maxPages && queue.length > 0) {
        warnings.push(
            `maxPages limit (${maxPages}) reached with ${queue.length} URLs still in queue. Consider increasing --max-pages to crawl more pages.`
        );
    }

    if (maxDepthExceededCount > 0) {
        warnings.push(
            `maxDepth limit (${maxDepth}) reached. ${maxDepthExceededCount} URLs were not added to the queue due to depth limit. Consider increasing --max-depth to crawl deeper.`
        );
    }

    return { pages, edges, backlinks, warnings, rootUrl: normalizedRoot };
}
