import type { TurbopufferRecord, TurbopufferRecordWithoutVector } from "@fern-docs/search-utils";
import { zipWith } from "es-toolkit/array";
import { encode } from "gpt-tokenizer";

export async function vectorizeTurbopufferRecords(
    records: TurbopufferRecordWithoutVector[],
    vectorizer: (chunk: string[]) => Promise<number[][]>
): Promise<TurbopufferRecord[]> {
    const filteredRecords = records.filter(
        (record) => encode(record.attributes.chunk).length <= 8190 && encode(record.attributes.chunk).length > 0
    );
    const chunks = filteredRecords.map((record) => record.attributes.chunk);
    const vectors = await vectorizer(chunks);
    return zipWith(filteredRecords, vectors, (record, vector) => ({
        ...record,
        vector
    }));
}
