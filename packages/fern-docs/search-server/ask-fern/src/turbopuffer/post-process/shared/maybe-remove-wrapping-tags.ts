const WRAPPING_TAGS = ["Info", "AccordionGroup", "Accordion", "Cards", "CardGroup", "ButtonGroup", "Note"];

export function maybeRemoveWrappingTags(markdown: string): string {
    return removeWrappingTags(markdown);
}

function removeWrappingTags(markdown: string): string {
    for (const tag of WRAPPING_TAGS) {
        // eslint-disable-next-line no-useless-escape
        markdown = markdown.replace(new RegExp(`<${tag}\s*>`), "\n");
        markdown = markdown.replace(new RegExp(`</${tag}>`), "\n");
    }
    return markdown;
}
