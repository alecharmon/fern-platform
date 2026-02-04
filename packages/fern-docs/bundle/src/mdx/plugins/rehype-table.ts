import { isMdxJsxAttribute, isMdxJsxElementHast, SKIP, type Unified, visit } from "@fern-docs/mdx";

export const rehypeTable: Unified.Plugin<[], any> = () => {
    return (tree) => {
        /**
         * convert <StickyTable><table>...</table></StickyTable> to <table sticky>...</table>
         * convert <SearchableTable><table>...</table></SearchableTable> to <table searchable>...</table>
         * convert <StickySearchableTable><table>...</table></StickySearchableTable> to <table sticky searchable>...</table>
         */
        visit(tree, (node, index, parent) => {
            if (!isMdxJsxElementHast(node)) {
                return;
            }

            if (
                node.name !== "StickyTable" &&
                node.name !== "SearchableTable" &&
                node.name !== "StickySearchableTable"
            ) {
                return;
            }

            if (parent == null || index == null) {
                return;
            }

            // find the table element inside the wrapper
            const tableChild = node.children.find((child) => child.type === "element" && child.tagName === "table");

            if (!tableChild) {
                return;
            }

            if (tableChild.type === "element") {
                if (node.name === "StickyTable") {
                    tableChild.properties.sticky = true;
                } else if (node.name === "SearchableTable") {
                    tableChild.properties.searchable = true;
                } else if (node.name === "StickySearchableTable") {
                    tableChild.properties.sticky = true;
                    tableChild.properties.searchable = true;
                }

                const attributes = node.attributes.filter(isMdxJsxAttribute);
                const placeholderAttr = attributes.find((attr) => attr.name === "placeholder")?.value;
                if (typeof placeholderAttr === "string") {
                    tableChild.properties.placeholder = placeholderAttr;
                }
            }

            // replace the wrapper with the modified table
            parent.children[index] = tableChild;

            return [SKIP, index];
        });
    };
};
