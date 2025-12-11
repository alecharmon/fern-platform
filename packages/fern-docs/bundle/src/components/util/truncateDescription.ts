/**
 * Truncates a description to a maximum length with the following priority:
 * 1. Truncate at a newline break if present before maxLength (no ellipsis)
 * 2. Truncate at a sentence break (. ! ?) if present before maxLength (no ellipsis)
 * 3. Truncate at whitespace if present before maxLength (adds ellipsis)
 * 4. Hard truncate at maxLength if no break points found (adds ellipsis)
 *
 * After truncation, removes any remaining newlines and collapses whitespace.
 * Also strips markdown formatting.
 */
export function truncateDescription(description: string | undefined, maxLength = 160): string | undefined {
    if (!description) {
        return undefined;
    }

    const markdownStripped = description.replace(/[*_`#[\]]/g, "").trim();

    if (!markdownStripped) {
        return undefined;
    }

    let truncated: string;
    let addEllipsis = false;

    if (markdownStripped.length <= maxLength) {
        truncated = markdownStripped;
    } else {
        const substring = markdownStripped.substring(0, maxLength);

        const lastNewline = substring.lastIndexOf("\n");
        if (lastNewline > 0) {
            truncated = substring.substring(0, lastNewline);
        } else {
            const sentenceBreakMatch = substring.match(/.*[.!?]/);
            if (sentenceBreakMatch) {
                truncated = sentenceBreakMatch[0];
            } else {
                const lastSpace = substring.lastIndexOf(" ");
                if (lastSpace > 0) {
                    truncated = substring.substring(0, lastSpace);
                    addEllipsis = true;
                } else {
                    truncated = substring;
                    addEllipsis = true;
                }
            }
        }
    }

    const finalText = truncated
        .replace(/\n/g, " ") // Replace newlines with spaces
        .replace(/\s+/g, " ") // Collapse whitespace
        .trim();

    if (!finalText) {
        return undefined;
    }

    return addEllipsis ? finalText + "…" : finalText;
}
