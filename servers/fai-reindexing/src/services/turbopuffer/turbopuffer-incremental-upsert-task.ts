import {
    FernTurbopufferAttributeSchema,
    type LoadDocsWithUrlPayload,
    loadDocsWithUrl,
    type TurbopufferRecordWithoutVector
} from "@fern-docs/search-utils";
import * as Sentry from "@sentry/node";
import { Turbopuffer } from "@turbopuffer/turbopuffer";
import { createDomainLogger } from "../../config/logger";
import { prefixedId } from "../../utils/prefixed-id";
import { withRetry } from "../../utils/retry";
import { createTurbopufferRecords } from "./records/create-turbopuffer-records";
import { vectorizeTurbopufferRecords } from "./records/vectorize-turbopuffer-records";

const DEFAULT_UPSERT_BATCH_SIZE = 2000;
const MIN_UPSERT_BATCH_SIZE = 500;
const PAGE_PROCESSING_BATCH_SIZE = 100; // Process 100 pages at a time to limit memory usage
const HASH_QUERY_BATCH_SIZE = 10000; // Max rows to fetch per hash query

function isStringLengthError(error: unknown): boolean {
    if (error instanceof RangeError) {
        const message = error.message.toLowerCase();
        return message.includes("invalid string length") || message.includes("string length");
    }
    return false;
}

const FERN_DOCS_SOURCE = "fern_docs";

interface TurbopufferUpsertTaskOptions {
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
}

export interface IncrementalUpsertResult {
    numInserted: number;
    numUpdated: number;
    numDeleted: number;
    totalRecordsAffected: number;
    numChunksAdded: number;
    numChunksDeleted: number;
    numSkipped: number;
    changedParentIds: string[];
}

/**
 * Reindex turbopuffer using content-hash-based diffing to skip unchanged pages.
 *
 * Strategy:
 *   Phase 0 — Fetch existing {parent_id → parent_content_hash} from turbopuffer
 *   Phase 1 — Create records for ALL pages/endpoints (to compute hashes), then diff
 *   Phase 2 — Only vectorize + upsert records whose parent_content_hash changed
 *   Phase 3 — Patch `indexed_at` on unchanged records so they survive stale cleanup
 *   Phase 4 — Delete stale records (indexed_at < reindexTimestamp)
 *
 * Uses an insert-first strategy for atomicity: if insertion fails, old records
 * remain intact so users' AI chat continues to work.
 *
 * API endpoint records are processed once (outside the page batch loop) to avoid
 * redundant vectorization across page batches.
 */
