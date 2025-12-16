import { createOpenAI } from "@ai-sdk/openai";
import { withoutStaging } from "@fern-api/docs-utils";
import { Turbopuffer } from "@turbopuffer/turbopuffer";
import { env } from "../../config/env";
import { createDomainLogger } from "../../config/logger";
import { incrementalUpsertTurbopuffer } from "./turbopuffer-incremental-upsert-task";
import { upsertTurbopuffer } from "./turbopuffer-upsert-task";
import { getTurbopufferVectorizer } from "./turbopuffer-vectorizer";

export async function runTurbopufferUpsertTask(domain: string, deleteExisting: boolean): Promise<number> {
    const logger = createDomainLogger(domain);
    const fernDocsIndexName = getFernDocsIndexName();
    const namespace = getTurbopufferNamespace(domain, fernDocsIndexName);
    const openai = createOpenAI({ apiKey: env.openaiApiKey });
    const embeddingModel = openai.embedding("text-embedding-3-large");

    logger.info("Starting turbopuffer indexing", { namespace, deleteExisting });

    const numInserted = await upsertTurbopuffer({
        apiKey: env.turbopufferApiKey,
        namespace,
        payload: {
            environment: env.fdrOrigin,
            fernToken: env.fernToken,
            domain: withoutStaging(domain)
        },
        vectorizer: getTurbopufferVectorizer(embeddingModel),
        deleteExisting
    });

    logger.info("Upserted records to turbopuffer", { numInserted });

    return numInserted;
}

export async function runIncrementalTurbopufferUpsertTask(domain: string): Promise<{
    numInserted: number;
    numUpdated: number;
    numDeleted: number;
    totalRecordsAffected: number;
    numChunksAdded: number;
    numChunksDeleted: number;
    changedParentIds: string[];
}> {
    const logger = createDomainLogger(domain);
    const fernDocsIndexName = getFernDocsIndexName();
    const namespace = getTurbopufferNamespace(domain, fernDocsIndexName);
    const openai = createOpenAI({ apiKey: env.openaiApiKey });
    const embeddingModel = openai.embedding("text-embedding-3-large");

    logger.info("Starting incremental turbopuffer indexing", { namespace });

    const result = await incrementalUpsertTurbopuffer({
        apiKey: env.turbopufferApiKey,
        namespace,
        payload: {
            environment: env.fdrOrigin,
            fernToken: env.fernToken,
            domain: withoutStaging(domain)
        },
        vectorizer: getTurbopufferVectorizer(embeddingModel)
    });

    const { changedParentIds, ...resultStats } = result;
    logger.info("Incremental upsert completed", { ...resultStats });

    return result;
}

export function getFernDocsIndexName(): string {
    return `fern_docs`;
}

export function getTurbopufferNamespace(domain: string, indexName: string): string {
    return `${withoutStaging(domain)}_${indexName}`;
}

export async function deleteTurbopufferNamespace(domain: string): Promise<void> {
    const logger = createDomainLogger(domain);
    const namespace = getTurbopufferNamespace(domain, getFernDocsIndexName());

    logger.info("Deleting all records from Turbopuffer namespace", { namespace });

    const tpuf = new Turbopuffer({ apiKey: env.turbopufferApiKey, region: "gcp-us-east4" });
    const ns = tpuf.namespace(namespace);
    await ns.deleteAll();

    logger.info("Successfully deleted all Turbopuffer records", { namespace });
}
