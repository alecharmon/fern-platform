const EXTRANEOUS_PROPS = ["style", "className", "maxLines", "rightIcon", "leftIcon", "intent", "cols"];

export function maybeRemoveExtraneousProps(markdown: string): string {
    return removeExtraneousProps(markdown);
}

function removeExtraneousProps(markdown: string): string {
    for (const prop of EXTRANEOUS_PROPS) {
        markdown = markdown.replace(new RegExp(` ?${prop}="[^"]*"`), "");
        markdown = markdown.replace(new RegExp(` ?${prop}={[^}]*}`), "");
    }
    return markdown;
}
