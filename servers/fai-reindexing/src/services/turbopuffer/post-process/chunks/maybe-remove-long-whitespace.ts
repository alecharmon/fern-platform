export function maybeRemoveLongWhitespace(markdown: string): string {
    return removeLongWhitespace(markdown);
}

function removeLongWhitespace(markdown: string): string {
    let processed = markdown.replace(/\n{3,}/g, "\n\n");
    processed = processed.replace(/ {2,}/g, " ");
    processed = processed.replace(/\t+/g, " ");
    processed = processed.replace(/\n /g, "\n");
    return processed;
}
