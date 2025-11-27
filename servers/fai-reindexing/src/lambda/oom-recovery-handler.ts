import { DescribeTasksCommand, ECSClient } from "@aws-sdk/client-ecs";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { FernAIClient } from "@fern-api/fai-sdk";
import type { EventBridgeEvent } from "aws-lambda";

const sqsClient = new SQSClient({ region: process.env.AWS_REGION || "us-east-1" });
const ecsClient = new ECSClient({ region: process.env.AWS_REGION || "us-east-1" });

const faiClient = new FernAIClient({
    environment: process.env.FAI_ORIGIN || "https://fai.buildwithfern.com",
    token: process.env.FERN_TOKEN
});

const MEMORY_INCREMENT_MB = 512;
const MAX_RETRIES = 10;

const logger = {
    // biome-ignore lint/suspicious/noConsole: Lambda functions use console for CloudWatch logs
    info: (msg: string, meta?: any) => console.log(JSON.stringify({ level: "info", message: msg, ...meta })),
    // biome-ignore lint/suspicious/noConsole: Lambda functions use console for CloudWatch logs
    error: (msg: string, meta?: any) => console.error(JSON.stringify({ level: "error", message: msg, ...meta })),
    // biome-ignore lint/suspicious/noConsole: Lambda functions use console for CloudWatch logs
    warn: (msg: string, meta?: any) => console.warn(JSON.stringify({ level: "warn", message: msg, ...meta }))
};

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            if (attempt < maxAttempts) {
                const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }
    }
    throw lastError;
}

interface ECSTaskStateChangeEvent {
    clusterArn: string;
    taskArn: string;
    lastStatus: string;
    desiredStatus: string;
    stoppedReason?: string;
    stopCode?: string;
    containers: Array<{
        name: string;
        exitCode?: number;
        reason?: string;
    }>;
    tags?: Array<{
        key: string;
        value: string;
    }>;
}

interface JobRecord {
    domain: string;
    status: string;
    memoryMB: number;
    retryCount: number;
    taskArn?: string;
    sqsMessageId?: string;
    updatedAt: string;
    reason?: string;
    taskArns?: string[];
}

interface TaskMetadata {
    domain: string;
    memoryMB: number;
    sqsMessageId: string;
    launchType: string;
}

export async function handler(event: EventBridgeEvent<"ECS Task State Change", ECSTaskStateChangeEvent>) {
    logger.info("Received ECS task state change event", { event });

    const detail = event.detail;

    if (detail.lastStatus !== "STOPPED") {
        logger.info("Skipping non-STOPPED task", { lastStatus: detail.lastStatus });
        return;
    }

    const isOOM = checkIfOOM(detail);
    if (!isOOM) {
        logger.info("Task did not fail due to OOM, skipping", {
            taskArn: detail.taskArn,
            stopCode: detail.stopCode,
            stoppedReason: detail.stoppedReason
        });
        return;
    }

    let jobRecord = await getJobRecordByTaskArn(detail.taskArn);
    let domain: string;
    let memoryMB: number;
    let sqsMessageId: string;

    if (jobRecord) {
        domain = jobRecord.domain;
        memoryMB = jobRecord.memoryMB || 0;
        sqsMessageId = jobRecord.sqsMessageId || "unknown";

        logger.info("Found job in DynamoDB by taskArn", {
            domain,
            memoryMB,
            taskArn: detail.taskArn
        });
    } else {
        logger.warn("TaskArn not found in DynamoDB, falling back to task tags", {
            taskArn: detail.taskArn
        });

        const metadata = await extractTaskMetadata(detail);
        if (!metadata) {
            logger.error("Skipping OOM recovery: TaskArn not in DynamoDB and failed to extract metadata from tags", {
                taskArn: detail.taskArn
            });
            return;
        }

        domain = metadata.domain;
        memoryMB = metadata.memoryMB;
        sqsMessageId = metadata.sqsMessageId;

        jobRecord = await getJobRecord(domain);
    }

    logger.info("Detected OOM failure", {
        domain,
        memoryMB,
        sqsMessageId,
        taskArn: detail.taskArn
    });

    const currentRetryCount = jobRecord?.retryCount ?? 0;
    if (currentRetryCount >= MAX_RETRIES) {
        logger.error("Max retries exceeded for domain", {
            domain,
            messageId: sqsMessageId,
            retryCount: currentRetryCount,
            maxRetries: MAX_RETRIES
        });
        await updateJobRecord(domain, {
            status: "failed",
            reason: `Max OOM retries exceeded (${MAX_RETRIES})`
        });
        return;
    }

    const newRetryCount = currentRetryCount + 1;
    const newMemoryMB = memoryMB + MEMORY_INCREMENT_MB;

    await updateJobRecord(domain, {
        status: "oom_retry",
        memoryMB: newMemoryMB,
        retryCount: newRetryCount,
        taskArn: detail.taskArn,
        reason: `OOM recovery: attempt ${newRetryCount}, increased from ${memoryMB}MB to ${newMemoryMB}MB (task: ${detail.taskArn})`
    });

    await requeueJob({ domain, memoryMB, sqsMessageId, launchType: "Unknown" });

    logger.info("Successfully handled OOM recovery", {
        domain,
        messageId: sqsMessageId,
        oldMemoryMB: memoryMB,
        newMemoryMB,
        retryCount: newRetryCount,
        taskArn: detail.taskArn
    });
}

