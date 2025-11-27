export function maybeRemoveStyleTags(markdown: string): string {
    return markdown
        .replace(/ ?style={{[^}]*}}/g, "")
        .replace(/ ?style="[^}]*"/g, "")
        .replace(/<style>[\s\S]*?<\/style>/g, "");
}
