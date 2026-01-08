import type { PageNode } from "./types.js";

/**
 * Generates a Fern filename from the page's source slug.
 * The filename preserves the URL structure from the source site.
 *
 * @example
 * generateFernFilename({ slug: "platform/guides/overview" }) → "pages/platform/guides/overview.mdx"
 * generateFernFilename({ slug: "" }) → "pages/index.mdx"
 * generateFernFilename({ slug: "getting-started" }) → "pages/getting-started.mdx"
 */
export function generateFernFilename(page: PageNode): string {
    const slug = page.slug.trim();

    // Root page becomes index.mdx
    if (!slug) {
        return "pages/index.mdx";
    }

    // Ensure slug doesn't have leading/trailing slashes
    const cleanSlug = slug.replace(/^\/+|\/+$/g, "");

    return `pages/${cleanSlug}.mdx`;
}

/**
 * Generates a Fern slug from the page's source slug.
 * Preserves the source site's URL structure.
 *
 * @example
 * generateFernSlug({ slug: "platform/guides/overview" }) → "platform/guides/overview"
 * generateFernSlug({ slug: "" }) → ""
 * generateFernSlug({ slug: "getting-started" }) → "getting-started"
 */
export function generateFernSlug(page: PageNode): string {
    // Use the source slug directly, just clean it up
    return page.slug.replace(/^\/+|\/+$/g, "");
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
