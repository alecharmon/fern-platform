import * as Sentry from "@sentry/node";
import { faiClient } from "../config/clients";
import { createDomainLogger } from "../config/logger";
import { updateJobStatusById } from "../services/job-tracker";
import { track } from "../services/posthog";
import { runIncrementalTurbopufferUpsertTask } from "../services/turbopuffer/turbopuffer";
import { JobStatus, type ReindexJobMessage } from "../types";
import { getDocsUrlMetadata } from "../utils/docs-metadata";
import { withRetry } from "../utils/retry";

export async function processReindexJob(message: ReindexJobMessage, sqsMessageId: string): Promise<void> {
    const { domain, basepath: rawBasepath, jobId } = message;
    // Normalize basepath to always have a leading "/" (matching runIncrementalTurbopufferUpsertTask)
    const basepath = rawBasepath ? (rawBasepath.startsWith("/") ? rawBasepath : `/${rawBasepath}`) : undefined;
    const log = createDomainLogger(domain);
    const start = Date.now();

    log.info("Starting reindex job", {
        sqsMessageId,
        jobId,
        domain,
        basepath,
        rawBasepath
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
        if (jobId) {
            await updateJobStatusById(jobId, JobStatus.UPSERTING, {}, log);
        }

        log.info("Calling runIncrementalTurbopufferUpsertTask", {
            domain,
            basepath
        });

        const result = await runIncrementalTurbopufferUpsertTask(domain, basepath);
        const { numInserted, numUpdated, numDeleted, numChunksAdded, numChunksDeleted, numSkipped } = result;

        const end = Date.now();
        const durationMs = end - start;

        log.info("Reindex completed", {
            durationMs,
            numInserted,
            numUpdated,
            numDeleted,
            numChunksAdded,
            numChunksDeleted,
            numSkipped,
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
            numSkipped,
            jobId,
            sqsMessageId,
            launchType: process.env.LAUNCH_TYPE
        });

        if (jobId) {
            await updateJobStatusById(
                jobId,
                JobStatus.COMPLETED,
                {
                    completedAt: new Date().toISOString(),
                    numInserted,
                    numDeleted: numChunksDeleted
                },
                log
            );
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        Sentry.captureException(error, {
            tags: { component: "worker", operation: "reindex_job", domain },
            extra: { jobId, sqsMessageId, basepath, durationMs: Date.now() - start }
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
