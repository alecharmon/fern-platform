import { faiClient } from "../config/clients";
import { RETRY_CONFIG } from "../config/constants";
import { createDomainLogger } from "../config/logger";
import { getFernDocsIndexName } from "./turbopuffer/turbopuffer";

export async function syncToQueryIndex(domain: string): Promise<string> {
    const logger = createDomainLogger(domain);
    const fernDocsIndexName = getFernDocsIndexName();

    logger.info("Starting sync to query index");

    const syncResponse = await faiClient.index.syncIndexToQueryIndex(domain, {
        index_name: fernDocsIndexName
    });

    const jobId = syncResponse.job_id;
    logger.info("Sync job started", { jobId });

    await pollJobStatus(jobId, domain);

    logger.info("Sync completed successfully");

    return jobId;
}

export async function syncToQueryIndexIncremental(domain: string, parentIds: string[]): Promise<string> {
    const logger = createDomainLogger(domain);
    const fernDocsIndexName = getFernDocsIndexName();

    logger.info("Starting incremental sync to query index", { numParentIds: parentIds.length });

    const syncResponse = await faiClient.index.syncIndexToQueryIndexIncremental(domain, {
        index_name: fernDocsIndexName,
        parent_ids: parentIds
    });

    const jobId = syncResponse.job_id;
    logger.info("Incremental sync job started", { jobId });

    await pollJobStatus(jobId, domain);

    logger.info("Incremental sync completed successfully ", { jobId });

    return jobId;
}

async function pollJobStatus(jobId: string, domain: string): Promise<void> {
    const log = createDomainLogger(domain);
    const maxAttempts = 1000;
    let attempts = 0;

    while (attempts < maxAttempts) {
        try {
            const statusResponse = await faiClient.index.getJobStatus(jobId);
            const { status, success, error } = statusResponse;

            log.info("Job status", { jobId, status, success, error, attempt: attempts + 1, maxAttempts });

            if (status === "completed") {
                if (success === false) {
                    const errorMessage = typeof error === "object" ? JSON.stringify(error) : error || "Unknown error";
                    throw new Error(`Sync job completed but failed: ${errorMessage}`);
                }
                return;
            } else if (status === "failed") {
                const errorMessage = typeof error === "object" ? JSON.stringify(error) : error || "Unknown error";
                throw new Error(`Sync job failed: ${errorMessage}`);
            }

            await new Promise((resolve) => setTimeout(resolve, RETRY_CONFIG.SYNC_RETRY_DELAY_MS));
            attempts++;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            attempts++;
            if (attempts >= maxAttempts) {
                log.error("Error polling job status - max attempts exceeded", {
                    error: errorMessage,
                    attempts,
                    maxAttempts
                });
                throw error;
            }
            log.warn("Error polling job status - retrying", { error: errorMessage, attempt: attempts, maxAttempts });
            await new Promise((resolve) => setTimeout(resolve, RETRY_CONFIG.SYNC_RETRY_DELAY_MS));
        }
    }

    throw new Error(`Job ${jobId} timed out after ${maxAttempts} attempts`);
}
