import * as Sentry from "@sentry/node";
import { faiClient } from "../config/clients";
import { RETRY_CONFIG } from "../config/constants";
import { createDomainLogger } from "../config/logger";
import { getFernDocsIndexName } from "./turbopuffer/turbopuffer";

export async function syncToQueryIndex(domain: string): Promise<string> {
    const logger = createDomainLogger(domain);
    const fernDocsIndexName = getFernDocsIndexName();

    logger.info("Starting sync to query index");

    try {
        const syncResponse = await faiClient.index.syncIndexToQueryIndex(domain, {
            index_name: fernDocsIndexName
        });

        const jobId = syncResponse.job_id;
        logger.info("Sync job started", { jobId });

        await pollJobStatus(jobId, domain);

        logger.info("Sync completed successfully");

        return jobId;
    } catch (error) {
        Sentry.captureException(error, {
            tags: { component: "sync", operation: "sync_to_query_index", domain },
            extra: { fernDocsIndexName }
        });
        logger.error("[sync] Sync to query index failed", {
            error: error instanceof Error ? error.message : String(error)
        });
        throw error;
    }
}

export async function syncToQueryIndexIncremental(domain: string, parentIds: string[]): Promise<string> {
    const logger = createDomainLogger(domain);
    const fernDocsIndexName = getFernDocsIndexName();

    logger.info("Starting incremental sync to query index", { numParentIds: parentIds.length });

    try {
        const syncResponse = await faiClient.index.syncIndexToQueryIndexIncremental(domain, {
            index_name: fernDocsIndexName,
            parent_ids: parentIds
        });

        const jobId = syncResponse.job_id;
        logger.info("Incremental sync job started", { jobId });

        await pollJobStatus(jobId, domain);

        logger.info("Incremental sync completed successfully ", { jobId });

        return jobId;
    } catch (error) {
        Sentry.captureException(error, {
            tags: { component: "sync", operation: "incremental_sync_to_query_index", domain },
            extra: { fernDocsIndexName, numParentIds: parentIds.length }
        });
        logger.error("[sync] Incremental sync to query index failed", {
            error: error instanceof Error ? error.message : String(error),
            numParentIds: parentIds.length
        });
        throw error;
    }
}

async function pollJobStatus(jobId: string, domain: string): Promise<void> {
    const logger = createDomainLogger(domain);
    const maxAttempts = 1000;
    let attempts = 0;

    while (attempts < maxAttempts) {
        try {
            const statusResponse = await faiClient.index.getJobStatus(jobId);
            const { status, success, error } = statusResponse;

            logger.info("Job status", { jobId, status, success, error, attempt: attempts + 1, maxAttempts });

            if (status === "completed") {
                if (success === false) {
                    logger.error("[sync] Sync job completed but failed", { jobId, error });
                    const errorMessage = typeof error === "object" ? JSON.stringify(error) : error || "Unknown error";
                    throw new Error(`Sync job failed: ${errorMessage}`);
                }
                return;
            } else if (status === "failed") {
                logger.error("[sync] Sync job failed", { jobId, error });
                const errorMessage = typeof error === "object" ? JSON.stringify(error) : error || "Unknown error";
                throw new Error(`Sync job failed: ${errorMessage}`);
            }

            await new Promise((resolve) => setTimeout(resolve, RETRY_CONFIG.SYNC_RETRY_DELAY_MS));
            attempts++;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes("Sync job failed:")) {
                throw error;
            }
            attempts++;
            if (attempts >= maxAttempts) {
                logger.error("[sync] Error polling job status - max attempts exceeded", {
                    error: errorMessage,
                    attempts,
                    maxAttempts
                });
                throw error;
            }
            logger.warn("Error polling job status - retrying", { error: errorMessage, attempt: attempts, maxAttempts });
            await new Promise((resolve) => setTimeout(resolve, RETRY_CONFIG.SYNC_RETRY_DELAY_MS));
        }
    }

    throw new Error(`Job ${jobId} timed out after ${maxAttempts} attempts`);
}
