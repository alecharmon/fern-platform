import type { DocsLoader } from "@fern-api/docs-server/docs-loader";
import { logger } from "@fern-api/ui-core-utils/logger";
import { extractMethodAndPath } from "@fern-docs/components/api-reference/endpoints/utils";
import {
    CONTINUE,
    type Hast,
    hastMdxJsxElementHastToProps,
    isMdxJsxElementHast,
    SKIP,
    type Unified,
    unknownToMdxJsxAttribute,
    visit
} from "@fern-docs/mdx";
import { EndpointNotInApiError } from "@/server/remote-renderer/errors";
import { expandHighlightRanges } from "./expand-highlight-ranges";

/**
 * This plugin is used to add the `endpointDefinition`, `slugs`, and `types`
 * props to an `EndpointSchemaSnippet` node. This is necessary to hydrate the
 * `EndpointSchemaSnippet` node with the correct prop values to render.
 */
export const rehypeEndpointSchemaSnippets: Unified.Plugin<[{ loader: DocsLoader }?], Hast.Root> = (opts) => {
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

            // check that the current node is an endpoint snippet
            if (node.name != null && node.name === "EndpointSchemaSnippet") {
                expandHighlightRanges(node);
                const { props } = hastMdxJsxElementHastToProps(node);

                // cannot parse non-string endpoint prop
                if (typeof props.endpoint !== "string") {
                    return CONTINUE;
                }

                const extracted = extractMethodAndPath(props.endpoint);

                // cannot parse endpoint prop
                if (extracted == null) {
                    return CONTINUE;
                }

                const { method, path } = extracted;
                const apiName = typeof props.api === "string" ? props.api.trim() : undefined;

                promises.push(
                    (async () => {
                        try {
                            const { endpoint, apiDefinitionId } = await loader.getEndpointByLocator(
                                method,
                                path,
                                typeof props.example === "string" ? props.example : undefined,
                                apiName
                            );
                            const { types, endpoint: endpointDefinition } = await loader.getEndpointById(
                                apiDefinitionId,
                                endpoint.id
                            );

                            node.attributes.push(
                                unknownToMdxJsxAttribute("endpointDefinition", endpointDefinition),
                                unknownToMdxJsxAttribute("types", types)
                            );
                        } catch (e) {
                            const label = `Could not find endpoint for ${method} ${path}${apiName ? ` in API "${apiName}"` : ""}${props.example ? ` (example: ${props.example})` : ""}`;
                            if (e instanceof EndpointNotInApiError) {
                                // Customer content issue: endpoint referenced in MDX but not in their API definition
                                logger.warn(label, e.message);
                            } else {
                                // Fern bug: scanner failure, shim issue, or unexpected error
                                logger.error(label, e);
                            }
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
