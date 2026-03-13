import { FernTurbopufferAttributeSchema, type LoadDocsWithUrlPayload, loadDocsWithUrl } from "@fern-docs/search-utils";
import * as Sentry from "@sentry/node";
import { Turbopuffer } from "@turbopuffer/turbopuffer";
import { faiClient } from "../../config/clients";
import { createDomainLogger } from "../../config/logger";
import { prefixedId } from "../../utils/prefixed-id";
import { withRetry } from "../../utils/retry";
import {
    type ContentDiff,
    deleteContentHashes,
    getContentDiff,
    type IndexedContentHash,
    upsertContentHashes
} from "../content-diff";
import { createTurbopufferRecords } from "./records/create-turbopuffer-records";
import { vectorizeTurbopufferRecords } from "./records/vectorize-turbopuffer-records";

const DEFAULT_UPSERT_BATCH_SIZE = 2000;
const MIN_UPSERT_BATCH_SIZE = 500;
const PAGE_PROCESSING_BATCH_SIZE = 100; // Process 100 pages at a time to limit memory usage

function isStringLengthError(error: unknown): boolean {
    if (error instanceof RangeError) {
        const message = error.message.toLowerCase();
        return message.includes("invalid string length") || message.includes("string length");
    }
    return false;
}

interface LogIncrementalSummaryParams {
    diff: ContentDiff;
    chunksPerParentId: Map<string, number>;
    oldHashMetadata: Map<string, IndexedContentHash>;
    totalRecordsUpserted: number;
    logger: ReturnType<typeof createDomainLogger>;
}

function logIncrementalReindexSummary({
    diff,
    chunksPerParentId,
    oldHashMetadata,
    totalRecordsUpserted,
    logger
}: LogIncrementalSummaryParams): void {
    const addedChunkCount = diff.added.reduce((sum, item) => sum + (chunksPerParentId.get(item.parent_id) || 0), 0);
    const updatedChunkCount = diff.updated.reduce((sum, item) => sum + (chunksPerParentId.get(item.parent_id) || 0), 0);
    const deletedChunkCount = diff.deleted.reduce(
        (sum, parentId) => sum + (oldHashMetadata.get(parentId)?.chunk_count || 0),
        0
    );

    const updatedOldChunkCount = diff.updated.reduce(
        (sum, item) => sum + (oldHashMetadata.get(item.parent_id)?.chunk_count || 0),
        0
    );
    const updatedNewChunkCount = updatedChunkCount;
    const updatedNetDelta = updatedNewChunkCount - updatedOldChunkCount;
    const updatedNetDeltaStr = updatedNetDelta >= 0 ? `+${updatedNetDelta}` : `${updatedNetDelta}`;

    const totalChunksDeleted = deletedChunkCount + updatedOldChunkCount;

    logger.info("Incremental reindex summary", {
        changes: {
            added: diff.added.length > 0 ? `${diff.added.length} parent_ids, +${addedChunkCount} chunks` : "None",
            updated:
                diff.updated.length > 0
                    ? `${diff.updated.length} parent_ids, -${updatedOldChunkCount} +${updatedNewChunkCount} (${updatedNetDeltaStr}) chunks`
                    : "None",
            deleted:
                diff.deleted.length > 0 ? `${diff.deleted.length} parent_ids, -${deletedChunkCount} chunks` : "None",
            unchanged: `${diff.unchanged.length} parent_ids (skipped)`
        },
        turbopufferChunks: {
            upserted: totalRecordsUpserted,
            deleted: totalChunksDeleted,
            total: totalRecordsUpserted + totalChunksDeleted
        }
    });
}

const FERN_DOCS_SOURCE = "fern_docs";

interface IncrementalTurbopufferUpsertTaskOptions {
    apiKey: string;
    /** The query namespace to write to directly (e.g. domain_query) */
    queryNamespace: string;
    /** The source namespace ID used for prefixing record IDs (e.g. domain_fern_docs) */
    sourceNamespaceId: string;
    payload: LoadDocsWithUrlPayload;
    authed?: boolean;
    vectorizer: (chunk: string[]) => Promise<number[][]>;
    splitText?: (text: string) => Promise<string[]>;
    basepath?: string;
    forceFullReindex?: boolean;
}

