import type { DocsLoader } from "@fern-api/docs-server/docs-loader";
import { logger } from "@fern-api/ui-core-utils/logger";
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
        let lang: string | undefined;
        try {
            lang = await loader.getLanguage();
        } catch (e) {
            logger.error("[rehype-lang] Error loading language", e);
            return; // Exit early if we can't get the language
        }

        if (!lang) {
            return; // No language to inject, exit early
        }

        visit(ast, (node) => {
            if (!isMdxJsxElementHast(node)) {
                return CONTINUE;
            }

            // Check if this component should receive the lang prop
            if (node.name && COMPONENTS_WITH_LANG.includes(node.name as any)) {
                node.attributes.push(unknownToMdxJsxAttribute("lang", lang));
            }

            return CONTINUE;
        });
    };
};
