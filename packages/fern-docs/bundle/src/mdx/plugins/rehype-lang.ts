import type { DocsLoader } from "@fern-api/docs-server/docs-loader";
import {
    CONTINUE,
    type Hast,
    isMdxJsxElementHast,
    type Unified,
    unknownToMdxJsxAttribute,
    visit
} from "@fern-docs/mdx";

/**
 * This plugin injects the `lang` property into components that need it.
 * It centralizes the logic for adding language information across different MDX components.
 */

// List of component names that should receive the lang prop
const COMPONENTS_WITH_LANG = [
    "CodeBlock",
    "CodeGroup",
    "Copy",
    "EndpointRequestSnippet",
    "EndpointResponseSnippet",
    "EndpointSchemaSnippet",
    "RunnableEndpoint"
] as const;

export const rehypeLang: Unified.Plugin<[{ loader: DocsLoader }?], Hast.Root> = (opts) => {
    if (!opts) {
        return;
    }
    const loader = opts.loader;

    return async (ast: Hast.Root) => {
        const promises: Promise<void>[] = [];

        visit(ast, (node) => {
            if (!isMdxJsxElementHast(node)) {
                return CONTINUE;
            }

            // Check if this component should receive the lang prop
            if (node.name && COMPONENTS_WITH_LANG.includes(node.name as any)) {
                promises.push(
                    (async () => {
                        try {
                            const lang = await loader.getLanguage();

                            if (lang) {
                                node.attributes.push(unknownToMdxJsxAttribute("lang", lang));
                            }
                        } catch (e) {
                            console.error(`[rehype-lang] Error loading language for ${node.name} component`, e);
                        }
                    })()
                );
            }

            return CONTINUE;
        });

        if (promises.length > 0) {
            // wait for all promises to resolve before proceeding
            await Promise.all(promises);
        }
    };
};
