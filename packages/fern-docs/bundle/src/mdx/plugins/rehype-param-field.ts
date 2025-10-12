import { CONTINUE, type Hast, isMdxJsxAttribute, isMdxJsxElementHast, type Unified, visit } from "@fern-docs/mdx";

/**
 * processes ParamField components and sets a title property
 * based on the query, path, body, or header attributes.
 */
export const rehypeParamField: Unified.Plugin<[], Hast.Root> = () => {
    return (ast) => {
        visit(ast, (node) => {
            if (isMdxJsxElementHast(node) && node.name === "ParamField") {
                const attributes = node.attributes.filter(isMdxJsxAttribute);

                const existingTitle = attributes.find((attr) => attr.name === "title");
                if (existingTitle) {
                    return CONTINUE;
                }

                const queryAttr = attributes.find((attr) => attr.name === "query")?.value;
                const pathAttr = attributes.find((attr) => attr.name === "path")?.value;
                const bodyAttr = attributes.find((attr) => attr.name === "body")?.value;
                const headerAttr = attributes.find((attr) => attr.name === "header")?.value;

                let name: string | undefined;
                if (typeof queryAttr === "string") {
                    name = queryAttr;
                } else if (typeof pathAttr === "string") {
                    name = pathAttr;
                } else if (typeof bodyAttr === "string") {
                    name = bodyAttr;
                } else if (typeof headerAttr === "string") {
                    name = headerAttr;
                }

                // only add title if we found a valid name
                if (name != null && name.trim().length > 0) {
                    node.attributes.push({
                        type: "mdxJsxAttribute",
                        name: "title",
                        value: name
                    });
                }
            }
            return CONTINUE;
        });
    };
};
