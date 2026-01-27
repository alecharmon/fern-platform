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

interface CreateAlgoliaRecordsStreamOptions extends CreateAlgoliaRecordsOptions {
    /**
     * Number of records to yield per batch. Default: 5000
     * Smaller batches use less memory but have more overhead.
     */
    batchSize?: number;
}

export interface AlgoliaRecordsBatch {
    records: AlgoliaRecord[];
    tooLarge: { record: AlgoliaRecord; size: number }[];
    /** Progress info for logging */
    progress: {
        batchNumber: number;
        recordsInBatch: number;
        totalRecordsSoFar: number;
        isLastBatch: boolean;
    };
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

/**
 * Helper to filter and categorize records by size without JSON roundtrip.
 * Records >= 100kb are considered too large for indexing.
 */
function categorizeRecords(records: AlgoliaRecord[]): {
    indexable: AlgoliaRecord[];
    tooLarge: { record: AlgoliaRecord; size: number }[];
} {
    const indexable: AlgoliaRecord[] = [];
    const tooLarge: { record: AlgoliaRecord; size: number }[] = [];

    for (const record of records) {
        const size = measureBytes(JSON.stringify(record));
        if (size <= 100 * 1000) {
            indexable.push(record);
        } else {
            tooLarge.push({ record, size });
        }
    }

    return { indexable, tooLarge };
}

/**
 * Streaming version of createAlgoliaRecords that yields batches of records.
 * This is memory-efficient for large documentation sites with many API versions.
 *
 * Usage:
 * ```
 * for await (const batch of createAlgoliaRecordsStream(options)) {
 *     await meiliIndex.addDocuments(batch.records);
 *     console.log(`Indexed batch ${batch.progress.batchNumber}`);
 * }
 * ```
 */
export async function* createAlgoliaRecordsStream({
    root,
    domain,
    org_id,
    pages,
    apis,
    authed,
    batchSize = 5000
}: CreateAlgoliaRecordsStreamOptions): AsyncGenerator<AlgoliaRecordsBatch> {
    const collector = FernNavigation.NodeCollector.collect(root);

    const versionNodes = collector.getVersionNodes();
    const versionIndexMap = new Map<string, number>();
    for (const [idx, v] of versionNodes.entries()) {
        versionIndexMap.set(v.versionId, idx);
        console.log(`[algolia] version_index: ${v.versionId} -> ${idx}`);
    }

    const pageNodes = Array.from(collector.slugMap.values())
        .filter(FernNavigation.isPage)
        .filter((node) => !isEffectivelyHidden(node, collector))
        .filter((node) => (FernNavigation.hasMarkdown(node) ? node.noindex !== true : true));

    const markdownNodes = pageNodes.filter(FernNavigation.hasMarkdown);
    const apiLeafNodes = pageNodes.filter(FernNavigation.isApiLeaf);

    let currentBatch: AlgoliaRecord[] = [];
    let currentTooLarge: { record: AlgoliaRecord; size: number }[] = [];
    let batchNumber = 0;
    let totalRecordsSoFar = 0;

    const flushBatch = (isLastBatch: boolean): AlgoliaRecordsBatch => {
        const { indexable, tooLarge } = categorizeRecords(currentBatch);
        const batch: AlgoliaRecordsBatch = {
            records: indexable,
            tooLarge: [...currentTooLarge, ...tooLarge],
            progress: {
                batchNumber: ++batchNumber,
                recordsInBatch: indexable.length,
                totalRecordsSoFar: totalRecordsSoFar + indexable.length,
                isLastBatch
            }
        };
        totalRecordsSoFar += indexable.length;
        currentBatch = [];
        currentTooLarge = [];
        return batch;
    };

    const addRecords = (records: AlgoliaRecord[]): AlgoliaRecordsBatch | null => {
        currentBatch.push(...records);
        if (currentBatch.length >= batchSize) {
            return flushBatch(false);
        }
        return null;
    };

    // Process markdown nodes
    console.log(`[algolia-stream] Processing ${markdownNodes.length} markdown nodes...`);
    for (const node of markdownNodes) {
        const pageId = FernNavigation.getPageId(node);
        if (!pageId) {
            console.error(`Page node ${node.slug} has no page id`);
            continue;
        }

        const markdown = pages[pageId];
        if (!markdown) {
            console.error(`Page node ${node.slug} has page id ${pageId} but no markdown`);
            continue;
        }

        const base = createBaseRecord({
            node,
            parents: collector.getParents(node.id) ?? [],
            domain,
            org_id,
            authed: authed?.(node) ?? false,
            versionIndexMap
        });

        let records: AlgoliaRecord[];
        if (node.type === "changelogEntry") {
            records = createChangelogRecord({ base, markdown, date: node.date });
        } else {
            records = createMarkdownRecords({ base, markdown });
        }

        const batch = addRecords(records);
        if (batch) {
            console.log(
                `[algolia-stream] Yielding batch ${batch.progress.batchNumber} with ${batch.progress.recordsInBatch} records (${batch.progress.totalRecordsSoFar} total)`
            );
            yield batch;
        }
    }

    // Group API leaf nodes by apiDefinitionId
    const nodesByApiId = new Map<ApiDefinition.ApiDefinitionId, FernNavigation.NavigationNodeApiLeaf[]>();
    for (const node of apiLeafNodes) {
        const existing = nodesByApiId.get(node.apiDefinitionId) ?? [];
        existing.push(node);
        nodesByApiId.set(node.apiDefinitionId, existing);
    }

    const MAX_LAZY_LOADED_APIS = 3;
    let lazyLoadedCount = 0;
    const apisNeedingLazyLoad = Object.keys(apis).length === 0;

    if (apisNeedingLazyLoad) {
        console.log(
            `[algolia-stream] APIs not pre-loaded, will lazy-load up to ${MAX_LAZY_LOADED_APIS} of ${nodesByApiId.size} APIs`
        );
    }

    console.log(`[algolia-stream] Processing ${nodesByApiId.size} API definitions...`);

    // Process each unique API definition
    for (const [apiDefinitionId, nodes] of nodesByApiId) {
        let apiDefinition = apis[apiDefinitionId];

        if (!apiDefinition) {
            if (lazyLoadedCount >= MAX_LAZY_LOADED_APIS) {
                console.log(
                    `[algolia-stream] Reached lazy-load limit (${MAX_LAZY_LOADED_APIS}), skipping API ${apiDefinitionId} with ${nodes.length} nodes`
                );
                continue;
            }

            console.log(
                `[algolia-stream] Lazy-loading API definition: ${apiDefinitionId} (${lazyLoadedCount + 1}/${MAX_LAZY_LOADED_APIS})`
            );

            try {
                apiDefinition = await loadApiById(apiDefinitionId);
                lazyLoadedCount++;
            } catch (error) {
                console.error(`[algolia-stream] Error lazy-loading API ${apiDefinitionId}:`, error);
                continue;
            }

            if (!apiDefinition) {
                console.error(
                    `[algolia-stream] Failed to load API definition ${apiDefinitionId}, skipping ${nodes.length} nodes`
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

                const records = createRecordsForApiLeafNode({ node, apiDefinition, base });
                const batch = addRecords(records);
                if (batch) {
                    console.log(
                        `[algolia-stream] Yielding batch ${batch.progress.batchNumber} with ${batch.progress.recordsInBatch} records (${batch.progress.totalRecordsSoFar} total)`
                    );
                    yield batch;
                }
            }
        } catch (error) {
            console.error(`[algolia-stream] Error processing nodes for API ${apiDefinitionId}:`, error);
        }
    }

    // Yield any remaining records as the final batch
    if (currentBatch.length > 0) {
        const finalBatch = flushBatch(true);
        console.log(
            `[algolia-stream] Yielding final batch ${finalBatch.progress.batchNumber} with ${finalBatch.progress.recordsInBatch} records (${finalBatch.progress.totalRecordsSoFar} total)`
        );
        yield finalBatch;
    }

    console.log(`[algolia-stream] Finished streaming. Total records: ${totalRecordsSoFar}`);
}
