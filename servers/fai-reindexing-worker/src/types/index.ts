/**
 * Message format for reindexing jobs
 */
export interface ReindexJobMessage {
    domain: string;
    deleteExisting?: boolean;
}

/**
 * Job status stored in KV
 */
export interface JobStatus {
    status: "in_progress" | "completed" | "failed";
    started_at?: string;
    completed_at?: string;
    duration_ms?: number;
    num_inserted?: number;
    job_id?: string;
    error?: string;
}

/**
 * Docs metadata from FDR
 */
export interface DocsMetadata {
    baseUrl: string;
    isPreview: boolean;
    enableAlgoliaOnPreview: boolean;
}
