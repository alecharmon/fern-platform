import * as Sentry from "@sentry/node";
import type { Logger } from "winston";
import { faiClient } from "../config/clients";
import { env } from "../config/env";
import { createDomainLogger } from "../config/logger";
import { updateJobStatus } from "../services/job-tracker";
import { track } from "../services/posthog";
import { flattenDomain, runIncrementalTurbopufferUpsertTask } from "../services/turbopuffer/turbopuffer";
import { JobStatus, type ReindexJobMessage } from "../types";
import { getDocsUrlMetadata } from "../utils/docs-metadata";
import { withRetry } from "../utils/retry";

export async function processReindexJob(message: ReindexJobMessage, sqsMessageId: string): Promise<void> {
    const { domain, basepath, forceFullReindex = false } = message;
    const flatDomain = flattenDomain(domain);
    const log = createDomainLogger(domain);
    const start = Date.now();

    log.info("Starting reindex job", { sqsMessageId, forceFullReindex, domain, basepath, flatDomain });

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
        await updateJobStatus(flatDomain, JobStatus.FAILED, { error: "Domain not found or invalid" }, log);
        await sendReindexCallback(domain, sqsMessageId, "failure", log);
        return;
    }

    if (metadata.isPreview && !metadata.enableAlgoliaOnPreview) {
        log.info("Skipping preview domain without Algolia enabled");
        await updateJobStatus(flatDomain, JobStatus.COMPLETED, {}, log);
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
        await updateJobStatus(flatDomain, JobStatus.FAILED, { error: "Ask AI not enabled" }, log);
        await sendReindexCallback(domain, sqsMessageId, "failure", log);
        return;
    }

    let jobId: string | undefined;

    try {
        await setJobIdInSettings(domain, sqsMessageId, log);

        // For force full reindex, delete all content hashes first so the diff treats everything as "added".
        // The actual Turbopuffer record deletion is handled inside the incremental upsert task,
        // which deletes ALL records in the namespace (not just the ones we have hashes for),
        // ensuring orphaned chunks from failed jobs or pre-hashing indexing are cleaned up.
        if (forceFullReindex) {
            log.info("Force full reindex: deleting all content hashes");

            try {
                await withRetry(async () => await faiClient.contentHash.deleteAllContentHashes(flatDomain), {
                    maxAttempts: 3,
                    initialDelayMs: 1000
                });
                log.info("Successfully deleted all content hashes");
            } catch (error) {
                log.warn("Failed to delete content hashes, continuing with reindex", {
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }

        await updateJobStatus(flatDomain, JobStatus.UPSERTING, {}, log);

        log.info("Calling runIncrementalTurbopufferUpsertTask", {
            domain,
            basepath,
            basepathType: typeof basepath,
            basepathIsUndefined: basepath === undefined,
            basepathIsNull: basepath === null,
            forceFullReindex
        });

        const result = await runIncrementalTurbopufferUpsertTask(domain, basepath, forceFullReindex);
        const { numInserted, numUpdated, numDeleted, numChunksAdded, numChunksDeleted } = result;

        // No sync step needed — records are now written directly to the query namespace
        // with source="fern_docs" and prefixed IDs, eliminating the two-namespace sync.

        const end = Date.now();
        const durationMs = end - start;

        log.info("Reindex completed", {
            durationMs,
            numInserted,
            numUpdated,
            numDeleted,
            numChunksAdded,
            numChunksDeleted,
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
            sqsMessageId,
            forceFullReindex,
            launchType: process.env.LAUNCH_TYPE
        });

        await updateJobStatus(
            flatDomain,
            JobStatus.COMPLETED,
            {
                completedAt: new Date().toISOString(),
                durationMs,
                numInserted
            },
            log
        );

        await sendReindexCallback(domain, sqsMessageId, "success", log, jobId);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        Sentry.captureException(error, {
            tags: { component: "worker", operation: "reindex_job", domain },
            extra: { jobId, sqsMessageId, basepath, forceFullReindex, durationMs: Date.now() - start }
        });
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

        await updateJobStatus(flatDomain, JobStatus.FAILED, { error: errorMessage }, log);
        await sendReindexCallback(domain, sqsMessageId, "failure", log, jobId);
    }
}

async function sendReindexCallback(
    domain: string,
    sqsMessageId: string,
    status: "success" | "failure",
    log: Logger,
    jobId?: string
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
        Sentry.captureException(error, {
            tags: { component: "worker", operation: "reindex_callback", domain },
            extra: { jobId, sqsMessageId, domain, status }
        });
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
