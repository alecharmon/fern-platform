import { FernTurbopufferAttributeSchema, type LoadDocsWithUrlPayload, loadDocsWithUrl } from "@fern-docs/search-utils";
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
    changedParentIds: string[];
}

/**
 * Reindex turbopuffer by inserting all new records first, then cleaning up stale records.
 *
 * Uses an insert-first strategy for atomicity: new records are upserted with a fresh
 * `indexed_at` timestamp, and only after all inserts succeed are old records
 * (with `indexed_at` older than the reindex start time) deleted. If insertion fails,
 * the old records remain intact so users' AI chat continues to work.
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

    let totalRecordsUpserted = 0;

    // --- Phase 1: Upsert API endpoint records (once, outside the page batch loop) ---
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
        logger.info(`Processing ${apiRecords.length} API endpoint records`);

        const vectorizedApiRecords = await vectorizeTurbopufferRecords(apiRecords, vectorizer);
        totalRecordsUpserted += await upsertRecordBatch({
            ns,
            sourceNamespaceId,
            records: vectorizedApiRecords,
            reindexTimestamp,
            logger,
            batchLabel: "api-endpoints"
        });

        logger.info("Completed API endpoint upsert", {
            apiRecordsUpserted: totalRecordsUpserted
        });
    }

    // --- Phase 2: Upsert page records in batches ---
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

        const unvectorizedRecords = await createTurbopufferRecords({
            root,
            domain: loadedDomain,
            pages: pageBatch,
            apis: {}, // empty apis — only produces page/markdown records
            authed,
            splitText,
            basepath
        });

        logger.info(`Created ${unvectorizedRecords.length} unvectorized records for batch ${batchNumber}`);

        const vectorizedRecords = await vectorizeTurbopufferRecords(unvectorizedRecords, vectorizer);

        logger.info(`Vectorized ${vectorizedRecords.length} records for batch ${batchNumber}`);

        totalRecordsUpserted += await upsertRecordBatch({
            ns,
            sourceNamespaceId,
            records: vectorizedRecords,
            reindexTimestamp,
            logger,
            batchLabel: `page-batch-${batchNumber}`
        });

        logger.info(`Completed page batch ${batchNumber}/${totalBatches}`, {
            totalInserted: totalRecordsUpserted
        });

        if (global.gc) {
            const gcStart = Date.now();
            global.gc();
            const gcDuration = Date.now() - gcStart;
            logger.info("Forced garbage collection after batch", { batchNumber, gcDurationMs: gcDuration });
        }
    }

    // --- Phase 3: Delete stale fern_docs records (indexed_at < reindexTimestamp) ---
    // Only runs after ALL inserts succeeded. If any insert failed, we threw and never reach here,
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

    logger.info("Reindex completed", {
        totalRecordsUpserted,
        pageCount: pageIds.length,
        apiCount: Object.keys(apis).length,
        reindexTimestamp
    });

    return {
        numInserted: totalRecordsUpserted,
        numUpdated: 0,
        numDeleted: 0,
        totalRecordsAffected: totalRecordsUpserted,
        numChunksAdded: totalRecordsUpserted,
        numChunksDeleted,
        changedParentIds: pageIds
    };
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
