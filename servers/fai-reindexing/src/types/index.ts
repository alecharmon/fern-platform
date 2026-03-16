/**
 * Message format for reindexing jobs received from SQS.
 * The `jobId` field references the reindexing_jobs row created by FAI
 * before the SQS message was sent.
 */
export interface ReindexJobMessage {
    domain: string;
    basepath?: string;
    forceFullReindex?: boolean;
    jobId?: string;
}

/**
 * Job status enum for tracking job lifecycle.
 * QUEUED is set by FAI when the SQS message is sent.
 */
export enum JobStatus {
    QUEUED = "queued",
    RECEIVED = "received",
    BATCHING = "batching",
    UPSERTING = "upserting",
    SYNCING = "syncing",
    COMPLETED = "completed",
    FAILED = "failed",
    OOM_RETRY = "oom_retry"
}

/**
 * Job record stored in the reindexing_jobs table.
 * Each row is 1-to-1 with an SQS message.
 */
export interface JobRecord {
    id: string;
    domain: string;
    basepath?: string;
    forceFullReindex: boolean;
    status: JobStatus;
    memoryMB: number;
    retryCount: number;
    sqsMessageId?: string;
    startedAt?: string;
    updatedAt: string;
    completedAt?: string;
    numInserted?: number;
    numDeleted?: number;
    jobTotalTimeMs?: number;
    error?: string;
    reason?: string;
    taskArns?: string[];
}

/**
 * Docs metadata from FDR
 */
export interface DocsMetadata {
    baseUrl: string;
    isPreview: boolean;
    enableAlgoliaOnPreview: boolean;
}
