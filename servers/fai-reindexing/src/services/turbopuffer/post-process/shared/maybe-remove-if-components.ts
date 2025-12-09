export function maybeRemoveIfComponents(markdown: string): string {
    return removeIfComponents(markdown);
}

function removeIfComponents(markdown: string): string {
    // Remove <If>...</If> blocks (handles multiline content)
    // This regex matches:
    // - <If with any attributes
    // - Any content (including newlines)
    // - Closing </If>
    markdown = markdown.replace(/<If[^>]*>[\s\S]*?<\/If>/g, "");

    // Remove self-closing <If /> tags (less common but should handle)
    markdown = markdown.replace(/<If[^>]*\/>/g, "");

    return markdown;
}
