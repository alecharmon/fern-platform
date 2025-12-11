import type { Logger } from "winston";
import { faiClient } from "../config/clients";
import { env } from "../config/env";
import { createDomainLogger } from "../config/logger";
import { updateJobStatus } from "../services/job-tracker";
import { isPosthogFeatureFlagEnabled, track } from "../services/posthog";
import { syncToQueryIndex, syncToQueryIndexIncremental } from "../services/sync";
import { runIncrementalTurbopufferUpsertTask, runTurbopufferUpsertTask } from "../services/turbopuffer/turbopuffer";
import { JobStatus, type ReindexJobMessage } from "../types";
import { getDocsUrlMetadata } from "../utils/docs-metadata";
import { withRetry } from "../utils/retry";

export async function processReindexJob(message: ReindexJobMessage, sqsMessageId: string): Promise<void> {
    const { domain } = message;
    const log = createDomainLogger(domain);
    const start = Date.now();

    const incremental = await isPosthogFeatureFlagEnabled("fai-incremental-indexing-enabled", domain);
    const deleteExisting = !incremental;

    log.info("Starting reindex job", { sqsMessageId, deleteExisting, incremental });

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
        await updateJobStatus(domain, JobStatus.UPSERTING, {}, log);

        let numInserted: number;
        let numUpdated = 0;
        let numDeleted = 0;
        let numChunksAdded = 0;
        let numChunksDeleted = 0;
        let changedParentIds: string[] = [];

        if (incremental) {
            const result = await runIncrementalTurbopufferUpsertTask(domain);
            numInserted = result.numInserted;
            numUpdated = result.numUpdated;
            numDeleted = result.numDeleted;
            numChunksAdded = result.numChunksAdded;
            numChunksDeleted = result.numChunksDeleted;
            changedParentIds = result.changedParentIds;
        } else {
            numInserted = await runTurbopufferUpsertTask(domain, deleteExisting);
        }

        await updateJobStatus(domain, JobStatus.SYNCING, {}, log);
        const jobId = incremental
            ? await syncToQueryIndexIncremental(domain, changedParentIds)
            : await syncToQueryIndex(domain);

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
            deleteExisting,
            incremental,
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
        log.error("Reindex job failed during execution", { error: errorMessage, sqsMessageId });

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
