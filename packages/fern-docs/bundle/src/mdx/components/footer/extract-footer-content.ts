/**
 * Extracts content from <Footer> tags in an MDX string.
 *
 * This function finds all <Footer>...</Footer> blocks in the description,
 * removes them from the main content, and returns them separately.
 *
 * @param description - The MDX description string that may contain <Footer> tags
 * @returns An object containing the description without footer content and the extracted footer content
 */
export function extractFooterContent(description: string | null | undefined): {
    description: string | null | undefined;
    footerContent: string | null;
} {
    if (!description) {
        return { description, footerContent: null };
    }

    // Match <Footer>...</Footer> blocks, handling nested content
    // This regex handles:
    // - Opening <Footer> tag (with optional whitespace/newlines)
    // - Content inside (captured)
    // - Closing </Footer> tag
    const footerRegex = /<Footer\s*>([\s\S]*?)<\/Footer>/gi;

    const footerMatches: string[] = [];
    let match: RegExpExecArray | null;

    // Extract all footer content
    while ((match = footerRegex.exec(description)) !== null) {
        const content = match[1]?.trim();
        if (content) {
            footerMatches.push(content);
        }
    }

    if (footerMatches.length === 0) {
        return { description, footerContent: null };
    }

    // Remove all <Footer>...</Footer> blocks from the description
    const descriptionWithoutFooter = description.replace(footerRegex, "").trim();

    // Combine all footer content
    const footerContent = footerMatches.join("\n\n");

    return {
        description: descriptionWithoutFooter || null,
        footerContent
    };
}