export async function incrementalUpsertTurbopuffer({
    apiKey,
    queryNamespace,
    sourceNamespaceId,
    payload,
    authed,
    vectorizer,
    splitText = (text) => Promise.resolve([text]),
    basepath
}: TurbopufferUpsertTaskOptions): Promise<IncrementalUpsertResult> {
    const tpuf = new Turbopuffer({
        apiKey,
        region: "gcp-us-east4"
    });
    const ns = tpuf.namespace(queryNamespace);

    const {
        root,
        pages,
        apis,
        domain: loadedDomain
    } = await withRetry(async () => await loadDocsWithUrl(payload), {
        maxAttempts: 3,
        initialDelayMs: 1000
    });
    const logger = createDomainLogger(loadedDomain);

    // Record the reindex start time. All new records will be stamped with this timestamp.
    // After all inserts succeed, we delete old fern_docs records with indexed_at < reindexTimestamp.
    const reindexTimestamp = new Date().toISOString();

    logger.info("Starting turbopuffer reindex", {
        queryNamespace,
        sourceNamespaceId,
        loadedDomain,
        basepath,
        reindexTimestamp
    });

    const pageIds = Object.keys(pages);
    logger.info("Creating records for all content", {
        pageCount: pageIds.length,
        pageIds: pageIds.length <= 20 ? pageIds : `${pageIds.length} pages (too many to list)`,
        apiCount: Object.keys(apis).length
    });

    // --- Phase 0: Fetch existing content hashes from turbopuffer ---
    const existingHashes = await fetchExistingContentHashes(ns, sourceNamespaceId, basepath, logger);
    logger.info("Fetched existing content hashes", {
        uniqueParentIds: existingHashes.size
    });

    let totalRecordsUpserted = 0;
    let totalRecordsSkipped = 0;
    const changedParentIds: string[] = [];

    // --- Phase 1: Process API endpoint records (once, outside the page batch loop) ---
    const apiRecords = await createTurbopufferRecords({
        root,
        domain: loadedDomain,
        pages: {}, // empty pages — only produces API endpoint records
        apis,
        authed,
        splitText,
        basepath
    });

    if (apiRecords.length > 0) {
        const { changed: changedApiRecords, unchangedParentIds: unchangedApiParentIds } = partitionByContentHash(
            apiRecords,
            existingHashes
        );

        logger.info(
            `API endpoints: ${changedApiRecords.length} changed, ${unchangedApiParentIds.size} unchanged (skipped)`
        );
        totalRecordsSkipped += apiRecords.length - changedApiRecords.length;

        // Track changed API parent IDs
        for (const record of changedApiRecords) {
            if (record.attributes.parent_id != null) {
                changedParentIds.push(record.attributes.parent_id);
            }
        }

        if (changedApiRecords.length > 0) {
            const vectorizedApiRecords = await vectorizeTurbopufferRecords(changedApiRecords, vectorizer);
            totalRecordsUpserted += await upsertRecordBatch({
                ns,
                sourceNamespaceId,
                records: vectorizedApiRecords,
                reindexTimestamp,
                logger,
                batchLabel: "api-endpoints"
            });
        }

        // Patch indexed_at for unchanged API endpoint records
        if (unchangedApiParentIds.size > 0) {
            await patchTimestampForUnchangedRecords({
                ns,
                sourceNamespaceId,
                basepath,
                unchangedParentIds: unchangedApiParentIds,
                reindexTimestamp,
                logger,
                batchLabel: "api-endpoints-unchanged"
            });
        }

        logger.info("Completed API endpoint processing", {
            apiRecordsUpserted: totalRecordsUpserted,
            apiRecordsSkipped: apiRecords.length - changedApiRecords.length
        });
    }

    // --- Phase 2: Process page records in batches ---
    const pageEntries = Object.entries(pages);
    const totalBatches = Math.ceil(pageEntries.length / PAGE_PROCESSING_BATCH_SIZE);

    for (let batchStart = 0; batchStart < pageEntries.length; batchStart += PAGE_PROCESSING_BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + PAGE_PROCESSING_BATCH_SIZE, pageEntries.length);
        const pageBatch = Object.fromEntries(pageEntries.slice(batchStart, batchEnd));
        const batchNumber = Math.floor(batchStart / PAGE_PROCESSING_BATCH_SIZE) + 1;

        logger.info(`Processing page batch ${batchNumber}/${totalBatches}`, {
            pagesInBatch: Object.keys(pageBatch).length,
            progress: `${batchEnd}/${pageEntries.length}`
        });

        // Create records for all pages in this batch (needed to compute hashes)
        const allBatchRecords = await createTurbopufferRecords({
            root,
            domain: loadedDomain,
            pages: pageBatch,
            apis: {}, // empty apis — only produces page/markdown records
            authed,
            splitText,
            basepath
        });

        // Diff: only vectorize + upsert records whose content hash changed
        const { changed: changedRecords, unchangedParentIds: unchangedPageParentIds } = partitionByContentHash(
            allBatchRecords,
            existingHashes
        );

        logger.info(
            `Batch ${batchNumber}: ${changedRecords.length} changed chunks, ${unchangedPageParentIds.size} unchanged parents (skipped)`,
            {
                totalRecords: allBatchRecords.length,
                changedRecords: changedRecords.length,
                skippedRecords: allBatchRecords.length - changedRecords.length
            }
        );

        totalRecordsSkipped += allBatchRecords.length - changedRecords.length;

        // Track changed page parent IDs
        for (const record of changedRecords) {
            if (record.attributes.parent_id != null) {
                changedParentIds.push(record.attributes.parent_id);
            }
        }

        // Vectorize and upsert only changed records
        if (changedRecords.length > 0) {
            const vectorizedRecords = await vectorizeTurbopufferRecords(changedRecords, vectorizer);

            logger.info(`Vectorized ${vectorizedRecords.length} changed records for batch ${batchNumber}`);

            totalRecordsUpserted += await upsertRecordBatch({
                ns,
                sourceNamespaceId,
                records: vectorizedRecords,
                reindexTimestamp,
                logger,
                batchLabel: `page-batch-${batchNumber}`
            });
        }

        // Patch indexed_at for unchanged records so they survive stale cleanup
        if (unchangedPageParentIds.size > 0) {
            await patchTimestampForUnchangedRecords({
                ns,
                sourceNamespaceId,
                basepath,
                unchangedParentIds: unchangedPageParentIds,
                reindexTimestamp,
                logger,
                batchLabel: `page-batch-${batchNumber}-unchanged`
            });
        }

        logger.info(`Completed page batch ${batchNumber}/${totalBatches}`, {
            totalInserted: totalRecordsUpserted,
            totalSkipped: totalRecordsSkipped
        });

        if (global.gc) {
            const gcStart = Date.now();
            global.gc();
            const gcDuration = Date.now() - gcStart;
            logger.info("Forced garbage collection after batch", { batchNumber, gcDurationMs: gcDuration });
        }
    }

    // --- Phase 4: Delete stale fern_docs records (indexed_at < reindexTimestamp) ---
    // Only runs after ALL inserts + patches succeeded. If any insert failed, we threw and never reach here,
    // so old records remain intact and users' AI chat continues to work.
    logger.info("Cleaning up stale fern_docs records", {
        reindexTimestamp,
        queryNamespace,
        basepath
    });
    let numChunksDeleted = 0;
    try {
        const deleteFilter = buildStaleRecordFilter(basepath, reindexTimestamp);
        const deleteResult = await withRetry(
            async () => {
                return await ns.write({ delete_by_filter: deleteFilter });
            },
            { maxAttempts: 3, initialDelayMs: 1000 }
        );
        numChunksDeleted = deleteResult.rows_deleted ?? 0;
        logger.info("Successfully deleted stale fern_docs records", { numChunksDeleted });
    } catch (error) {
        // Log but don't throw — the new records are already in place.
        // Stale records will be cleaned up on the next reindex.
        Sentry.captureException(error, {
            tags: { component: "turbopuffer", operation: "reindex_cleanup", domain: loadedDomain },
            extra: { queryNamespace, basepath, sourceNamespaceId, reindexTimestamp }
        });
        logger.warn("Failed to delete stale records after reindex (non-fatal, will be cleaned up next reindex)", {
            error: error instanceof Error ? error.message : String(error)
        });
    }

    // Deduplicate changedParentIds
    const uniqueChangedParentIds = [...new Set(changedParentIds)];

    logger.info("Reindex completed", {
        totalRecordsUpserted,
        totalRecordsSkipped,
        numChunksDeleted,
        changedParentIds: uniqueChangedParentIds.length,
        pageCount: pageIds.length,
        apiCount: Object.keys(apis).length,
        reindexTimestamp
    });

    return {
        numInserted: totalRecordsUpserted,
        numUpdated: 0,
        numDeleted: 0,
        totalRecordsAffected: totalRecordsUpserted + totalRecordsSkipped,
        numChunksAdded: totalRecordsUpserted,
        numChunksDeleted,
        numSkipped: totalRecordsSkipped,
        changedParentIds: uniqueChangedParentIds
    };
}

