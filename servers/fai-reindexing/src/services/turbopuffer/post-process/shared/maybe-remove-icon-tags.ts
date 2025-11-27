export function maybeRemoveIconTags(markdown: string): string {
    return markdown
        .replace(/<Icon={.*?}/g, "")
        .replace(/icon={<img[^>]*>}/g, "")
        .replace(/icon="[^"]*"/g, "");
}
