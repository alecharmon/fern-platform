import type { ShikiTransformer } from "shiki";

export const transformerShrinkIndent = (): ShikiTransformer => ({
    name: "indent",
    span(hast, _, __, lineElement) {
        const child = hast.children[0];
        if (!child || child.type !== "text") {
            return;
        }
        const textChild = child as { type: "text"; value: string };
        if (!textChild.value) {
            return;
        }
        if (textChild.value.trim().length !== 0) {
            return;
        }
        if (lineElement.children.length !== 0) {
            return;
        }
        hast.children[0] = {
            type: "text",
            value: textChild.value.replace(/\s\s/g, " ")
        };
    }
});