/**
 * Fetch existing {parent_id → parent_content_hash} from turbopuffer for fern_docs records.
 * Uses a filter-only query (no vector search) with only the attributes we need.
 */
async function fetchExistingContentHashes(
    ns: ReturnType<Turbopuffer["namespace"]>,
    sourceNamespaceId: string,
    basepath: string | undefined,
    logger: ReturnType<typeof createDomainLogger>
): Promise<Map<string, string>> {
    const hashMap = new Map<string, string>();

    const filterConditions: unknown[] = [["source", "Eq", FERN_DOCS_SOURCE]];
    if (basepath) {
        filterConditions.push([
            "Or",
            [
                ["basepath", "Eq", basepath],
                ["basepath", "Eq", null]
            ]
        ]);
    }
    const filters = filterConditions.length === 1 ? filterConditions[0] : ["And", filterConditions];

    try {
        const result = await withRetry(
            async () =>
                await ns.query({
                    filters,
                    include_attributes: ["parent_id", "parent_content_hash"],
                    top_k: HASH_QUERY_BATCH_SIZE,
                    consistency: { level: "strong" }
                }),
            { maxAttempts: 3, initialDelayMs: 1000 }
        );

        if (result.rows) {
            for (const row of result.rows) {
                const parentId = row.parent_id as string | undefined;
                const contentHash = row.parent_content_hash as string | undefined;
                if (parentId && contentHash) {
                    // Deduplicate by parent_id (multiple chunks share the same parent hash)
                    hashMap.set(parentId, contentHash);
                }
            }
        }

        logger.info("Fetched content hashes from turbopuffer", {
            rowsReturned: result.rows?.length ?? 0,
            uniqueParentIds: hashMap.size
        });
    } catch (error) {
        // If we fail to fetch hashes, log and proceed with a full reindex (empty map = everything is "changed")
        Sentry.captureException(error, {
            tags: { component: "turbopuffer", operation: "fetch_content_hashes" },
            extra: { sourceNamespaceId, basepath }
        });
        logger.warn("Failed to fetch existing content hashes, proceeding with full reindex", {
            error: error instanceof Error ? error.message : String(error)
        });
    }

    return hashMap;
}

