import "server-only";

import { type createCachedDocsLoader, createPruneKey } from "@fern-api/docs-loader";
import type { FernNavigation } from "@fern-api/fdr-sdk";
import * as ApiDefinition from "@fern-api/fdr-sdk/api-definition";

import type { ApiGroup } from "./flatten-apis";

export async function filterToEndpointsIncludedInExplorer(
    loader: Awaited<ReturnType<typeof createCachedDocsLoader>>,
    apiGroups: ApiGroup[]
): Promise<ApiGroup[]> {
    const keyFor = (item: FernNavigation.NavigationNodeApiLeaf) => `${String(item.apiDefinitionId)}:${String(item.id)}`;

    const promiseByKey = new Map<string, Promise<ApiDefinition.ApiDefinition>>();
    for (const group of apiGroups) {
        for (const item of group.items) {
            if (item.type !== "endpoint") {
                continue;
            }
            const key = keyFor(item);
            if (!promiseByKey.has(key)) {
                promiseByKey.set(key, loader.getPrunedApi(item.apiDefinitionId, createPruneKey(item)));
            }
        }
    }

    const entries = Array.from(promiseByKey.entries());
    const resolved = await Promise.all(entries.map(([, p]) => p));
    const apiByKey = new Map<string, ApiDefinition.ApiDefinition>(entries.map(([k], i) => [k, resolved[i]!]));

    const filtered = apiGroups
        .map((group) => {
            const kept: FernNavigation.NavigationNodeApiLeaf[] = [];
            for (const item of group.items) {
                if (item.type !== "endpoint") {
                    kept.push(item);
                    continue;
                }
                const api = apiByKey.get(keyFor(item));
                const ctx = api ? ApiDefinition.createEndpointContext(item, api) : undefined;
                if (ctx?.endpoint.includeInApiExplorer === false) {
                    continue;
                }
                kept.push(item);
            }
            return { ...group, items: kept };
        })
        .filter((g) => g.items.length > 0);

    return filtered;
}
