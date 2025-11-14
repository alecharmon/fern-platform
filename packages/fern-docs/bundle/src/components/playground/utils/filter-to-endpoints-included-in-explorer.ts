import "server-only";

import { type createCachedDocsLoader, createPruneKey } from "@fern-api/docs-loader";
import type { FernNavigation } from "@fern-api/fdr-sdk";
import * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";

import type { ApiGroup } from "./flatten-apis";

export async function filterToEndpointsIncludedInExplorer(
    loader: Awaited<ReturnType<typeof createCachedDocsLoader>>,
    apiGroups: ApiGroup[]
): Promise<ApiGroup[]> {
    const cache = new Map<string, Promise<ApiDefinition.ApiDefinition>>();

    const filteredApiGroups = await Promise.all(
        apiGroups.map(async (group) => {
            const filteredItems = await Promise.all(
                group.items.map(async (item) => {
                    if (item.type === "endpoint") {
                        const cacheKey = `${String(item.apiDefinitionId)}:${String(item.id)}`;
                        let apiPromise = cache.get(cacheKey);

                        if (!apiPromise) {
                            apiPromise = loader.getPrunedApi(item.apiDefinitionId, createPruneKey(item));
                            cache.set(cacheKey, apiPromise);
                        }

                        const api = await apiPromise;
                        const ctx = ApiDefinition.createEndpointContext(item, api);

                        if (ctx?.endpoint.includeInApiExplorer === false) {
                            return null;
                        }
                    }
                    return item;
                })
            );

            return {
                ...group,
                items: filteredItems.filter((item): item is FernNavigation.NavigationNodeApiLeaf => item !== null)
            };
        })
    );

    return filteredApiGroups.filter((group) => group.items.length > 0);
}
