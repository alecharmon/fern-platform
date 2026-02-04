import type { Logger } from "winston";
import { faiClient } from "../config/clients";
import { env } from "../config/env";
import { createDomainLogger } from "../config/logger";
import { updateJobStatus } from "../services/job-tracker";
import { track } from "../services/posthog";
import { syncToQueryIndexIncremental } from "../services/sync";
import { deleteTurbopufferNamespace, runIncrementalTurbopufferUpsertTask } from "../services/turbopuffer/turbopuffer";
import { JobStatus, type ReindexJobMessage } from "../types";
import { getDocsUrlMetadata } from "../utils/docs-metadata";
import { withRetry } from "../utils/retry";

export async function processReindexJob(message: ReindexJobMessage, sqsMessageId: string): Promise<void> {
    const { domain, forceFullReindex = false } = message;
    const log = createDomainLogger(domain);
    const start = Date.now();

    log.info("Starting reindex job", { sqsMessageId, forceFullReindex });

    const metadata = await getDocsUrlMetadata(domain);
    if (!metadata) {
        log.error("Domain not found or invalid");
        await track("ask_ai_turbopuffer_reindex", {
            success: false,
            domain,
            sqsMessageId,
            errorKind: "DomainNotFound",
            error: "Domain not found or invalid",
            durationMs: Date.now() - start,
            launchType: process.env.LAUNCH_TYPE
        });
        await updateJobStatus(domain, JobStatus.FAILED, { error: "Domain not found or invalid" }, log);
        await sendReindexCallback(domain, sqsMessageId, "failure", log);
        return;
    }

    if (metadata.isPreview && !metadata.enableAlgoliaOnPreview) {
        log.info("Skipping preview domain without Algolia enabled");
        await updateJobStatus(domain, JobStatus.COMPLETED, {}, log);
        return;
    }

    const settings = await withRetry(async () => await faiClient.settings.getDocsSettings({ domain }), {
        maxAttempts: 3,
        initialDelayMs: 1000
    });
    if (!settings.docs_enabled) {
        log.info("Ask AI is not enabled, skipping reindex");
        await track("ask_ai_turbopuffer_reindex", {
            success: false,
            domain,
            sqsMessageId,
            errorKind: "AskAINotEnabled",
            error: "Ask AI is not enabled for this domain",
            durationMs: Date.now() - start,
            launchType: process.env.LAUNCH_TYPE
        });
        await updateJobStatus(domain, JobStatus.FAILED, { error: "Ask AI not enabled" }, log);
        await sendReindexCallback(domain, sqsMessageId, "failure", log);
        return;
    }

    try {
        await setJobIdInSettings(domain, sqsMessageId, log);

        // For force full reindex, delete all content hashes and Turbopuffer records first
        if (forceFullReindex) {
            log.info("Force full reindex: deleting all content hashes and Turbopuffer records");

            try {
                await withRetry(async () => await faiClient.contentHash.deleteAllContentHashes(domain), {
                    maxAttempts: 3,
                    initialDelayMs: 1000
                });
                log.info("Successfully deleted all content hashes");
            } catch (error) {
                log.warn("Failed to delete content hashes, continuing with reindex", {
                    error: error instanceof Error ? error.message : String(error)
                });
            }

            try {
                await deleteTurbopufferNamespace(domain);
            } catch (error) {
                log.warn("Failed to delete Turbopuffer namespace, continuing with reindex", {
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }

        await updateJobStatus(domain, JobStatus.UPSERTING, {}, log);

        const result = await runIncrementalTurbopufferUpsertTask(domain);
        const { numInserted, numUpdated, numDeleted, numChunksAdded, numChunksDeleted, changedParentIds } = result;

        await updateJobStatus(domain, JobStatus.SYNCING, {}, log);
        const jobId = await syncToQueryIndexIncremental(domain, changedParentIds);

        const end = Date.now();
        const durationMs = end - start;

        log.info("Reindex completed", {
            durationMs,
            numInserted,
            numUpdated,
            numDeleted,
            numChunksAdded,
            numChunksDeleted,
            jobId,
            sqsMessageId
        });

        await track("ask_ai_turbopuffer_reindex", {
            success: true,
            domain,
            durationMs,
            numInserted,
            numUpdated,
            numDeleted,
            numChunksAdded,
            numChunksDeleted,
            jobId,
            sqsMessageId,
            forceFullReindex,
            launchType: process.env.LAUNCH_TYPE
        });

        await updateJobStatus(
            domain,
            JobStatus.COMPLETED,
            {
                completedAt: new Date().toISOString(),
                durationMs,
                numInserted
            },
            log
        );

        await sendReindexCallback(domain, sqsMessageId, "success", log);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        log.error("Reindex job failed during execution", {
            error: errorMessage,
            stack: errorStack,
            sqsMessageId,
            domain,
            forceFullReindex
        });

        await track("ask_ai_turbopuffer_reindex", {
            success: false,
            domain,
            sqsMessageId,
            errorKind: "ReindexExecutionError",
            error: errorMessage,
            durationMs: Date.now() - start,
            launchType: process.env.LAUNCH_TYPE
        });

        await updateJobStatus(domain, JobStatus.FAILED, { error: errorMessage }, log);
        await sendReindexCallback(domain, sqsMessageId, "failure", log);
    }
}

async function sendReindexCallback(
    domain: string,
    sqsMessageId: string,
    status: "success" | "failure",
    log: Logger
): Promise<void> {
    try {
        const callbackUrl = `${env.faiOrigin}/settings/ask-ai/reindex-callback`;

        await withRetry(
            async () => {
                const response = await fetch(callbackUrl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${env.fernToken}`
                    },
                    body: JSON.stringify({
                        status,
                        sourceMessageId: sqsMessageId,
                        domain
                    })
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                log.info("Successfully sent reindex callback to FAI", {
                    status,
                    sqsMessageId
                });
            },
            { maxAttempts: 3, initialDelayMs: 1000 }
        );
    } catch (error) {
        log.error("Error sending reindex callback to FAI after retries", {
            error: error instanceof Error ? error.message : String(error),
            sqsMessageId
        });
    }
}

async function setJobIdInSettings(domain: string, jobId: string, log: Logger): Promise<void> {
    try {
        await withRetry(
            async () => {
                await faiClient.settings.setJobId({
                    domain,
                    job_id: jobId
                });

                log.info("Successfully set job_id in settings", { domain, jobId });
            },
            { maxAttempts: 3, initialDelayMs: 1000 }
        );
    } catch (error) {
        log.error("Error setting job_id in settings after retries", {
            error: error instanceof Error ? error.message : String(error),
            domain,
            jobId
        });
    }
}