function checkIfOOM(detail: ECSTaskStateChangeEvent): boolean {
    const hasOOMExitCode = detail.containers.some((container) => container.exitCode === 137);
    if (hasOOMExitCode) {
        return true;
    }

    const stoppedReason = detail.stoppedReason?.toLowerCase() || "";
    const oomIndicators = ["outofmemory", "out of memory", "oom", "memory"];

    if (oomIndicators.some((indicator) => stoppedReason.includes(indicator))) {
        return true;
    }

    const hasOOMReason = detail.containers.some((container) => {
        const reason = container.reason?.toLowerCase() || "";
        return oomIndicators.some((indicator) => reason.includes(indicator));
    });

    return hasOOMReason;
}

async function extractTaskMetadata(detail: ECSTaskStateChangeEvent): Promise<TaskMetadata | null> {
    let tags: Array<{ key: string; value: string }> = detail.tags || [];

    if (tags.length === 0) {
        logger.info("Tags not in event, fetching from ECS API", { taskArn: detail.taskArn });
        try {
            const response = await withRetry(
                async () =>
                    await ecsClient.send(
                        new DescribeTasksCommand({
                            cluster: detail.clusterArn,
                            tasks: [detail.taskArn],
                            include: ["TAGS"]
                        })
                    )
            );

            if (response.tasks && response.tasks.length > 0 && response.tasks[0].tags) {
                tags = response.tasks[0].tags.map((tag) => ({
                    key: tag.key || "",
                    value: tag.value || ""
                }));
                logger.info("Fetched tags from ECS", { tagCount: tags.length });
            } else {
                logger.error("No tags returned from DescribeTasks", { taskArn: detail.taskArn });
                return null;
            }
        } catch (error) {
            logger.error("Failed to fetch tags from ECS", {
                taskArn: detail.taskArn,
                error: error instanceof Error ? error.message : String(error)
            });
            return null;
        }
    }

    const tagMap = tags.reduce(
        (acc, tag) => {
            acc[tag.key] = tag.value;
            return acc;
        },
        {} as Record<string, string>
    );

    const domain = tagMap.Domain;
    const memoryMB = tagMap.MemoryMB ? Number.parseInt(tagMap.MemoryMB) : undefined;
    const sqsMessageId = tagMap.SqsMessageId;
    const launchType = tagMap.LaunchType || "Unknown";

    if (!domain || !memoryMB || !sqsMessageId) {
        logger.error("Missing required tags", { availableTags: Object.keys(tagMap) });
        return null;
    }

    return {
        domain,
        memoryMB,
        sqsMessageId,
        launchType
    };
}

async function getJobRecordByTaskArn(taskArn: string): Promise<JobRecord | null> {
    try {
        const response = await withRetry(
            async () =>
                await faiClient.reindexing.getReindexingJobStatusByTaskArn({
                    task_arn: taskArn
                })
        );

        return {
            domain: response.domain,
            status: response.status,
            memoryMB: response.memory_mb,
            retryCount: response.retry_count,
            taskArn: response.task_arn,
            sqsMessageId: response.sqs_message_id,
            updatedAt: response.updated_at?.toString() || new Date().toISOString(),
            reason: response.reason,
            taskArns: response.task_arns
        };
    } catch (error) {
        logger.error("Failed to get job record by taskArn", { taskArn, error });
        return null;
    }
}

async function getJobRecord(domain: string): Promise<JobRecord | null> {
    try {
        const response = await withRetry(async () => await faiClient.reindexing.getReindexingJobStatusByDomain(domain));

        return {
            domain: response.domain,
            status: response.status,
            memoryMB: response.memory_mb,
            retryCount: response.retry_count,
            taskArn: response.task_arn,
            sqsMessageId: response.sqs_message_id,
            updatedAt: response.updated_at?.toString() || new Date().toISOString(),
            reason: response.reason,
            taskArns: response.task_arns
        };
    } catch (error) {
        logger.error("Failed to get job record", { domain, error });
        return null;
    }
}

async function updateJobRecord(domain: string, updates: Partial<Omit<JobRecord, "domain">>): Promise<void> {
    await withRetry(
        async () =>
            await faiClient.reindexing.updateReindexingJobStatus(domain, {
                status: updates.status,
                memory_mb: updates.memoryMB,
                retry_count: updates.retryCount,
                task_arn: updates.taskArn,
                sqs_message_id: updates.sqsMessageId,
                reason: updates.reason
            })
    );

    logger.info("Updated job record", {
        domain,
        status: updates.status,
        retryCount: updates.retryCount,
        memoryMB: updates.memoryMB
    });
}

async function requeueJob(metadata: TaskMetadata): Promise<void> {
    const queueUrl = process.env.SQS_QUEUE_URL;
    if (!queueUrl) {
        throw new Error("SQS_QUEUE_URL environment variable not set");
    }

    const message = {
        domain: metadata.domain,
        deleteExisting: false
    };

    await withRetry(
        async () =>
            await sqsClient.send(
                new SendMessageCommand({
                    QueueUrl: queueUrl,
                    MessageBody: JSON.stringify(message)
                })
            )
    );

    logger.info("Requeued job to SQS", {
        domain: metadata.domain
    });
}
