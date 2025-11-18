import { faiClient } from "../config/clients";
import { createDomainLogger } from "../config/logger";
import { getDocsUrlMetadata } from "../services/getDocsUrlMetadata";
import { setJobStatus } from "../services/kv";
import { syncToQueryIndex } from "../services/sync";
import { runTurbopufferUpsertTask } from "../services/turbopuffer/turbopuffer";
import type { ReindexJobMessage } from "../types";

export async function processReindexJob(message: ReindexJobMessage): Promise<void> {
    const { domain, deleteExisting = true } = message;
    const log = createDomainLogger(domain);
    const start = Date.now();

    log.info("Starting reindex job", { deleteExisting });

    try {
        const metadata = await getDocsUrlMetadata(domain);
        if (!metadata) {
            log.error("Domain not found or invalid");
            return;
        }

        if (metadata.isPreview && !metadata.enableAlgoliaOnPreview) {
            log.info("Skipping preview domain without Algolia enabled");
            return;
        }

        const settings = await faiClient.settings.getDocsSettings({ domain });
        if (!settings.ask_ai_enabled) {
            log.info("Ask AI is not enabled, skipping reindex");
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

        log.info("Reindex completed", { durationMs, numInserted, jobId });

        await setJobStatus(domain, {
            status: "completed",
            completed_at: new Date().toISOString(),
            duration_ms: durationMs,
            num_inserted: numInserted,
            job_id: jobId
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        log.error("Reindex failed", {
            error: errorMessage,
            stack: errorStack
        });

        await setJobStatus(domain, {
            status: "failed",
            error: errorMessage,
            completed_at: new Date().toISOString()
        });

        throw error;
    }
}
