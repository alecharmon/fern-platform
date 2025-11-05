import { type Hast, isMdxJsxElementHast, SKIP, type Unified, visit } from "@fern-docs/mdx";

/**
 * Extracts all <style> tags from the MDX tree and collects their CSS content.
 * The styles are removed from the tree and collected in an array that can be
 * injected into the document head during server-side rendering.
 */
export const rehypeExtractStyles: Unified.Plugin<[{ collect: (styles: string[]) => void }], Hast.Root> = ({
    collect
}) => {
    return (ast: Hast.Root) => {
        const styles: string[] = [];

        visit(ast, (node, index, parent) => {
            const isStyleElement =
                (node.type === "element" && "tagName" in node && node.tagName === "style") ||
                (isMdxJsxElementHast(node) && node.name === "style");

            if (!isStyleElement || index == null || parent == null) {
                return true;
            }

            const parts: string[] = [];
            const children = "children" in node ? node.children : [];

            for (const child of children) {
                if (child.type === "text") {
                    parts.push(child.value);
                } else if (child.type === "mdxFlowExpression" || child.type === "mdxTextExpression") {
                    let cssContent = String(child.value ?? "").trim();
                    if (cssContent.startsWith("`") && cssContent.endsWith("`")) {
                        cssContent = cssContent.slice(1, -1);
                    }
                    parts.push(cssContent);
                }
            }

            const css = parts.join("").trim();
            if (css) {
                styles.push(css);
                parent.children.splice(index, 1);
                return SKIP;
            }

            return true;
        });

        if (styles.length > 0) {
            collect(styles);
        }
    };
};
