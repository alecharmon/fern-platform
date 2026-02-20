/**
 * Message format for reindexing jobs
 */
export interface ReindexJobMessage {
    domain: string;
    basepath?: string;
    forceFullReindex?: boolean;
}

/**
 * Job status enum for tracking job lifecycle
 */
export enum JobStatus {
    RECEIVED = "received", // Message polled, calculating resources
    BATCHING = "batching",
    UPSERTING = "upserting",
    SYNCING = "syncing",
    COMPLETED = "completed",
    FAILED = "failed",
    OOM_RETRY = "oom_retry"
}

/**
 * Job record stored in DynamoDB metadata table
 * Uses domain as partition key
 */
export interface JobRecord {
    domain: string; // Partition key
    status: JobStatus;
    memoryMB: number;
    retryCount: number;
    taskArn?: string;
    sqsMessageId?: string;
    startedAt?: string;
    updatedAt: string;
    completedAt?: string;
    durationMs?: number;
    numInserted?: number;
    error?: string;
    reason?: string; // For memory overrides
    taskArns?: string[]; // History of task ARNs for this job
}

/**
 * Docs metadata from FDR
 */
export interface DocsMetadata {
    baseUrl: string;
    isPreview: boolean;
    enableAlgoliaOnPreview: boolean;
}
