import type { Logger } from "winston";
import { faiClient } from "../config/clients";
import { env } from "../config/env";
import { createDomainLogger } from "../config/logger";
import { updateJobStatus } from "../services/job-tracker";
import { track } from "../services/posthog";
import { syncToQueryIndex } from "../services/sync";
import { runTurbopufferUpsertTask } from "../services/turbopuffer/turbopuffer";
import { JobStatus, type ReindexJobMessage } from "../types";
import { getDocsUrlMetadata } from "../utils/docs-metadata";
import { withRetry } from "../utils/retry";

export async function processReindexJob(message: ReindexJobMessage, sqsMessageId: string): Promise<void> {
    const { domain, deleteExisting = true } = message;
    const log = createDomainLogger(domain);
    const start = Date.now();

    log.info("Starting reindex job", { sqsMessageId, deleteExisting });

    const metadata = await getDocsUrlMetadata(domain);
    if (!metadata) {
        log.error("Domain not found or invalid");
        await track("ask_ai_turbopuffer_reindex", {
            success: false,
            domain,
            sqsMessageId,
            errorKind: "DomainNotFound",
            error: "Domain not found or invalid",
            durationMs: Date.now() - start
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
            durationMs: Date.now() - start
        });
        await updateJobStatus(domain, JobStatus.FAILED, { error: "Ask AI not enabled" }, log);
        await sendReindexCallback(domain, sqsMessageId, "failure", log);
        return;
    }

    await updateJobStatus(domain, JobStatus.UPSERTING, {}, log);
    const numInserted = await runTurbopufferUpsertTask(domain, deleteExisting);

    await updateJobStatus(domain, JobStatus.SYNCING, {}, log);
    const jobId = await syncToQueryIndex(domain);

    const end = Date.now();
    const durationMs = end - start;

    log.info("Reindex completed", { durationMs, numInserted, jobId, sqsMessageId });

    await track("ask_ai_turbopuffer_reindex", {
        success: true,
        domain,
        durationMs,
        numInserted,
        jobId,
        sqsMessageId,
        deleteExisting
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
