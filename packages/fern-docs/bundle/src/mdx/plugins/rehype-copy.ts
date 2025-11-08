import type { DocsLoader } from "@fern-api/docs-server/docs-loader";
import {
    CONTINUE,
    type Hast,
    isMdxJsxElementHast,
    SKIP,
    type Unified,
    unknownToMdxJsxAttribute,
    visit
} from "@fern-docs/mdx";

/**
 * This plugin injects the lang property into the Copy button
 */
export const rehypeCopy: Unified.Plugin<[{ loader: DocsLoader }?], Hast.Root> = (opts) => {
    if (!opts) {
        return;
    }
    const loader = opts.loader;

    return async (ast: Hast.Root) => {
        const promises: Promise<void>[] = [];

        visit(ast, (node, index, parent) => {
            if (!isMdxJsxElementHast(node) || index == null || parent == null) {
                return CONTINUE;
            }

            if (node.name === "Copy") {
                promises.push(
                    (async () => {
                        try {
                            const lang = await loader.getLanguage();

                            node.attributes.push(unknownToMdxJsxAttribute("lang", lang));
                        } catch (e) {
                            console.error("[rehype-copy] Error loading language for Copy component", e);
                        }
                    })()
                );

                return SKIP;
            }

            return CONTINUE;
        });

        if (promises.length > 0) {
            // wait for all promises to resolve before proceeding
            await Promise.all(promises);
        }
    };
};
