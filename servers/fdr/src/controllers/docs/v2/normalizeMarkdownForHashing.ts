/**
 * Normalizes markdown content before hashing to avoid false positives on non-meaningful changes.
 * This function can evolve over time based on how we want to define lastmod updated behavior.
 */
export function normalizeMarkdownForHashing(markdown: string): string {
    return (
        markdown
            // Strip leading/trailing whitespace
            .trim()
            // Normalize internal whitespace (collapse multiple spaces/newlines to single space)
            .replace(/\s+/g, " ")
            // Normalize copyright year references so year bumps aren't flagged as changes
            // Handles: "copyright 2025", "Copyright 2020-2026", "(c) 2025", "© 2025", "© 2020-2026"
            .replace(/(©|copyright|\(c\))\s*\d{4}(\s*[-–]\s*\d{4})?/gi, "$1 YYYY")
            // Lowercase for case-insensitive comparison
            .toLowerCase()
    );
}
