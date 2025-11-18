export function maybeRemoveDuplicateNewlines(markdown: string): string {
    return removeDuplicateNewlines(markdown);
}

function removeDuplicateNewlines(markdown: string): string {
    return markdown.replace(/\n{2,}/g, "\n");
}
