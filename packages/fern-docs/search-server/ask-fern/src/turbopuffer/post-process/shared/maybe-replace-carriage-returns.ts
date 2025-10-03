export function maybeReplaceCarriageReturns(markdown: string): string {
    return replaceCarriageReturns(markdown);
}

function replaceCarriageReturns(markdown: string): string {
    return markdown.replace(/\r/g, "\n");
}
