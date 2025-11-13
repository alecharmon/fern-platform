import type { NavigationNodePage } from "@fern-api/fdr-sdk/navigation";
import { type LoadDocsWithUrlPayload, loadDocsWithUrl } from "@fern-docs/search-utils";
import { Turbopuffer } from "@turbopuffer/turbopuffer";

import { createTurbopufferRecords } from "../records/create-turbopuffer-records";
import { vectorizeTurbopufferRecords } from "../records/vectorize-turbopuffer-records";
import { FernTurbopufferAttributeSchema } from "../types";

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

    const unvectorizedRecords = await createTurbopufferRecords({
        root,
        domain,
        pages,
        apis,
        authed,
        splitText
    });

    console.log("Created turbopuffer records for domain: ", domain);

    const records = await vectorizeTurbopufferRecords(unvectorizedRecords, vectorizer);

    console.log("Vectorized turbopuffer records for domain: ", domain);

    if (deleteExisting) {
        try {
            await ns.deleteAll();
            console.log("Deleted existing records for domain: ", domain);
        } catch (error) {
            console.error(
                "Skipping namespace deletion for domain: ",
                domain,
                error instanceof Error ? "error: " + error.message : "error: " + String(error)
            );
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

                console.log(`Upserted batch starting at index ${i}: ${batch.length} records`);
                i += batchSize;
                currentBatchSize = DEFAULT_UPSERT_BATCH_SIZE;
            } catch (error) {
                if (isStringLengthError(error) && batchSize > MIN_UPSERT_BATCH_SIZE) {
                    currentBatchSize = Math.max(MIN_UPSERT_BATCH_SIZE, Math.floor(batchSize / 2));

                    console.log(
                        `Length error; reducing batch size to ${currentBatchSize} and retrying from index ${i}`
                    );
                    continue;
                }
                throw error;
            }
        }
    } catch (error) {
        console.error(
            "Error upserting records to turbopuffer ",
            error instanceof Error ? error.message : String(error)
        );
        throw error;
    }

    console.log("Finished upserting records to turbopuffer for domain: ", domain);
    return records.length;
}
