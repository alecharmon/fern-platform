/**
 * Utility functions for rendering MDX from IR.
 */

/**
 * Escape special MDX characters in text.
 *
 * Handles:
 * - HTML/JSX brackets: < > { }
 * - Code block markers: ``` (prevents unclosed code blocks)
 */
export function escapeMdx(text: string): string {
    return (
        text
            // Escape triple backticks first (code block markers)
            .replace(/```/g, "\\`\\`\\`")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/{/g, "&#123;")
            .replace(/}/g, "&#125;")
    );
}

/**
 * Generate an anchor ID from a Python path.
 * e.g., "requests.models.Response" -> "requests-models-Response"
 */
export function generateAnchorId(path: string): string {
    return path.replace(/\./g, "-");
}

/**
 * Format a type annotation for display, escaping MDX characters.
 */
export function formatTypeAnnotation(type: string | null | undefined): string {
    if (!type) {
        return "";
    }
    return escapeMdx(type);
}

/**
 * Indent a block of text.
 */
export function indent(text: string, spaces: number = 4): string {
    const prefix = " ".repeat(spaces);
    return text
        .split("\n")
        .map((line) => (line.trim() ? prefix + line : line))
        .join("\n");
}

/**
 * Join lines with proper newlines, filtering out empty items.
 */
export function joinLines(...lines: (string | undefined | null)[]): string {
    return lines.filter((line) => line != null && line !== "").join("\n");
}

/**
 * Create MDX frontmatter.
 */
export function createFrontmatter(slug: string, title?: string): string {
    const parts = ["---", `slug: ${slug}`];
    if (title) {
        parts.push(`title: ${title}`);
    }
    parts.push("---");
    return parts.join("\n");
}

/**
 * Escape content for use inside markdown table cells.
 * Pipe characters break table structure and need to be escaped.
 */
export function escapeTableCell(text: string): string {
    return text.replace(/\|/g, "\\|").replace(/\n/g, " ");
}
