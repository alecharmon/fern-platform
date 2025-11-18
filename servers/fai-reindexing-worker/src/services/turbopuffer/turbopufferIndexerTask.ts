import type { NavigationNodePage } from "@fern-api/fdr-sdk/navigation";
import { Turbopuffer } from "@turbopuffer/turbopuffer";
import { createDomainLogger } from "../../config/logger";
import { type LoadDocsWithUrlPayload, loadDocsWithUrl } from "../loadDocsWithUrl";

import { createTurbopufferRecords } from "./records/create-turbopuffer-records";
import { vectorizeTurbopufferRecords } from "./records/vectorize-turbopuffer-records";
import { FernTurbopufferAttributeSchema } from "./types";

const DEFAULT_UPSERT_BATCH_SIZE = 2000;
const MIN_UPSERT_BATCH_SIZE = 500;

function isStringLengthError(error: unknown): boolean {
    if (error instanceof RangeError) {
        const message = error.message.toLowerCase();
        return message.includes("invalid string length") || message.includes("string length");
    }
    return false;
}

interface TurbopufferIndexerTaskOptions {
    apiKey: string;
    namespace: string;
    payload: LoadDocsWithUrlPayload;

    /**
     * Whether the page is authed or not.
     */
    authed?: (node: NavigationNodePage) => boolean;

    /**
     * The vectorizer to use.
     */
    vectorizer: (chunk: string[]) => Promise<number[][]>;

    /**
     * Text splitter to use.
     */
    splitText?: (text: string) => Promise<string[]>;

    /**
     * Whether to delete the existing records before upserting.
     */
    deleteExisting?: boolean;
}

export async function turbopufferUpsertTask({
    apiKey,
    namespace,
    payload,
    authed,
    vectorizer,
    splitText = (text) => Promise.resolve([text]),
    deleteExisting = true
}: TurbopufferIndexerTaskOptions): Promise<number> {
    const tpuf = new Turbopuffer({
        apiKey,
        baseUrl: "https://gcp-us-east4.turbopuffer.com"
    });
    const ns = tpuf.namespace(namespace);

    const { root, pages, apis, domain } = await loadDocsWithUrl(payload);
    const logger = createDomainLogger(domain);

    const unvectorizedRecords = await createTurbopufferRecords({
        root,
        domain,
        pages,
        apis,
        authed,
        splitText
    });

    logger.info("Created turbopuffer records");

    const records = await vectorizeTurbopufferRecords(unvectorizedRecords, vectorizer);

    logger.info("Vectorized turbopuffer records");

    if (deleteExisting) {
        try {
            await ns.deleteAll();
            logger.info("Deleted existing records");
        } catch (error) {
            logger.error("Skipping namespace deletion", {
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    try {
        let i = 0;
        let currentBatchSize = DEFAULT_UPSERT_BATCH_SIZE;

        while (i < records.length) {
            const batchSize = Math.min(currentBatchSize, records.length - i);
            const batch = records.slice(i, i + batchSize);

            try {
                await ns.upsert({
                    vectors: batch,
                    distance_metric: "cosine_distance",
                    schema: FernTurbopufferAttributeSchema
                });

                logger.info("Upserted batch", { startIndex: i, count: batch.length });
                i += batchSize;
                currentBatchSize = DEFAULT_UPSERT_BATCH_SIZE;
            } catch (error) {
                if (isStringLengthError(error) && batchSize > MIN_UPSERT_BATCH_SIZE) {
                    currentBatchSize = Math.max(MIN_UPSERT_BATCH_SIZE, Math.floor(batchSize / 2));

                    logger.info("Length error; reducing batch size and retrying", {
                        newBatchSize: currentBatchSize,
                        retryIndex: i
                    });
                    continue;
                }
                throw error;
            }
        }
    } catch (error) {
        logger.error("Error upserting records to turbopuffer", {
            error: error instanceof Error ? error.message : String(error)
        });
        throw error;
    }

    logger.info("Finished upserting records to turbopuffer", { totalRecords: records.length });
    return records.length;
}
