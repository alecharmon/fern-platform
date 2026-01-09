import type { PageNode } from "./types.js";

/**
 * Sanitizes a slug by replacing filesystem-unsafe characters with dashes.
 * This handles characters that are invalid on various filesystems (Windows, macOS, Linux).
 *
 * @example
 * sanitizeSlug("step-1:-setup") → "step-1-setup"
 * sanitizeSlug("need-inspiration?") → "need-inspiration"
 * sanitizeSlug("foo::bar") → "foo-bar"
 */
export function sanitizeSlug(slug: string): string {
    return (
        slug
            // Replace filesystem-unsafe characters with dashes
            // Includes: : " ? * < > | \
            .replace(/[:"?*<>|\\]/g, "-")
            // Collapse multiple consecutive dashes into one
            .replace(/-+/g, "-")
            // Remove leading/trailing dashes
            .replace(/^-+|-+$/g, "")
    );
}

/**
 * Generates a Fern filename from the page's source slug.
 * The filename preserves the URL structure from the source site.
 * Sanitizes filesystem-unsafe characters.
 *
 * @example
 * generateFernFilename({ slug: "platform/guides/overview" }) → "pages/platform/guides/overview.mdx"
 * generateFernFilename({ slug: "" }) → "pages/index.mdx"
 * generateFernFilename({ slug: "getting-started" }) → "pages/getting-started.mdx"
 * generateFernFilename({ slug: "step-1:-setup" }) → "pages/step-1-setup.mdx"
 */
export function generateFernFilename(page: PageNode): string {
    const slug = page.slug.trim();

    // Root page becomes index.mdx
    if (!slug) {
        return "pages/index.mdx";
    }

    // Ensure slug doesn't have leading/trailing slashes
    const cleanSlug = slug.replace(/^\/+|\/+$/g, "");

    // Sanitize each path segment separately to preserve directory structure
    const sanitizedSlug = cleanSlug
        .split("/")
        .map((segment) => sanitizeSlug(segment))
        .filter((segment) => segment.length > 0)
        .join("/");

    // Handle edge case where sanitization removes everything
    if (!sanitizedSlug) {
        return "pages/index.mdx";
    }

    return `pages/${sanitizedSlug}.mdx`;
}

/**
 * Generates a Fern slug from the page's source slug.
 * Preserves the source site's URL structure.
 * Sanitizes filesystem-unsafe characters.
 *
 * @example
 * generateFernSlug({ slug: "platform/guides/overview" }) → "platform/guides/overview"
 * generateFernSlug({ slug: "" }) → ""
 * generateFernSlug({ slug: "getting-started" }) → "getting-started"
 * generateFernSlug({ slug: "step-1:-setup" }) → "step-1-setup"
 */
export function generateFernSlug(page: PageNode): string {
    // Clean up leading/trailing slashes
    const cleanSlug = page.slug.replace(/^\/+|\/+$/g, "");

    // Sanitize each path segment separately to preserve directory structure
    return cleanSlug
        .split("/")
        .map((segment) => sanitizeSlug(segment))
        .filter((segment) => segment.length > 0)
        .join("/");
}

/**
 * Makes a filename unique by appending a suffix if needed.
 *
 * @example
 * makeUnique("pages/intro.mdx", new Set(["pages/intro.mdx"])) → "pages/intro-2.mdx"
 */
function makeUnique(filename: string, seen: Set<string>): string {
    if (!seen.has(filename)) {
        return filename;
    }

    // Extract base and extension
    const lastDot = filename.lastIndexOf(".");
    const base = lastDot > 0 ? filename.slice(0, lastDot) : filename;
    const ext = lastDot > 0 ? filename.slice(lastDot) : "";

    let counter = 2;
    let candidate = `${base}-${counter}${ext}`;
    while (seen.has(candidate)) {
        counter++;
        candidate = `${base}-${counter}${ext}`;
    }

    return candidate;
}

/**
 * Assigns fernFilename and fernSlug to all pages in the map.
 * Handles filename collisions by appending suffixes.
 *
 * @param pages - Map of URL to PageNode (mutated in place)
 */
export function assignFilenamesAndSlugs(pages: Map<string, PageNode>): void {
    const seenFilenames = new Set<string>();
    const seenSlugs = new Set<string>();

    for (const page of pages.values()) {
        // Generate filename and ensure uniqueness
        let filename = generateFernFilename(page);
        filename = makeUnique(filename, seenFilenames);
        seenFilenames.add(filename);
        page.fernFilename = filename;

        // Generate slug and ensure uniqueness
        let slug = generateFernSlug(page);
        if (seenSlugs.has(slug)) {
            // If slug conflicts, derive from the unique filename
            // e.g., "pages/intro-2.mdx" → "intro-2"
            const filenameBase = filename.replace(/^pages\//, "").replace(/\.mdx$/, "");
            slug = filenameBase;
        }
        seenSlugs.add(slug);
        page.fernSlug = slug;
    }
}

/**
 * Builds a map from source URL to fernSlug for link rewriting.
 *
 * @param pages - Map of URL to PageNode (must have fernSlug assigned)
 * @returns Map of source URL → fernSlug
 */
export function buildUrlToSlugMap(pages: Map<string, PageNode>): Map<string, string> {
    const map = new Map<string, string>();

    for (const [url, page] of pages) {
        if (page.fernSlug !== undefined) {
            map.set(url, page.fernSlug);
        }
    }

    return map;
}
