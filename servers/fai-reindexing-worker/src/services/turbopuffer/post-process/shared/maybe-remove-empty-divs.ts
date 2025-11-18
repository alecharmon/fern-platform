export function maybeRemoveEmptyDivs(markdown: string): string {
    return removeEmptyDivs(removeEmptyDivs(markdown));
}

function removeEmptyDivs(markdown: string): string {
    return markdown.replace(/<div\s*>(?:\s|\n)*<\/div>/g, "");
}
