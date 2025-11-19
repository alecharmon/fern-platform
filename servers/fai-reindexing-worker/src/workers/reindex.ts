import type { Logger } from "winston";
import { faiClient } from "../config/clients";
import { env } from "../config/env";
import { createDomainLogger } from "../config/logger";
import { getDocsUrlMetadata } from "../services/getDocsUrlMetadata";
import { setJobStatus } from "../services/kv";
import { track } from "../services/posthog";
import { syncToQueryIndex } from "../services/sync";
import { runTurbopufferUpsertTask } from "../services/turbopuffer/turbopuffer";
import type { ReindexJobMessage } from "../types";

export async function processReindexJob(message: ReindexJobMessage, sqsMessageId: string): Promise<void> {
    const { domain, deleteExisting = true } = message;
    const log = createDomainLogger(domain);
    const start = Date.now();

    log.info("Starting reindex job", { sqsMessageId, deleteExisting });

    try {
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
            await sendReindexCallback(domain, sqsMessageId, "failure", log);
            return;
        }

        if (metadata.isPreview && !metadata.enableAlgoliaOnPreview) {
            log.info("Skipping preview domain without Algolia enabled");
            return;
        }

        const settings = await faiClient.settings.getDocsSettings({ domain });
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
            await sendReindexCallback(domain, sqsMessageId, "failure", log);
            return;
        }

        await setJobStatus(domain, {
            status: "in_progress",
            started_at: new Date().toISOString()
        });

        const numInserted = await runTurbopufferUpsertTask(domain, deleteExisting);

        const jobId = await syncToQueryIndex(domain);

        const end = Date.now();
        const durationMs = end - start;

        log.info("Reindex completed", { durationMs, numInserted, jobId, sqsMessageId });

        await setJobStatus(domain, {
            status: "completed",
            completed_at: new Date().toISOString(),
            duration_ms: durationMs,
            num_inserted: numInserted,
            job_id: jobId
        });

        await track("ask_ai_turbopuffer_reindex", {
            success: true,
            domain,
            durationMs,
            numInserted,
            jobId,
            sqsMessageId,
            deleteExisting
        });

        await sendReindexCallback(domain, sqsMessageId, "success", log);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        const end = Date.now();
        const durationMs = end - start;

        log.error("Reindex failed", {
            error: errorMessage,
            stack: errorStack
        });

        await setJobStatus(domain, {
            status: "failed",
            error: errorMessage,
            completed_at: new Date().toISOString()
        });

        let errorString = errorMessage;
        if (errorString.length > 1000) {
            errorString = errorString.slice(0, 1000) + "...";
        }

        await track("ask_ai_turbopuffer_reindex", {
            success: false,
            domain,
            sqsMessageId,
            errorKind: "UnknownError",
            error: errorString,
            durationMs
        });

        await sendReindexCallback(domain, sqsMessageId, "failure", log);

        throw error;
    }
}

/**
 * Send callback to FAI server when reindex job completes or fails
 */
async function sendReindexCallback(
    domain: string,
    sqsMessageId: string,
    status: "success" | "failure",
    log: Logger
): Promise<void> {
    try {
        const callbackUrl = `${env.faiOrigin}/settings/ask-ai/reindex-callback`;

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
            log.warn("Failed to send reindex callback to FAI", {
                status: response.status,
                statusText: response.statusText,
                sqsMessageId
            });
        } else {
            log.info("Successfully sent reindex callback to FAI", {
                status,
                sqsMessageId
            });
        }
    } catch (error) {
        log.error("Error sending reindex callback to FAI", {
            error: error instanceof Error ? error.message : String(error),
            sqsMessageId
        });
    }
}