/**
 * Partition records into changed (need vectorization) and unchanged (just need timestamp bump)
 * by comparing their parent_content_hash against existing hashes from turbopuffer.
 */
export function partitionByContentHash(
    records: TurbopufferRecordWithoutVector[],
    existingHashes: Map<string, string>
): { changed: TurbopufferRecordWithoutVector[]; unchangedParentIds: Set<string> } {
    const changed: TurbopufferRecordWithoutVector[] = [];
    const unchangedParentIds = new Set<string>();
    const seenChangedParentIds = new Set<string>();

    for (const record of records) {
        const parentId = record.attributes.parent_id;
        const newHash = record.attributes.parent_content_hash;

        if (!parentId || !newHash) {
            // No hash info — treat as changed
            changed.push(record);
            continue;
        }

        // If we've already determined this parent is changed, include all its chunks
        if (seenChangedParentIds.has(parentId)) {
            changed.push(record);
            continue;
        }

        // If we've already determined this parent is unchanged, skip
        if (unchangedParentIds.has(parentId)) {
            continue;
        }

        const existingHash = existingHashes.get(parentId);
        if (existingHash === newHash) {
            unchangedParentIds.add(parentId);
        } else {
            seenChangedParentIds.add(parentId);
            changed.push(record);
        }
    }

    return { changed, unchangedParentIds };
}

/**
 * Patch `indexed_at` on unchanged records so they survive the stale-record cleanup.
 * Uses patch_by_filter to update records matching each parent_id.
 */
