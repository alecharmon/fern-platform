import {
    CONTINUE,
    type Hast,
    isMdxJsxAttribute,
    isMdxJsxElementHast,
    type Unified,
    unknownToMdxJsxAttribute,
    visit
} from "@fern-docs/mdx";

/**
 * Recursively collects all element IDs nested within a node.
 * Used to track which headers/elements are inside collapsible components
 * so we can expand them when navigating to an anchor.
 */
function collectNestedIds(children: Hast.Content[]): string[] {
    const nestedIds: string[] = [];

    const collect = (items: (Hast.Element | Hast.MdxJsxElement)[]) => {
        items.forEach((item) => {
            if (item.type === "element") {
                if (item.properties?.id) {
                    nestedIds.push(item.properties.id as string);
                }

                if (item.children) {
                    collect(
                        item.children.filter(
                            (child): child is Hast.Element | Hast.MdxJsxElement =>
                                child.type === "element" || child.type === "mdxJsxFlowElement"
                        )
                    );
                }
            } else if (item.type === "mdxJsxFlowElement") {
                const itemId = item.attributes.filter(isMdxJsxAttribute).find((attr) => attr.name === "id");
                if (itemId?.value && typeof itemId.value === "string") {
                    nestedIds.push(itemId.value);
                }

                if (item.children) {
                    collect(
                        item.children.filter(
                            (child): child is Hast.Element | Hast.MdxJsxElement =>
                                child.type === "element" || child.type === "mdxJsxFlowElement"
                        )
                    );
                }
            }
        });
    };

    collect(
        children.filter(
            (child): child is Hast.Element | Hast.MdxJsxElement =>
                child.type === "element" || child.type === "mdxJsxFlowElement"
        )
    );

    return nestedIds;
}

/**
 * Creates a rehype plugin that adds a `nestedHeaders` attribute to specified MDX elements.
 * This allows components like Tabs and Accordions to expand when navigating to an anchor
 * that's nested inside them.
 */
export function createNestedHeadersPlugin(elementNames: string[]): Unified.Plugin<[], Hast.Root> {
    return () => {
        return (ast: Hast.Root) => {
            visit(ast, (node) => {
                if (!isMdxJsxElementHast(node)) {
                    return CONTINUE;
                }

                if (node.name && elementNames.includes(node.name)) {
                    if (node.children.length > 0) {
                        const nestedHeaders = collectNestedIds(node.children);
                        node.attributes.push(unknownToMdxJsxAttribute("nestedHeaders", nestedHeaders));
                    }
                }

                return CONTINUE;
            });
        };
    };
}

// Collect headers nested in accordions so we know when to expand
export const rehypeAccordionNestedHeaders = createNestedHeadersPlugin(["Accordion"]);

// Collect headers nested in tabs so we know when to expand
export const rehypeTabNestedHeaders = createNestedHeadersPlugin(["Tab"]);
