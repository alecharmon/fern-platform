export function maybeRemoveCodeBlocks(markdown: string): string {
    return removeCodeBlocks(markdown);
}

function removeCodeBlocks(markdown: string): string {
    return markdown.replace(/<CodeGroup>[\s\S]*?<\/CodeGroup>/g, "").replace(/```[\s\S]*?```/g, "");
}
