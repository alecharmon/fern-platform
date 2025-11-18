import { faiClient } from "../config/clients";
import { createDomainLogger } from "../config/logger";
import { getFernDocsIndexName } from "../services/turbopuffer/turbopuffer";

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

async function pollJobStatus(jobId: string, domain: string): Promise<void> {
    const log = createDomainLogger(domain);
    const maxAttempts = 80;
    let attempts = 0;

    while (attempts < maxAttempts) {
        try {
            const statusResponse = await faiClient.index.getJobStatus(jobId);
            const { status, success, error } = statusResponse;

            log.info("Job status", { jobId, status, attempt: attempts + 1, maxAttempts });

            if (status === "completed") {
                if (success === false) {
                    throw new Error(`Sync job failed: ${error || "Unknown error"}`);
                }
                return;
            } else if (status === "failed") {
                throw new Error(`Sync job failed: ${error || "Unknown error"}`);
            }

            await new Promise((resolve) => setTimeout(resolve, 15000));
            attempts++;
        } catch (error) {
            log.error("Error polling job status", { error });
            throw error;
        }
    }

    throw new Error(`Job ${jobId} timed out after ${maxAttempts} attempts`);
}
