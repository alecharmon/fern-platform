import { env } from "./config/env";
import { logger } from "./config/logger";
import { pollSQSQueue } from "./workers/queue";

/**
 * FAI Reindexing Worker
 *
 * Polls SQS queue for reindexing jobs and processes them by:
 * 1. Fetching documentation from FDR
 * 2. Creating and vectorizing search records
 * 3. Upserting to Turbopuffer
 * 4. Syncing to FAI query index
 * 5. Tracking job status in Vercel KV
 */

logger.info("Starting FAI Reindexing Worker", {
    sqsQueueUrl: env.sqsQueueUrl,
    faiOrigin: env.faiOrigin,
    fdrOrigin: env.fdrOrigin
});

pollSQSQueue().catch((error) => {
    logger.error("Fatal error in worker", { error });
    process.exit(1);
});
