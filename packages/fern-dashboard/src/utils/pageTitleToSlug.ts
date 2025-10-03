/**
 * Converts a page title to a URL-friendly slug
 * @param pageTitle - The page title to convert
 * @returns A URL-friendly slug
 * @throws Error if pageTitle is not a string
 */
export function pageTitleToSlug(pageTitle: string): string {
    // Validate input
    if (typeof pageTitle !== "string") {
        throw new Error("Page title must be a string");
    }

    // Handle empty or whitespace-only strings
    const trimmedTitle = pageTitle.trim();
    if (!trimmedTitle) {
        return "untitled-page";
    }

    const slug = trimmedTitle
        .toLowerCase()
        .replace(/\s+/g, "-") // Replace spaces with hyphens
        .replace(/[^a-z0-9-]/g, "") // Remove non-alphanumeric characters except hyphens
        .replace(/-+/g, "-") // Collapse multiple hyphens
        .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens

    // Fallback if slug becomes empty after sanitization
    return slug || "untitled-page";
}
