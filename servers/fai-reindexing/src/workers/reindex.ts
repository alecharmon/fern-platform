import * as Sentry from "@sentry/node";
import { faiClient } from "../config/clients";
import { createDomainLogger } from "../config/logger";
import { updateJobStatusById } from "../services/job-tracker";
import { track } from "../services/posthog";
import { flattenDomain, runIncrementalTurbopufferUpsertTask } from "../services/turbopuffer/turbopuffer";
import { JobStatus, type ReindexJobMessage } from "../types";
import { getDocsUrlMetadata } from "../utils/docs-metadata";
import { withRetry } from "../utils/retry";

export async function processReindexJob(message: ReindexJobMessage, sqsMessageId: string): Promise<void> {
    const { domain, basepath: rawBasepath, forceFullReindex = false, jobId } = message;
    // Normalize basepath to always have a leading "/" (matching runIncrementalTurbopufferUpsertTask)
    const basepath = rawBasepath ? (rawBasepath.startsWith("/") ? rawBasepath : `/${rawBasepath}`) : undefined;
    const flatDomain = flattenDomain(domain);
    const log = createDomainLogger(domain);
    const start = Date.now();

    log.info("Starting reindex job", {
        sqsMessageId,
        jobId,
        forceFullReindex,
        domain,
        basepath,
        rawBasepath,
        flatDomain
    });

    const metadata = await getDocsUrlMetadata(domain);
    if (!metadata) {
        log.error("Domain not found or invalid");
        await track("ask_ai_turbopuffer_reindex", {
            success: false,
            domain,
            sqsMessageId,
            jobId,
            errorKind: "DomainNotFound",
            error: "Domain not found or invalid",
            durationMs: Date.now() - start,
            launchType: process.env.LAUNCH_TYPE
        });
        if (jobId) {
            await updateJobStatusById(jobId, JobStatus.FAILED, { error: "Domain not found or invalid" }, log);
        }
        return;
    }

    if (metadata.isPreview && !metadata.enableAlgoliaOnPreview) {
        log.info("Skipping preview domain without Algolia enabled");
        if (jobId) {
            await updateJobStatusById(jobId, JobStatus.COMPLETED, {}, log);
        }
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
            jobId,
            errorKind: "AskAINotEnabled",
            error: "Ask AI is not enabled for this domain",
            durationMs: Date.now() - start,
            launchType: process.env.LAUNCH_TYPE
        });
        if (jobId) {
            await updateJobStatusById(jobId, JobStatus.FAILED, { error: "Ask AI not enabled" }, log);
        }
        return;
    }

    try {
        // For force full reindex, delete all content hashes first so the diff treats everything as "added".
        // The actual Turbopuffer record deletion is handled inside the incremental upsert task,
        // which deletes ALL records in the namespace (not just the ones we have hashes for),
        // ensuring orphaned chunks from failed jobs or pre-hashing indexing are cleaned up.
        if (forceFullReindex) {
            // Use basepath-qualified domain for content hash operations so that
            // different basepaths (e.g. /apple and /banana) have separate content hash stores.
            const contentHashDomain = basepath ? flattenDomain(`${domain}${basepath}`) : flatDomain;
            log.info("Force full reindex: deleting all content hashes", { contentHashDomain });

            try {
                await withRetry(async () => await faiClient.contentHash.deleteAllContentHashes(contentHashDomain), {
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

        if (jobId) {
            await updateJobStatusById(jobId, JobStatus.UPSERTING, {}, log);
        }

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

        if (jobId) {
            await updateJobStatusById(
                jobId,
                JobStatus.COMPLETED,
                {
                    completedAt: new Date().toISOString(),
                    numInserted
                },
                log
            );
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        Sentry.captureException(error, {
            tags: { component: "worker", operation: "reindex_job", domain },
            extra: { jobId, sqsMessageId, basepath, forceFullReindex, durationMs: Date.now() - start }
        });
        log.error("Reindex job failed during execution", { error: errorMessage, sqsMessageId, jobId });

        await track("ask_ai_turbopuffer_reindex", {
            success: false,
            domain,
            sqsMessageId,
            jobId,
            errorKind: "ReindexExecutionError",
            error: errorMessage,
            durationMs: Date.now() - start,
            launchType: process.env.LAUNCH_TYPE
        });

        if (jobId) {
            await updateJobStatusById(jobId, JobStatus.FAILED, { error: errorMessage }, log);
        }
    }
}
