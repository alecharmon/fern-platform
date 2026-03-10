import * as Sentry from "@sentry/node";
import { workerEnv } from "./config/env.worker";
import { logger } from "./config/logger";
import { initSentry } from "./config/sentry";
import type { ReindexJobMessage } from "./types";
import { processReindexJob } from "./workers/reindex";

initSentry("fai-reindexing-worker");

// Export as 'env' for compatibility with existing code
export const env = workerEnv;

/**
 * Delegated Worker Entrypoint
 *
 * This runs as a one-off ECS task spawned by the orchestrator.
 * It processes a single reindexing job passed via environment variables.
 *
 * Flow:
 * 1. Orchestrator receives job from SQS
 * 2. Orchestrator calculates memory/CPU requirements
 * 3. Orchestrator spawns this worker with dynamic resources
 * 4. Worker processes the single job and exits
 */

async function main() {
    const domain = process.env.REINDEX_DOMAIN;
    const basepath = process.env.REINDEX_BASEPATH || undefined;
    const sourceSqsMessageId = process.env.SOURCE_SQS_MESSAGE_ID || "unknown";
    const forceFullReindex = process.env.FORCE_FULL_REINDEX === "true";

    if (!domain) {
        logger.error("Missing required environment variable: REINDEX_DOMAIN");
        process.exit(1);
    }

    logger.info("Starting delegated reindex worker", {
        domain,
        basepath,
        sourceSqsMessageId,
        forceFullReindex
    });

    try {
        const jobMessage: ReindexJobMessage = {
            domain,
            basepath,
            forceFullReindex
        };

        await processReindexJob(jobMessage, sourceSqsMessageId);

        logger.info("Reindex job completed successfully", {
            domain,
            sourceSqsMessageId
        });

        await Sentry.flush(2000);
        process.exit(0);
    } catch (error) {
        Sentry.captureException(error, {
            tags: { component: "worker", domain },
            extra: { sourceSqsMessageId, forceFullReindex }
        });
        logger.error("Reindex job failed", {
            domain,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            sourceSqsMessageId
        });

        await Sentry.flush(2000);
        process.exit(1);
    }
}

main();
