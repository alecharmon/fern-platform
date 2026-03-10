import { ChangeMessageVisibilityCommand, DeleteMessageCommand, ReceiveMessageCommand } from "@aws-sdk/client-sqs";
import * as Sentry from "@sentry/node";
import { sqsClient } from "../config/clients";
import { POLLING_CONFIG } from "../config/constants";
import { orchestratorEnv as env } from "../config/env.orchestrator";
import { createDomainLogger, logger } from "../config/logger";
import { delegateToWorkerTask } from "../services/ecs-delegator";
import { getJobRecord, isJobRunning, upsertJobRecord } from "../services/job-tracker";
import { calculateMemoryRequirements, getCpuForMemory } from "../services/memory-calculator";
import { flattenDomain } from "../services/turbopuffer/turbopuffer";
import { JobStatus, type ReindexJobMessage } from "../types";

let isShuttingDown = false;

export async function pollSQSQueue(): Promise<void> {
    logger.info("Starting SQS polling (orchestrator mode)", {
        queueUrl: env.sqsQueueUrl,
        maxConcurrentJobs: POLLING_CONFIG.MAX_CONCURRENT_JOBS
    });

    const shutdownHandler = () => {
        if (!isShuttingDown) {
            logger.info("Received shutdown signal (SIGTERM/SIGINT), stopping new message polling...");
            isShuttingDown = true;
        }
    };

    process.on("SIGTERM", shutdownHandler);
    process.on("SIGINT", shutdownHandler);

    const activeJobs = new Set<Promise<void>>();

    while (!isShuttingDown) {
        try {
            if (activeJobs.size >= POLLING_CONFIG.MAX_CONCURRENT_JOBS) {
                await Promise.race(activeJobs);
                continue;
            }

            const response = await sqsClient.send(
                new ReceiveMessageCommand({
                    QueueUrl: env.sqsQueueUrl,
                    MaxNumberOfMessages: POLLING_CONFIG.MAX_CONCURRENT_JOBS - activeJobs.size,
                    WaitTimeSeconds: 20,
                    VisibilityTimeout: 1200
                })
            );

            if (response.Messages && response.Messages.length > 0) {
                for (const message of response.Messages) {
                    const job = handleMessage(message).finally(() => {
                        activeJobs.delete(job);
                    });
                    activeJobs.add(job);
                }
            } else {
                await new Promise((resolve) => setTimeout(resolve, POLLING_CONFIG.NO_MESSAGES_DELAY_MS));
            }
        } catch (error) {
            Sentry.captureException(error, { tags: { component: "orchestrator", operation: "sqs_poll" } });
            logger.error("Error polling SQS", { error });
            await new Promise((resolve) => setTimeout(resolve, POLLING_CONFIG.ERROR_DELAY_MS));
        }
    }

    if (activeJobs.size > 0) {
        logger.info("Waiting for active jobs to complete before shutdown...", {
            activeJobCount: activeJobs.size
        });
        await Promise.allSettled(activeJobs);
        logger.info("All active jobs completed, shutting down gracefully");
    } else {
        logger.info("No active jobs, shutting down immediately");
    }
}

async function handleMessage(message: any): Promise<void> {
    const messageId = message.MessageId;

    try {
        logger.info("Received message (orchestrator)", { messageId });

        const body = JSON.parse(message.Body || "{}");
        const jobMessage: ReindexJobMessage = {
            domain: body.domain,
            basepath: body.basepath || undefined,
            forceFullReindex: body.forceFullReindex ?? false
        };

        if (!jobMessage.domain) {
            logger.error("Invalid message: missing domain", { messageId, body: message.Body });
            await deleteMessage(message.ReceiptHandle);
            return;
        }

        const domainLog = createDomainLogger(jobMessage.domain);
        domainLog.info("Parsed SQS message", {
            messageId,
            domain: jobMessage.domain,
            basepath: jobMessage.basepath,
            route: jobMessage.basepath ? "basepath-aware" : "default (no basepath)"
        });
        const flatDomain = flattenDomain(jobMessage.domain);

        const jobRecord = await getJobRecord(flatDomain, domainLog);
        const jobRunning = jobRecord && (await isJobRunning(flatDomain, domainLog));

        if (jobRunning && jobRecord?.status !== JobStatus.OOM_RETRY) {
            domainLog.warn("Job already running for domain, message will retry after 60s", {
                messageId,
                domain: jobMessage.domain,
                currentStatus: jobRecord?.status
            });
            await sqsClient.send(
                new ChangeMessageVisibilityCommand({
                    QueueUrl: env.sqsQueueUrl,
                    ReceiptHandle: message.ReceiptHandle,
                    VisibilityTimeout: 60
                })
            );
            return;
        }

        const memoryReqs = await calculateMemoryRequirements(jobMessage.domain, domainLog, jobMessage.basepath);
        const cpu = getCpuForMemory(memoryReqs.memoryMB);

        domainLog.info("Calculated resource requirements", {
            memoryMB: memoryReqs.memoryMB,
            cpuUnits: cpu,
            numPages: memoryReqs.numPages,
            numEndpoints: memoryReqs.numEndpoints,
            messageId
        });

        await upsertJobRecord(
            {
                domain: flatDomain,
                status: JobStatus.RECEIVED,
                memoryMB: memoryReqs.memoryMB,
                sqsMessageId: messageId,
                startedAt: new Date().toISOString()
            },
            domainLog
        );

        const { taskArn } = await delegateToWorkerTask(
            {
                memory: memoryReqs.memoryMB,
                cpu,
                jobMessage,
                sqsMessageId: messageId
            },
            domainLog
        );

        await upsertJobRecord(
            {
                domain: flatDomain,
                taskArn
            },
            domainLog
        );

        await deleteMessage(message.ReceiptHandle);

        domainLog.info("Successfully delegated job to worker task", {
            messageId,
            taskArn,
            memoryMB: memoryReqs.memoryMB,
            cpuUnits: cpu
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;

        Sentry.captureException(error instanceof Error ? error : new Error(errorMessage), {
            tags: { component: "orchestrator", operation: "handle_message" },
            extra: { messageId }
        });
        logger.error("Error orchestrating job", {
            messageId,
            error: errorMessage,
            stack: errorStack
        });
    }
}

async function deleteMessage(receiptHandle: string): Promise<void> {
    await sqsClient.send(
        new DeleteMessageCommand({
            QueueUrl: env.sqsQueueUrl,
            ReceiptHandle: receiptHandle
        })
    );
}
