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

/**
 * This plugin injects the endpoint definition, types, and global headers
 * into the RunnableEndpoint component, similar to how EndpointRequestSnippet works.
 */
export const rehypeRunnableEndpoint: Unified.Plugin<[{ loader: DocsLoader }?], Hast.Root> = (opts) => {
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

            if (node.name === "RunnableEndpoint") {
                const { props } = hastMdxJsxElementHastToProps(node);

                logger.debug("[rehype-runnable-endpoint] Found RunnableEndpoint component", {
                    endpoint: props.endpoint,
                    example: props.example
                });

                // cannot parse non-string endpoint prop
                if (typeof props.endpoint !== "string") {
                    logger.warn("[rehype-runnable-endpoint] Endpoint prop is not a string:", props.endpoint);
                    return CONTINUE;
                }

                const extracted = extractMethodAndPath(props.endpoint);

                // cannot parse endpoint prop
                if (extracted == null) {
                    logger.warn("[rehype-runnable-endpoint] Could not parse endpoint:", props.endpoint);
                    return CONTINUE;
                }

                const { method, path } = extracted;

                logger.debug("[rehype-runnable-endpoint] Parsed endpoint", { method, path });

                promises.push(
                    (async () => {
                        try {
                            const { endpoint, apiDefinitionId, slugs } = await loader.getEndpointByLocator(
                                method,
                                path,
                                typeof props.example === "string" ? props.example : undefined
                            );

                            const { types, globalHeaders, authSchemes } = await loader.getEndpointById(
                                apiDefinitionId,
                                endpoint.id
                            );

                            const { disableExplorerProxy } = await loader.getSettings();

                            node.attributes.push(
                                unknownToMdxJsxAttribute("endpointDefinition", endpoint),
                                unknownToMdxJsxAttribute("types", types ?? {}),
                                unknownToMdxJsxAttribute("globalHeaders", globalHeaders ?? []),
                                unknownToMdxJsxAttribute("authSchemes", authSchemes ?? []),
                                unknownToMdxJsxAttribute("endpointSlugs", slugs),
                                unknownToMdxJsxAttribute("disableProxy", disableExplorerProxy)
                            );
                        } catch (e) {
                            const label = `[rehype-runnable-endpoint] Error loading endpoint for ${method} ${path}${props.example ? ` (example: ${props.example})` : ""}`;
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