export interface IncrementalUpsertResult {
    numInserted: number;
    numUpdated: number;
    numDeleted: number;
    totalRecordsAffected: number;
    numChunksAdded: number;
    numChunksDeleted: number;
    changedParentIds: string[];
}

/**
 * Incrementally update turbopuffer by comparing content hashes.
 * Only re-indexes pages/endpoints that have changed, been added, or removed.
 */
export async function incrementalUpsertTurbopuffer({
    apiKey,
    queryNamespace,
    sourceNamespaceId,
    payload,
    authed,
    vectorizer,
    splitText = (text) => Promise.resolve([text]),
    basepath,
    forceFullReindex = false
}: IncrementalTurbopufferUpsertTaskOptions): Promise<IncrementalUpsertResult> {
    const tpuf = new Turbopuffer({
        apiKey,
        region: "gcp-us-east4"
    });
    const ns = tpuf.namespace(queryNamespace);

    const { root, pages, apis, domain } = await withRetry(async () => await loadDocsWithUrl(payload), {
        maxAttempts: 3,
        initialDelayMs: 1000
    });
    const logger = createDomainLogger(domain);

    logger.info("Starting incremental turbopuffer indexing", {
        forceFullReindex,
        queryNamespace,
        sourceNamespaceId
    });

    // For force full reindex, delete ALL fern_docs records from the query namespace.
    // We filter by source to avoid deleting records from other data sources (documents, guidance, etc.).
    // This ensures orphaned chunks (e.g. from jobs that failed or pages that were removed)
    // are cleaned up, since we're deleting everything with source="fern_docs" and then re-inserting.
    if (forceFullReindex) {
        logger.info("Force full reindex: deleting all fern_docs records from query namespace", {
            queryNamespace,
            basepath
        });
        try {
            if (basepath) {
                // Delete fern_docs records matching this basepath AND orphaned records with no basepath set.
                await withRetry(
                    async () => {
                        await ns.write({
                            delete_by_filter: [
                                "And",
                                [
                                    ["source", "Eq", FERN_DOCS_SOURCE],
                                    [
                                        "Or",
                                        [
                                            ["basepath", "Eq", basepath],
                                            ["basepath", "Eq", null]
                                        ]
                                    ]
                                ]
                            ]
                        });
                    },
                    { maxAttempts: 3, initialDelayMs: 1000 }
                );
            } else {
                await withRetry(
                    async () => {
                        await ns.write({
                            delete_by_filter: ["source", "Eq", FERN_DOCS_SOURCE]
                        });
                    },
                    { maxAttempts: 3, initialDelayMs: 1000 }
                );
            }
            logger.info("Successfully deleted all fern_docs records from query namespace");
        } catch (error) {
            Sentry.captureException(error, {
                tags: { component: "turbopuffer", operation: "force_full_reindex_delete", domain },
                extra: { queryNamespace, basepath, sourceNamespaceId }
            });
            logger.error("Failed to delete fern_docs records during force full reindex", {
                error: error instanceof Error ? error.message : String(error),
                queryNamespace,
                basepath
            });
            throw error;
        }
    }

    logger.info("Computing content diff");
    const currentContent = new Map<string, { content: string; chunk_count: number }>();

    // Initially set chunk_count to 0 as placeholder - will be updated after record generation
    for (const [pageId, markdown] of Object.entries(pages)) {
        currentContent.set(pageId, { content: markdown, chunk_count: 0 });
    }

    for (const apiDef of Object.values(apis)) {
        for (const [endpointId, endpoint] of Object.entries(apiDef.endpoints)) {
            const endpointContent = JSON.stringify(endpoint);
            currentContent.set(endpointId, { content: endpointContent, chunk_count: 0 });
        }

        for (const [webhookId, webhook] of Object.entries(apiDef.webhooks)) {
            const webhookContent = JSON.stringify(webhook);
            currentContent.set(webhookId, { content: webhookContent, chunk_count: 0 });
        }

        for (const [webSocketId, webSocket] of Object.entries(apiDef.websockets)) {
            const webSocketContent = JSON.stringify(webSocket);
            currentContent.set(webSocketId, { content: webSocketContent, chunk_count: 0 });
        }
    }

    const { diff, oldHashMetadata } = await getContentDiff(domain, currentContent, faiClient);

    logger.info("Content diff computed", {
        unchanged: diff.unchanged.length,
        updated: diff.updated.length,
        added: diff.added.length,
        deleted: diff.deleted.length
    });

    if (diff.added.length === 0 && diff.updated.length === 0 && diff.deleted.length === 0) {
        logger.info("No changes detected, skipping incremental sync");
        return {
            numInserted: 0,
            numUpdated: 0,
            numDeleted: 0,
            totalRecordsAffected: 0,
            numChunksAdded: 0,
            numChunksDeleted: 0,
            changedParentIds: []
        };
    }

    const recordsToDelete = [...diff.deleted, ...diff.updated.map((item) => item.parent_id)];
    let totalRecordsDeleted = 0;

    if (recordsToDelete.length > 0) {
        logger.info(`Deleting ${recordsToDelete.length} parent_ids from Turbopuffer`);

        try {
            const result = await withRetry(
                async () => {
                    return await ns.write({
                        delete_by_filter: [
                            "And",
                            [
                                ["source", "Eq", FERN_DOCS_SOURCE],
                                ["parent_id", "In", recordsToDelete]
                            ]
                        ]
                    });
                },
                {
                    maxAttempts: 3,
                    initialDelayMs: 1000
                }
            );
            totalRecordsDeleted = result.rows_deleted || 0;
        } catch (error) {
            Sentry.captureException(error, {
                tags: { component: "turbopuffer", operation: "incremental_delete", domain },
                extra: { queryNamespace, sourceNamespaceId, recordsToDeleteCount: recordsToDelete.length }
            });
            logger.error("Failed to batch delete records from Turbopuffer", {
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }

        logger.info("Deleted old/updated records from Turbopuffer", {
            parentIds: recordsToDelete.length,
            totalRecordsDeleted
        });
    }

    await deleteContentHashes(domain, diff.deleted, faiClient);

    const recordsToAdd = [...diff.added, ...diff.updated];

    if (recordsToAdd.length === 0) {
        logger.info("No changes detected, skipping vectorization and upsert");

        return {
            numInserted: 0,
            numUpdated: 0,
            numDeleted: diff.deleted.length,
            totalRecordsAffected: totalRecordsDeleted,
            numChunksAdded: 0,
            numChunksDeleted: totalRecordsDeleted,
            changedParentIds: diff.deleted
        };
    }

    const parentIdsToProcess = new Set(recordsToAdd.map((item) => item.parent_id));
    const filteredPages: Record<string, string> = {};
    const filteredApis = { ...apis };

    for (const [pageId, markdown] of Object.entries(pages)) {
        if (parentIdsToProcess.has(pageId)) {
            filteredPages[pageId] = markdown;
        }
    }

    logger.info("Creating records for changed content", {
        pagesCount: Object.keys(filteredPages).length,
        totalItemsToProcess: recordsToAdd.length
    });

    const chunksPerParentId = new Map<string, number>();
    let totalRecordsUpserted = 0;

    // Process pages in batches to limit memory usage
    const pageEntries = Object.entries(filteredPages);
    const totalBatches = Math.ceil(pageEntries.length / PAGE_PROCESSING_BATCH_SIZE);

    for (let batchStart = 0; batchStart < pageEntries.length; batchStart += PAGE_PROCESSING_BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + PAGE_PROCESSING_BATCH_SIZE, pageEntries.length);
        const pageBatch = Object.fromEntries(pageEntries.slice(batchStart, batchEnd));
        const batchNumber = Math.floor(batchStart / PAGE_PROCESSING_BATCH_SIZE) + 1;

        logger.info(`Processing batch ${batchNumber}/${totalBatches}`, {
            pagesInBatch: Object.keys(pageBatch).length,
            progress: `${batchEnd}/${pageEntries.length}`
        });

        const unvectorizedRecords = await createTurbopufferRecords({
            root,
            domain,
            pages: pageBatch,
            apis: filteredApis,
            authed,
            splitText,
            basepath
        });

        // Necessary because we don't initially filter out apis in filteredApis
        const filteredRecords = unvectorizedRecords.filter(
            (record) => record.attributes.parent_id !== undefined && parentIdsToProcess.has(record.attributes.parent_id)
        );

        logger.info(`Created ${filteredRecords.length} unvectorized records for batch ${batchNumber}`);

        const vectorizedRecords = await vectorizeTurbopufferRecords(filteredRecords, vectorizer);

        logger.info(`Vectorized ${vectorizedRecords.length} records for batch ${batchNumber}`);

        for (const record of vectorizedRecords) {
            const parentId = record.attributes.parent_id!;
            chunksPerParentId.set(parentId, (chunksPerParentId.get(parentId) || 0) + 1);
        }

        try {
            let i = 0;
            let currentUploadBatchSize = DEFAULT_UPSERT_BATCH_SIZE;

            while (i < vectorizedRecords.length) {
                const uploadBatchSize = Math.min(currentUploadBatchSize, vectorizedRecords.length - i);
                const uploadBatch = vectorizedRecords.slice(i, i + uploadBatchSize).map((record) => ({
                    id: prefixedId(sourceNamespaceId, record.id),
                    vector: record.vector,
                    ...record.attributes,
                    source: FERN_DOCS_SOURCE
                }));

                try {
                    await withRetry(
                        async () =>
                            await ns.write({
                                upsert_rows: uploadBatch,
                                distance_metric: "cosine_distance",
                                schema: FernTurbopufferAttributeSchema
                            }),
                        {
                            maxAttempts: 3,
                            initialDelayMs: 1000,
                            retryableErrors: (error) => !isStringLengthError(error)
                        }
                    );

                    logger.info("Upserted batch to Turbopuffer", {
                        batchNumber,
                        startIndex: i,
                        count: uploadBatch.length
                    });
                    i += uploadBatchSize;
                    totalRecordsUpserted += uploadBatch.length;
                    currentUploadBatchSize = DEFAULT_UPSERT_BATCH_SIZE;
                } catch (error) {
                    if (isStringLengthError(error) && uploadBatchSize > MIN_UPSERT_BATCH_SIZE) {
                        currentUploadBatchSize = Math.max(MIN_UPSERT_BATCH_SIZE, Math.floor(uploadBatchSize / 2));

                        logger.info("Length error; reducing upload batch size and retrying", {
                            newBatchSize: currentUploadBatchSize,
                            retryIndex: i
                        });
                        continue;
                    }
                    throw error;
                }
            }
        } catch (error) {
            Sentry.captureException(error, {
                tags: { component: "turbopuffer", operation: "upsert_batch", domain },
                extra: { queryNamespace, sourceNamespaceId, batchNumber, totalBatches }
            });
            logger.error(`Error upserting batch ${batchNumber} to turbopuffer`, {
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }

        logger.info(`Completed batch ${batchNumber}/${totalBatches}`, {
            recordsInserted: vectorizedRecords.length,
            totalInserted: totalRecordsUpserted
        });

        if (global.gc) {
            const gcStart = Date.now();
            global.gc();
            const gcDuration = Date.now() - gcStart;
            logger.info("Forced garbage collection after batch", { batchNumber, gcDurationMs: gcDuration });
        }
    }

    logger.info("Updating content hashes in FAI");

    const itemsWithChunkCounts = recordsToAdd.map((item) => ({
        ...item,
        chunk_count: chunksPerParentId.get(item.parent_id) || 0
    }));

    await upsertContentHashes(domain, itemsWithChunkCounts, faiClient);

    const addedChunkCount = diff.added.reduce((sum, item) => sum + (chunksPerParentId.get(item.parent_id) || 0), 0);
    const updatedChunkCount = diff.updated.reduce((sum, item) => sum + (chunksPerParentId.get(item.parent_id) || 0), 0);

    const result = {
        numInserted: diff.added.length,
        numUpdated: diff.updated.length,
        numDeleted: diff.deleted.length,
        totalRecordsAffected: totalRecordsUpserted + totalRecordsDeleted,
        numChunksAdded: addedChunkCount + updatedChunkCount,
        numChunksDeleted: totalRecordsDeleted,
        changedParentIds: [
            ...diff.added.map((item) => item.parent_id),
            ...diff.updated.map((item) => item.parent_id),
            ...diff.deleted
        ]
    };

    logIncrementalReindexSummary({
        diff,
        chunksPerParentId,
        oldHashMetadata,
        totalRecordsUpserted,
        logger
    });

    return result;
}