async function patchTimestampForUnchangedRecords({
    ns,
    sourceNamespaceId,
    basepath,
    unchangedParentIds,
    reindexTimestamp,
    logger,
    batchLabel
}: {
    ns: ReturnType<Turbopuffer["namespace"]>;
    sourceNamespaceId: string;
    basepath: string | undefined;
    unchangedParentIds: Set<string>;
    reindexTimestamp: string;
    logger: ReturnType<typeof createDomainLogger>;
    batchLabel: string;
}): Promise<number> {
    let totalPatched = 0;

    // Process unchanged parent IDs in batches to avoid overly large filter expressions
    const parentIdArray = [...unchangedParentIds];
    const PATCH_BATCH_SIZE = 100;

    for (let i = 0; i < parentIdArray.length; i += PATCH_BATCH_SIZE) {
        const batch = parentIdArray.slice(i, i + PATCH_BATCH_SIZE);

        // Build filter: source=fern_docs AND parent_id IN batch AND (basepath match)
        // turbopuffer filter for "IN" is: ["Or", [["parent_id", "Eq", id1], ["parent_id", "Eq", id2], ...]]
        const parentIdFilter =
            batch.length === 1 ? ["parent_id", "Eq", batch[0]] : ["Or", batch.map((id) => ["parent_id", "Eq", id])];

        const filterConditions: unknown[] = [["source", "Eq", FERN_DOCS_SOURCE], parentIdFilter];

        if (basepath) {
            filterConditions.push([
                "Or",
                [
                    ["basepath", "Eq", basepath],
                    ["basepath", "Eq", null]
                ]
            ]);
        }

        try {
            const patchResult = await withRetry(
                async () =>
                    await ns.write({
                        patch_by_filter: {
                            filters: ["And", filterConditions],
                            patch: { indexed_at: reindexTimestamp }
                        },
                        schema: FernTurbopufferAttributeSchema
                    }),
                { maxAttempts: 3, initialDelayMs: 1000 }
            );
            totalPatched += patchResult.rows_patched ?? 0;
        } catch (error) {
            Sentry.captureException(error, {
                tags: { component: "turbopuffer", operation: "patch_unchanged" },
                extra: { batchLabel, parentIdCount: batch.length, basepath }
            });
            logger.warn("Failed to patch unchanged records (non-fatal)", {
                batchLabel,
                error: error instanceof Error ? error.message : String(error),
                parentIdCount: batch.length
            });
        }
    }

    logger.info("Patched indexed_at for unchanged records", {
        batchLabel,
        totalPatched,
        parentIdCount: unchangedParentIds.size
    });

    return totalPatched;
}

/**
 * Build a turbopuffer delete_by_filter for stale fern_docs records.
 * Deletes records where source=fern_docs AND indexed_at < reindexTimestamp,
 * scoped to the basepath if provided.
 */
function buildStaleRecordFilter(basepath: string | undefined, reindexTimestamp: string): unknown {
    const staleConditions: unknown[] = [
        ["source", "Eq", FERN_DOCS_SOURCE],
        ["indexed_at", "Lt", reindexTimestamp]
    ];

    if (basepath) {
        staleConditions.push([
            "Or",
            [
                ["basepath", "Eq", basepath],
                ["basepath", "Eq", null]
            ]
        ]);
    }

    return ["And", staleConditions];
}

/**
 * Upsert a batch of vectorized records to turbopuffer with adaptive batch sizing.
 * Each record is stamped with the provided reindexTimestamp as `indexed_at`.
 * Returns the number of records successfully upserted.
 */
async function upsertRecordBatch({
    ns,
    sourceNamespaceId,
    records,
    reindexTimestamp,
    logger,
    batchLabel
}: {
    ns: ReturnType<Turbopuffer["namespace"]>;
    sourceNamespaceId: string;
    records: Array<{ id: string; vector: number[]; attributes: Record<string, unknown> }>;
    reindexTimestamp: string;
    logger: ReturnType<typeof createDomainLogger>;
    batchLabel: string;
}): Promise<number> {
    let upserted = 0;
    let i = 0;
    let currentUploadBatchSize = DEFAULT_UPSERT_BATCH_SIZE;

    while (i < records.length) {
        const uploadBatchSize = Math.min(currentUploadBatchSize, records.length - i);
        const uploadBatch = records.slice(i, i + uploadBatchSize).map((record) => ({
            id: prefixedId(sourceNamespaceId, record.id),
            vector: record.vector,
            ...record.attributes,
            source: FERN_DOCS_SOURCE,
            indexed_at: reindexTimestamp
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
                batchLabel,
                startIndex: i,
                count: uploadBatch.length
            });
            i += uploadBatchSize;
            upserted += uploadBatch.length;
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

    return upserted;
}
