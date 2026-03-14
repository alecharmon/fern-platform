import { DescribeTasksCommand, ECSClient } from "@aws-sdk/client-ecs";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import type { EventBridgeEvent } from "aws-lambda";

const sqsClient = new SQSClient({ region: process.env.AWS_REGION || "us-east-1" });
const ecsClient = new ECSClient({ region: process.env.AWS_REGION || "us-east-1" });

const FAI_ORIGIN = process.env.FAI_ORIGIN || "https://fai.buildwithfern.com";
const FERN_TOKEN = process.env.FERN_TOKEN;
const MAX_RETRIES = 2;
const OOM_INDICATORS = ["outofmemory", "out of memory", "oom", "memory"];

type OOMJobStatus = "failed" | "oom_retry";

const logger = {
    info: (msg: string, meta?: Record<string, unknown>) =>
        // biome-ignore lint/suspicious/noConsole: Lambda functions use console for CloudWatch logs
        console.log(JSON.stringify({ level: "info", message: msg, ...meta })),
    error: (msg: string, meta?: Record<string, unknown>) =>
        // biome-ignore lint/suspicious/noConsole: Lambda functions use console for CloudWatch logs
        console.error(JSON.stringify({ level: "error", message: msg, ...meta })),
    warn: (msg: string, meta?: Record<string, unknown>) =>
        // biome-ignore lint/suspicious/noConsole: Lambda functions use console for CloudWatch logs
        console.warn(JSON.stringify({ level: "warn", message: msg, ...meta }))
};

function errStr(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            if (attempt < maxAttempts) {
                await new Promise((resolve) => setTimeout(resolve, Math.min(1000 * 2 ** (attempt - 1), 30000)));
            }
        }
    }
    throw lastError;
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

interface ECSTaskStateChangeEvent {
    clusterArn: string;
    taskArn: string;
    lastStatus: string;
    desiredStatus: string;
    stoppedReason?: string;
    stopCode?: string;
    containers: Array<{ name: string; exitCode?: number; reason?: string }>;
    tags?: Array<{ key: string; value: string }>;
}

interface JobRecord {
    id: string;
    domain: string;
    status: string;
    memoryMB: number;
    retryCount: number;
    taskArn?: string;
    sqsMessageId?: string;
}

interface TaskMetadata {
    domain: string;
    memoryMB: number;
    sqsMessageId: string;
}

const OOM_UPDATE_FIELDS: Record<string, string> = {
    memoryMb: "memory_mb",
    retryCount: "retry_count",
    taskArn: "task_arn",
    reason: "reason"
};

export async function handler(event: EventBridgeEvent<"ECS Task State Change", ECSTaskStateChangeEvent>) {
    logger.info("Received ECS task state change event", { event: event as unknown as Record<string, unknown> });

    const detail = event.detail;
    if (detail.lastStatus !== "STOPPED") {
        return;
    }
    if (!checkIfOOM(detail)) {
        return;
    }

    const jobRecord = await getJobRecordByTaskArn(detail.taskArn);
    let domain: string;
    let memoryMB: number;
    let sqsMessageId: string;

    if (jobRecord) {
        domain = jobRecord.domain;
        memoryMB = jobRecord.memoryMB || 0;
        sqsMessageId = jobRecord.sqsMessageId || "unknown";
        logger.info("Found job record by taskArn", { jobId: jobRecord.id, domain, taskArn: detail.taskArn });
    } else {
        const metadata = await extractTaskMetadata(detail);
        if (!metadata) {
            logger.error("Skipping OOM recovery: no job record or tags found", { taskArn: detail.taskArn });
            return;
        }
        domain = metadata.domain;
        memoryMB = metadata.memoryMB;
        sqsMessageId = metadata.sqsMessageId;
    }

    const currentRetryCount = jobRecord?.retryCount ?? 0;
    if (currentRetryCount >= MAX_RETRIES) {
        logger.error("Max retries exceeded", { domain, jobId: jobRecord?.id, retryCount: currentRetryCount });
        if (jobRecord?.id) {
            await updateJobStatus(jobRecord.id, "failed", { reason: `Max OOM retries exceeded (${MAX_RETRIES})` });
        }
        return;
    }

    const newRetryCount = currentRetryCount + 1;
    const newMemoryMB = memoryMB * 2;

    if (jobRecord?.id) {
        await updateJobStatus(jobRecord.id, "oom_retry", {
            memoryMb: newMemoryMB,
            retryCount: newRetryCount,
            taskArn: detail.taskArn,
            reason: `OOM recovery: attempt ${newRetryCount}, ${memoryMB}MB -> ${newMemoryMB}MB`
        });
    }

    await requeueJob(domain);

    logger.info("OOM recovery complete", {
        domain,
        jobId: jobRecord?.id,
        messageId: sqsMessageId,
        oldMemoryMB: memoryMB,
        newMemoryMB,
        retryCount: newRetryCount
    });
}

