import { createOpenAI } from "@ai-sdk/openai";
import { withoutStaging } from "@fern-api/docs-utils";
import { env } from "../../config/env";
import { createDomainLogger } from "../../config/logger";
import { turbopufferUpsertTask } from "../turbopuffer/turbopufferIndexerTask";
import { getTurbopufferVectorizer } from "./getTurbopufferVectorizer";

export async function runTurbopufferUpsertTask(domain: string, deleteExisting: boolean): Promise<number> {
    const logger = createDomainLogger(domain);
    const fernDocsIndexName = getFernDocsIndexName();
    const namespace = getTurbopufferNamespace(domain, fernDocsIndexName);
    const openai = createOpenAI({ apiKey: env.openaiApiKey });
    const embeddingModel = openai.embedding("text-embedding-3-large");

    logger.info("Starting turbopuffer indexing", { namespace, deleteExisting });

    const numInserted = await turbopufferUpsertTask({
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

export function getFernDocsIndexName(): string {
    return `fern_docs`;
}

export function getTurbopufferNamespace(domain: string, indexName: string): string {
    return `${withoutStaging(domain)}_${indexName}`;
}
