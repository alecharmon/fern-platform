/**
 * Number of days after which PDF export tasks (and their S3 objects) are
 * eligible for deletion by the cleanup job.
 */
export const PDF_EXPORT_RETENTION_DAYS = 30;

/**
 * Hard timeout (ms) for a single PDF export task.
 *
 * This value is used in two places:
 *  1. **Fargate exporter** — as the deadline after which the task self-terminates.
 *  2. **Cleanup cron** — RUNNING tasks whose `startedAt` is older than this are marked FAILED.
 */
export const PDF_EXPORT_TASK_TIMEOUT_MS = 20 * 60 * 1_000; // 20 minutes
