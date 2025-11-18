import { type Hast, isMdxJsxElementHast, type Unified, visit } from "@fern-docs/mdx";

/**
 * Rehype plugin to filter <llms-only> and <llms-ignore> tags for front-end rendering.
 *
 * - <llms-only>: Content is hidden from React (removed entirely)
 * - <llms-ignore>: Content is shown to React (unwrapped, tag removed but children kept)
 */
export const rehypeLlmsFilter: Unified.Plugin<[], Hast.Root> = () => {
    return (ast: Hast.Root) => {
        visit(ast, (node, idx, parent) => {
            if (parent == null || idx == null) {
                return;
            }

            if (isMdxJsxElementHast(node)) {
                // remove <llms-only> tags and their content (hide from React)
                if (node.name === "llms-only") {
                    parent.children.splice(idx, 1);
                    return idx;
                }

                // replace <llms-ignore> with its children (show to React)
                if (node.name === "llms-ignore") {
                    parent.children.splice(idx, 1, ...node.children);
                    return idx;
                }
            }

            return;
        });
    };
};
