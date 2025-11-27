import { FernAIClient } from "@fern-api/fai-sdk";
import type { Logger } from "winston";
import { env } from "../config/env";
import { type JobRecord, JobStatus } from "../types";
import { withRetry } from "../utils/retry";

const faiClient = new FernAIClient({
    environment: env.faiOrigin,
    token: env.fernToken
});

export async function getJobRecord(domain: string, log: Logger): Promise<JobRecord | null> {
    try {
        const response = await withRetry(
            async () => await faiClient.reindexing.getReindexingJobStatusByDomain(domain),
            {
                maxAttempts: 3,
                initialDelayMs: 1000
            }
        );

        return {
            domain: response.domain,
            status: response.status as JobStatus,
            memoryMB: response.memory_mb,
            retryCount: response.retry_count,
            taskArn: response.task_arn,
            sqsMessageId: response.sqs_message_id,
            startedAt: response.started_at?.toString(),
            updatedAt: response.updated_at?.toString(),
            completedAt: response.completed_at?.toString(),
            durationMs: response.duration_ms,
            numInserted: response.num_inserted,
            error: response.error,
            reason: response.reason,
            taskArns: response.task_arns
        };
    } catch (error) {
        // 404 means no record exists yet - this is normal when checking if a job is already running
        if (error && typeof error === "object" && "statusCode" in error && error.statusCode === 404) {
            return null;
        }

        log.error("Failed to get job record", {
            domain,
            error: error instanceof Error ? error.message : String(error)
        });
        return null;
    }
}

export async function isJobRunning(domain: string, log: Logger): Promise<boolean> {
    const record = await getJobRecord(domain, log);

    if (!record) {
        return false;
    }

    const runningStatuses = [
        JobStatus.RECEIVED,
        JobStatus.BATCHING,
        JobStatus.UPSERTING,
        JobStatus.SYNCING,
        JobStatus.OOM_RETRY
    ];

    return runningStatuses.includes(record.status);
}

export async function upsertJobRecord(record: Partial<JobRecord> & { domain: string }, log: Logger): Promise<void> {
    await withRetry(
        async () =>
            await faiClient.reindexing.updateReindexingJobStatus(record.domain, {
                status: record.status ?? JobStatus.RECEIVED,
                memory_mb: record.memoryMB,
                retry_count: record.retryCount,
                task_arn: record.taskArn,
                sqs_message_id: record.sqsMessageId,
                completed_at: record.completedAt,
                duration_ms: record.durationMs,
                num_inserted: record.numInserted,
                error: record.error,
                reason: record.reason
            }),
        { maxAttempts: 3, initialDelayMs: 1000 }
    );

    log.info("Upserted job record", {
        domain: record.domain,
        status: record.status,
        retryCount: record.retryCount
    });
}

export async function updateJobStatus(
    domain: string,
    status: JobStatus,
    additionalFields: Partial<JobRecord> = {},
    log: Logger
): Promise<void> {
    try {
        await upsertJobRecord(
            {
                domain,
                status,
                ...additionalFields
            },
            log
        );

        log.info("Updated job status", { domain, status });
    } catch (error) {
        log.error("Failed to update job status", {
            domain,
            status,
            error: error instanceof Error ? error.message : String(error)
        });
    }
}

export async function incrementRetryCount(
    domain: string,
    newMemoryMB: number,
    taskArn: string,
    log: Logger
): Promise<number> {
    const existing = await getJobRecord(domain, log);
    const newRetryCount = (existing?.retryCount ?? 0) + 1;

    await upsertJobRecord(
        {
            domain,
            status: JobStatus.OOM_RETRY,
            memoryMB: newMemoryMB,
            retryCount: newRetryCount,
            taskArn,
            reason: `OOM recovery: attempt ${newRetryCount}, increased to ${newMemoryMB}MB`
        },
        log
    );

    return newRetryCount;
}

export async function getMemoryOverride(domain: string, log: Logger): Promise<number | null> {
    const record = await getJobRecord(domain, log);

    if (record?.memoryMB && record.memoryMB > 0 && record.reason) {
        log.info("Found memory override in job record", {
            domain,
            memoryMB: record.memoryMB,
            reason: record.reason
        });
        return record.memoryMB;
    }

    return null;
}
