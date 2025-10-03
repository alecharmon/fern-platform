export function maybeRemoveClassNameTags(markdown: string): string {
    return markdown.replace(/className=["'][^"']*["']/g, "");
}
