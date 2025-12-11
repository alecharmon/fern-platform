import type { TurbopufferRecord, TurbopufferRecordWithoutVector } from "@fern-docs/search-utils";
import { zipWith } from "es-toolkit/array";
import { encode } from "gpt-tokenizer";
import { logger } from "../../../config/logger";

export async function vectorizeTurbopufferRecords(
    records: TurbopufferRecordWithoutVector[],
    vectorizer: (chunk: string[]) => Promise<number[][]>
): Promise<TurbopufferRecord[]> {
    const filteredRecords = records.filter(
        (record) => encode(record.attributes.chunk).length <= 8190 && encode(record.attributes.chunk).length > 0
    );

    const numFilteredOut = records.length - filteredRecords.length;
    if (numFilteredOut > 0) {
        logger.info(`Filtered out ${numFilteredOut} records due to token length constraints`);
    }

    const chunks = filteredRecords.map((record) => record.attributes.chunk);
    const vectors = await vectorizer(chunks);
    return zipWith(filteredRecords, vectors, (record, vector) => ({
        ...record,
        vector
    }));
}
