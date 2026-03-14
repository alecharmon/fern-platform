import * as Sentry from "@sentry/node";
import type { Logger } from "winston";
import { env } from "../config/env";
import type { JobRecord, JobStatus } from "../types";
import { withRetry } from "../utils/retry";

const FAI_ORIGIN = env.faiOrigin;
const FERN_TOKEN = env.fernToken;

function errStr(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

async function faiRequest(path: string, options: RequestInit = {}): Promise<Response> {
    return fetch(`${FAI_ORIGIN}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${FERN_TOKEN}`,
            ...options.headers
        }
    });
}

function parseJobRecord(data: Record<string, unknown>): JobRecord {
    return {
        id: data.id as string,
        domain: data.domain as string,
        basepath: data.basepath as string | undefined,
        forceFullReindex: (data.force_full_reindex as boolean) ?? false,
        status: data.status as JobStatus,
        memoryMB: (data.memory_mb as number) ?? 0,
        retryCount: (data.retry_count as number) ?? 0,
        taskArn: data.task_arn as string | undefined,
        sqsMessageId: data.sqs_message_id as string | undefined,
        startedAt: data.started_at as string | undefined,
        updatedAt: (data.updated_at as string) ?? new Date().toISOString(),
        completedAt: data.completed_at as string | undefined,
        durationMs: data.duration_ms as number | undefined,
        numInserted: data.num_inserted as number | undefined,
        jobTotalTimeMs: data.job_total_time_ms as number | undefined,
        error: data.error as string | undefined,
        reason: data.reason as string | undefined,
        taskArns: data.task_arns as string[] | undefined
    };
}

async function fetchJob(path: string, log: Logger, context: string): Promise<JobRecord | null> {
    try {
        const data = await withRetry(
            async () => {
                const res = await faiRequest(path);
                if (res.status === 404) {
                    return null;
                }
                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                }
                return res.json();
            },
            { maxAttempts: 3, initialDelayMs: 1000 }
        );
        return data ? parseJobRecord(data as Record<string, unknown>) : null;
    } catch (error) {
        log.error(context, { error: errStr(error) });
        return null;
    }
}

export type JobUpdateFields = Partial<{
    memoryMb: number;
    retryCount: number;
    taskArn: string;
    sqsMessageId: string;
    completedAt: string;
    durationMs: number;
    numInserted: number;
    error: string;
    reason: string;
}>;

const FIELD_TO_PARAM: Record<keyof Required<JobUpdateFields>, string> = {
    memoryMb: "memory_mb",
    retryCount: "retry_count",
    taskArn: "task_arn",
    sqsMessageId: "sqs_message_id",
    completedAt: "completed_at",
    durationMs: "duration_ms",
    numInserted: "num_inserted",
    error: "error",
    reason: "reason"
};

export async function getJobById(jobId: string, log: Logger): Promise<JobRecord | null> {
    return fetchJob(`/reindexing/jobs/${jobId}`, log, `Failed to get job ${jobId}`);
}

export async function getRunningJobForDomain(
    domain: string,
    log: Logger,
    basepath?: string
): Promise<JobRecord | null> {
    const params = basepath ? `?basepath=${encodeURIComponent(basepath)}` : "";
    return fetchJob(
        `/reindexing/jobs/domain/${encodeURIComponent(domain)}/running${params}`,
        log,
        `Failed to get running job for ${domain} basepath=${basepath}`
    );
}

export async function getLatestJobForDomain(domain: string, log: Logger): Promise<JobRecord | null> {
    return fetchJob(
        `/reindexing/jobs/domain/${encodeURIComponent(domain)}/latest`,
        log,
        `Failed to get latest job for ${domain}`
    );
}

export async function updateJobStatusById(
    jobId: string,
    status: JobStatus,
    fields: JobUpdateFields = {},
    log: Logger
): Promise<void> {
    try {
        const params = new URLSearchParams({ status });
        for (const [key, paramName] of Object.entries(FIELD_TO_PARAM)) {
            const value = fields[key as keyof JobUpdateFields];
            if (value != null) {
                params.set(paramName, String(value));
            }
        }

        await withRetry(
            async () => {
                const res = await faiRequest(`/reindexing/jobs/${jobId}/status?${params.toString()}`, {
                    method: "POST"
                });
                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                }
            },
            { maxAttempts: 3, initialDelayMs: 1000 }
        );

        log.info("Updated job status", { jobId, status, ...fields });
    } catch (error) {
        Sentry.captureException(error, {
            tags: { component: "job-tracker", operation: "update_job_status" },
            extra: { jobId, status, ...fields }
        });
        log.error("Failed to update job status", { jobId, status, error: errStr(error) });
    }
}

export async function markStaleJobsFailed(domain: string, log: Logger, basepath?: string): Promise<number> {
    try {
        const params = basepath ? `?basepath=${encodeURIComponent(basepath)}` : "";
        const data = await withRetry(
            async () => {
                const res = await faiRequest(
                    `/reindexing/jobs/domain/${encodeURIComponent(domain)}/mark-stale-failed${params}`,
                    { method: "POST" }
                );
                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                }
                return res.json();
            },
            { maxAttempts: 3, initialDelayMs: 1000 }
        );

        const count = ((data as Record<string, unknown>).marked_failed as number) ?? 0;
        if (count > 0) {
            log.warn("Marked stale jobs as failed", { domain, count });
        }
        return count;
    } catch (error) {
        log.error("Failed to mark stale jobs as failed", { domain, error: errStr(error) });
        return 0;
    }
}