function checkIfOOM(detail: ECSTaskStateChangeEvent): boolean {
    if (detail.containers.some((c) => c.exitCode === 137)) {
        return true;
    }
    const matches = (text?: string) => OOM_INDICATORS.some((p) => (text?.toLowerCase() ?? "").includes(p));
    return matches(detail.stoppedReason) || detail.containers.some((c) => matches(c.reason));
}

async function extractTaskMetadata(detail: ECSTaskStateChangeEvent): Promise<TaskMetadata | null> {
    let tags = detail.tags || [];

    if (tags.length === 0) {
        try {
            const response = await withRetry(async () =>
                ecsClient.send(
                    new DescribeTasksCommand({
                        cluster: detail.clusterArn,
                        tasks: [detail.taskArn],
                        include: ["TAGS"]
                    })
                )
            );
            const task = response.tasks?.[0];
            if (!task?.tags?.length) {
                logger.error("No tags returned from DescribeTasks", { taskArn: detail.taskArn });
                return null;
            }
            tags = task.tags.map((t) => ({ key: t.key || "", value: t.value || "" }));
        } catch (error) {
            logger.error("Failed to fetch tags from ECS", { taskArn: detail.taskArn, error: errStr(error) });
            return null;
        }
    }

    const tagMap: Record<string, string> = {};
    for (const tag of tags) {
        tagMap[tag.key] = tag.value;
    }

    const domain = tagMap.Domain;
    const memoryMB = tagMap.MemoryMB ? Number.parseInt(tagMap.MemoryMB) : undefined;
    const sqsMessageId = tagMap.SqsMessageId;

    if (!domain || !memoryMB || !sqsMessageId) {
        logger.error("Missing required tags", { availableTags: Object.keys(tagMap) });
        return null;
    }

    return { domain, memoryMB, sqsMessageId };
}

async function getJobRecordByTaskArn(taskArn: string): Promise<JobRecord | null> {
    try {
        const data = await withRetry(async () => {
            const res = await faiRequest(`/reindexing/jobs/task-arn?task_arn=${encodeURIComponent(taskArn)}`);
            if (res.status === 404) {
                return null;
            }
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }
            return res.json();
        });
        if (!data) {
            return null;
        }

        const d = data as Record<string, unknown>;
        return {
            id: d.id as string,
            domain: d.domain as string,
            status: d.status as string,
            memoryMB: (d.memory_mb as number) ?? 0,
            retryCount: (d.retry_count as number) ?? 0,
            taskArn: d.task_arn as string | undefined,
            sqsMessageId: d.sqs_message_id as string | undefined
        };
    } catch (error) {
        logger.error("Failed to get job record by taskArn", { taskArn, error: errStr(error) });
        return null;
    }
}

async function updateJobStatus(
    jobId: string,
    status: OOMJobStatus,
    fields: Partial<{ memoryMb: number; retryCount: number; taskArn: string; reason: string }> = {}
): Promise<void> {
    const params = new URLSearchParams({ status });
    for (const [key, paramName] of Object.entries(OOM_UPDATE_FIELDS)) {
        const value = fields[key as keyof typeof fields];
        if (value != null) {
            params.set(paramName, String(value));
        }
    }

    await withRetry(async () => {
        const res = await faiRequest(`/reindexing/jobs/${jobId}/status?${params.toString()}`, { method: "POST" });
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
    });
    logger.info("Updated job status", { jobId, status, ...fields });
}

async function requeueJob(domain: string): Promise<void> {
    const queueUrl = process.env.SQS_QUEUE_URL;
    if (!queueUrl) {
        throw new Error("SQS_QUEUE_URL environment variable not set");
    }

    let newJobId: string | undefined;
    try {
        const createRes = await withRetry(async () => {
            const res = await faiRequest("/reindexing/jobs", { method: "POST", body: JSON.stringify({ domain }) });
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }
            return res.json();
        });
        newJobId = (createRes as Record<string, unknown>).job_id as string;
        logger.info("Created new job for OOM retry", { domain, newJobId });
    } catch (error) {
        logger.error("Failed to create new job for OOM retry", { domain, error: errStr(error) });
    }

    const message: Record<string, unknown> = { domain };
    if (newJobId) {
        message.jobId = newJobId;
    }

    const sendResult = await withRetry(async () =>
        sqsClient.send(new SendMessageCommand({ QueueUrl: queueUrl, MessageBody: JSON.stringify(message) }))
    );

    if (newJobId && sendResult.MessageId) {
        try {
            await withRetry(async () => {
                const res = await faiRequest(
                    `/reindexing/jobs/${newJobId}/sqs-message-id?sqs_message_id=${encodeURIComponent(sendResult.MessageId!)}`,
                    { method: "POST" }
                );
                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                }
            });
        } catch (error) {
            logger.warn("Failed to set SQS message ID on new job", { jobId: newJobId, error: errStr(error) });
        }
    }

    logger.info("Requeued job to SQS", { domain, newJobId, sqsMessageId: sendResult.MessageId });
}
