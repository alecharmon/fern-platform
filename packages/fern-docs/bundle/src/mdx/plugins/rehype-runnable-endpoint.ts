import type { DocsLoader } from "@fern-api/docs-server/docs-loader";
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

import { extractMethodAndPath } from "@/components/api-reference/endpoints/utils";

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

                console.log("[rehype-runnable-endpoint] Found RunnableEndpoint component", {
                    endpoint: props.endpoint,
                    example: props.example
                });

                // cannot parse non-string endpoint prop
                if (typeof props.endpoint !== "string") {
                    console.warn("[rehype-runnable-endpoint] Endpoint prop is not a string:", props.endpoint);
                    return CONTINUE;
                }

                const extracted = extractMethodAndPath(props.endpoint);

                // cannot parse endpoint prop
                if (extracted == null) {
                    console.warn("[rehype-runnable-endpoint] Could not parse endpoint:", props.endpoint);
                    return CONTINUE;
                }

                const { method, path } = extracted;

                console.log("[rehype-runnable-endpoint] Parsed endpoint", { method, path });

                promises.push(
                    (async () => {
                        try {
                            console.log("[rehype-runnable-endpoint] Fetching endpoint by locator", {
                                method,
                                path,
                                example: props.example
                            });

                            const { endpoint, apiDefinitionId, slugs } = await loader.getEndpointByLocator(
                                method,
                                path,
                                typeof props.example === "string" ? props.example : undefined
                            );

                            console.log("[rehype-runnable-endpoint] Found endpoint definition", {
                                endpointId: endpoint.id,
                                apiDefinitionId,
                                slugs
                            });

                            const { types, globalHeaders, authSchemes } = await loader.getEndpointById(
                                apiDefinitionId,
                                endpoint.id
                            );

                            console.log("[rehype-runnable-endpoint] Loaded types, global headers, and auth schemes", {
                                typesCount: Object.keys(types ?? {}).length,
                                globalHeadersCount: globalHeaders?.length ?? 0,
                                authSchemesCount: authSchemes?.length ?? 0
                            });

                            node.attributes.push(
                                unknownToMdxJsxAttribute("endpointDefinition", endpoint),
                                unknownToMdxJsxAttribute("types", types ?? {}),
                                unknownToMdxJsxAttribute("globalHeaders", globalHeaders ?? []),
                                unknownToMdxJsxAttribute("authSchemes", authSchemes ?? []),
                                unknownToMdxJsxAttribute("endpointSlugs", slugs)
                            );

                            console.log("[rehype-runnable-endpoint] Successfully injected endpoint data");
                        } catch (e) {
                            console.error(
                                `[rehype-runnable-endpoint] Error loading endpoint for ${method} ${path}${props.example ? ` (example: ${props.example})` : ""}`,
                                e
                            );
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
