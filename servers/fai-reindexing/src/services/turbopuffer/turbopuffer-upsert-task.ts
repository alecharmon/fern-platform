import { FernTurbopufferAttributeSchema, type LoadDocsWithUrlPayload, loadDocsWithUrl } from "@fern-docs/search-utils";
import { Turbopuffer } from "@turbopuffer/turbopuffer";
import { createDomainLogger } from "../../config/logger";
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

interface TurbopufferUpsertTaskOptions {
    apiKey: string;
    namespace: string;
    payload: LoadDocsWithUrlPayload;
    authed?: boolean;
    vectorizer: (chunk: string[]) => Promise<number[][]>;
    splitText?: (text: string) => Promise<string[]>;
    deleteExisting?: boolean;
    basepath?: string;
}

export async function upsertTurbopuffer({
    apiKey,
    namespace,
    payload,
    authed,
    vectorizer,
    splitText = (text) => Promise.resolve([text]),
    deleteExisting = true,
    basepath
}: TurbopufferUpsertTaskOptions): Promise<number> {
    const tpuf = new Turbopuffer({
        apiKey,
        region: "gcp-us-east4"
    });
    const ns = tpuf.namespace(namespace);

    const { root, pages, apis, domain } = await withRetry(async () => await loadDocsWithUrl(payload), {
        maxAttempts: 3,
        initialDelayMs: 1000
    });
    const logger = createDomainLogger(domain);

    const totalPages = Object.keys(pages).length;
    logger.info("Starting batched turbopuffer indexing", {
        totalPages,
        batchSize: PAGE_PROCESSING_BATCH_SIZE
    });

    if (deleteExisting) {
        try {
            await ns.deleteAll();
            logger.info("Deleted existing records");
        } catch (error) {
            logger.error("[turbopuffer-upsert] Skipping namespace deletion", {
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    const pageEntries = Object.entries(pages);
    let totalRecordsInserted = 0;

    for (let batchStart = 0; batchStart < pageEntries.length; batchStart += PAGE_PROCESSING_BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + PAGE_PROCESSING_BATCH_SIZE, pageEntries.length);
        const pageBatch = Object.fromEntries(pageEntries.slice(batchStart, batchEnd));
        const batchNumber = Math.floor(batchStart / PAGE_PROCESSING_BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(pageEntries.length / PAGE_PROCESSING_BATCH_SIZE);

        logger.info(`Processing batch ${batchNumber}/${totalBatches}`, {
            pagesInBatch: Object.keys(pageBatch).length,
            progress: `${batchEnd}/${totalPages}`
        });

        const unvectorizedRecords = await createTurbopufferRecords({
            root,
            domain,
            pages: pageBatch,
            apis,
            authed,
            splitText,
            basepath
        });

        logger.info(`Created ${unvectorizedRecords.length} records for batch ${batchNumber}`);

        const vectorizedRecords = await vectorizeTurbopufferRecords(unvectorizedRecords, vectorizer);

        logger.info(`Vectorized ${vectorizedRecords.length} records for batch ${batchNumber}`);

        try {
            let i = 0;
            let currentUploadBatchSize = DEFAULT_UPSERT_BATCH_SIZE;

            while (i < vectorizedRecords.length) {
                const uploadBatchSize = Math.min(currentUploadBatchSize, vectorizedRecords.length - i);
                const uploadBatch = vectorizedRecords.slice(i, i + uploadBatchSize).map((record) => ({
                    id: record.id,
                    vector: record.vector,
                    ...record.attributes
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

                    logger.info(`Upserted records from batch ${batchNumber}`, {
                        startIndex: i,
                        count: uploadBatch.length
                    });
                    i += uploadBatchSize;
                    totalRecordsInserted += uploadBatch.length;
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
            logger.error(`[turbopuffer-upsert] Error upserting batch ${batchNumber} to turbopuffer`, {
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }

        logger.info(`Completed batch ${batchNumber}/${totalBatches}`, {
            recordsInserted: vectorizedRecords.length,
            totalInserted: totalRecordsInserted
        });

        if (global.gc) {
            const gcStart = Date.now();
            global.gc();
            const gcDuration = Date.now() - gcStart;
            logger.info("Forced garbage collection after batch", { batchNumber, gcDurationMs: gcDuration });
        }
    }

    logger.info("Finished upserting all records to turbopuffer", { totalRecords: totalRecordsInserted });
    return totalRecordsInserted;
}
