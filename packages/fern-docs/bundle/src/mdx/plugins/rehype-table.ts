import { SKIP, type Unified, isMdxJsxElementHast, visit } from "@fern-docs/mdx";

export const rehypeTable: Unified.Plugin<[], any> = () => {
    return (tree) => {
        /**
         * convert <StickyTable><table>...</table></StickyTable> to <table sticky>...</table>
         */
        visit(tree, (node, index, parent) => {
            if (!isMdxJsxElementHast(node) || node.name !== "StickyTable") {
                return;
            }

            if (parent == null || index == null) {
                return;
            }

            // find the table element inside StickyTable
            const tableChild = node.children.find((child) => child.type === "element" && child.tagName === "table");

            if (!tableChild) {
                return;
            }

            if (tableChild.type === "element") {
                tableChild.properties.sticky = true;
            }

            // replace StickyTable with the modified table
            parent.children[index] = tableChild;

            return [SKIP, index];
        });
    };
};
