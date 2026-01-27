import { type ApiDefinition, FernNavigation } from "@fern-api/fdr-sdk";
import type { NavigationNodePage } from "@fern-api/fdr-sdk/navigation";
import { measureBytes } from "@fern-api/ui-core-utils";
import { loadApiById } from "@fern-docs/search-utils";
import { groupBy } from "es-toolkit/array";

import type { AlgoliaRecord } from "../types";
import { createBaseRecord } from "./create-base-record";
import { createChangelogRecord } from "./create-changelog-record";
import { createMarkdownRecords } from "./create-markdown-records";
import { createRecordsForApiLeafNode } from "./create-records-for-api-leaf-node";

interface CreateAlgoliaRecordsOptions {
    root: FernNavigation.RootNode;
    domain: string;
    org_id: string;
    pages: Record<FernNavigation.PageId, string>;
    apis: Record<ApiDefinition.ApiDefinitionId, ApiDefinition.ApiDefinition>;
    authed?: (node: NavigationNodePage) => boolean;
}

/**
 * Checks if a node or any of its ancestors is hidden.
 * This ensures that endpoints within hidden API packages are excluded from search indexes.
 */
function isEffectivelyHidden(
    node: FernNavigation.NavigationNodeWithMetadata,
    collector: ReturnType<typeof FernNavigation.NodeCollector.collect>
): boolean {
    if (node.hidden === true) {
        return true;
    }

    const parents = collector.getParents(node.id) ?? [];
    return parents.some((parent) => FernNavigation.hasMetadata(parent) && parent.hidden === true);
}

export async function createAlgoliaRecords({
    root,
    domain,
    org_id,
    pages,
    apis,
    authed
}: CreateAlgoliaRecordsOptions): Promise<{
    records: AlgoliaRecord[];
    /**
     * Records that are >= 100kb
     */
    tooLarge: {
        record: AlgoliaRecord;
        size: number;
    }[];
}> {
    const collector = FernNavigation.NodeCollector.collect(root);

    const versionNodes = collector.getVersionNodes();
    const versionIndexMap = new Map<string, number>();
    for (const [idx, v] of versionNodes.entries()) {
        versionIndexMap.set(v.versionId, idx);
        console.log(`[algolia] version_index: ${v.versionId} -> ${idx}`);
    }

    const pageNodes = Array.from(collector.slugMap.values())
        .filter(FernNavigation.isPage)
        // exclude hidden pages and pages within hidden packages
        .filter((node) => !isEffectivelyHidden(node, collector))
        // exclude pages that are noindexed
        .filter((node) => (FernNavigation.hasMarkdown(node) ? node.noindex !== true : true));

    const markdownNodes = pageNodes.filter(FernNavigation.hasMarkdown);
    const apiLeafNodes = pageNodes.filter(FernNavigation.isApiLeaf);

    const records: AlgoliaRecord[] = [];

    markdownNodes.forEach((node) => {
        const pageId = FernNavigation.getPageId(node);
        if (!pageId) {
            console.error(`Page node ${node.slug} has no page id`);
            return;
        }

        const markdown = pages[pageId];
        if (!markdown) {
            console.error(`Page node ${node.slug} has page id ${pageId} but no markdown`);
            return;
        }

        const base = createBaseRecord({
            node,
            parents: collector.getParents(node.id) ?? [],
            domain,
            org_id,
            authed: authed?.(node) ?? false,
            versionIndexMap
        });

        if (node.type === "changelogEntry") {
            records.push(...createChangelogRecord({ base, markdown, date: node.date }));
        } else {
            records.push(...createMarkdownRecords({ base, markdown }));
        }
    });

    // Group API leaf nodes by apiDefinitionId for efficient lazy-loading
    const nodesByApiId = new Map<ApiDefinition.ApiDefinitionId, FernNavigation.NavigationNodeApiLeaf[]>();
    for (const node of apiLeafNodes) {
        const existing = nodesByApiId.get(node.apiDefinitionId) ?? [];
        existing.push(node);
        nodesByApiId.set(node.apiDefinitionId, existing);
    }

    // Track how many APIs we've lazy-loaded (limit to avoid memory issues)
    const MAX_LAZY_LOADED_APIS = 3;
    let lazyLoadedCount = 0;
    const apisNeedingLazyLoad = Object.keys(apis).length === 0;

    if (apisNeedingLazyLoad) {
        console.log(
            `[algolia] APIs not pre-loaded, will lazy-load up to ${MAX_LAZY_LOADED_APIS} of ${nodesByApiId.size} APIs`
        );
    }

    // Process each unique API definition
    for (const [apiDefinitionId, nodes] of nodesByApiId) {
        // Try to get from pre-loaded apis first, otherwise lazy-load
        let apiDefinition = apis[apiDefinitionId];

        if (!apiDefinition) {
            // Check if we've hit the lazy-load limit
            if (lazyLoadedCount >= MAX_LAZY_LOADED_APIS) {
                console.log(
                    `[algolia] Reached lazy-load limit (${MAX_LAZY_LOADED_APIS}), skipping API ${apiDefinitionId} with ${nodes.length} nodes`
                );
                continue;
            }

            console.log(
                `[algolia] Lazy-loading API definition: ${apiDefinitionId} (${lazyLoadedCount + 1}/${MAX_LAZY_LOADED_APIS})`
            );

            try {
                apiDefinition = await loadApiById(apiDefinitionId);
                lazyLoadedCount++;
            } catch (error) {
                console.error(`[algolia] Error lazy-loading API ${apiDefinitionId}:`, error);
                continue;
            }

            if (!apiDefinition) {
                console.error(
                    `[algolia] Failed to load API definition ${apiDefinitionId}, skipping ${nodes.length} nodes`
                );
                continue;
            }
        }

        // Process all nodes for this API
        try {
            for (const node of nodes) {
                const base = createBaseRecord({
                    node,
                    parents: collector.getParents(node.id) ?? [],
                    domain,
                    org_id,
                    authed: authed?.(node) ?? false,
                    versionIndexMap
                });

                records.push(...createRecordsForApiLeafNode({ node, apiDefinition, base }));
            }
        } catch (error) {
            console.error(`[algolia] Error processing nodes for API ${apiDefinitionId}:`, error);
        }

        // API definition can be garbage collected after processing all its nodes
    }

    console.log(`[algolia] Created ${records.length} records (${lazyLoadedCount} APIs lazy-loaded)`);

    // const distinctSlugs = new Set<string>();
    // collector.getNodesInOrder().forEach((node) => {
    //     if (!FernNavigation.hasMetadata(node)) {
    //         return;
    //     }

    //     if (distinctSlugs.has(node.slug)) {
    //         return;
    //     }

    //     distinctSlugs.add(node.slug);

    //     const base = createBaseRecord({ node, parents: collector.getParents(node.id) ?? [], domain, org_id, authed });
    //     records.push(createNavigationRecord({ base, node_type: node.type }));
    // });

    // remove all undefined values and filter out any record that is >= 100kb
    const jsonRecords = records.map((record) => JSON.stringify(record));
    const grouped = groupBy(jsonRecords, (record): "indexable" | "tooLarge" =>
        measureBytes(record) <= 100 * 1000 ? "indexable" : "tooLarge"
    );
    return {
        records: grouped.indexable?.map((record) => JSON.parse(record)) ?? [],
        tooLarge:
            grouped.tooLarge?.map((record) => ({
                record: JSON.parse(record),
                size: measureBytes(record)
            })) ?? []
    };
}
