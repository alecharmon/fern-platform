import { DeleteMessageCommand, ReceiveMessageCommand } from "@aws-sdk/client-sqs";
import * as Sentry from "@sentry/node";
import { sqsClient } from "../config/clients";
import { POLLING_CONFIG } from "../config/constants";
import { orchestratorEnv as env } from "../config/env.orchestrator";
import { createDomainLogger, logger } from "../config/logger";
import { delegateToWorkerTask } from "../services/ecs-delegator";
import { getJobById, getRunningJobForDomain, markStaleJobsFailed, updateJobStatusById } from "../services/job-tracker";
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
            basepath: body.basepath ?? "",
            forceFullReindex: body.forceFullReindex ?? false,
            jobId: body.jobId || undefined
        };

        if (!jobMessage.domain) {
            logger.error("Invalid message: missing domain", { messageId, body: message.Body });
            await deleteMessage(message.ReceiptHandle);
            return;
        }

        const domainLog = createDomainLogger(jobMessage.domain);
        domainLog.info("Parsed SQS message", {
            messageId,
            jobId: jobMessage.jobId,
            domain: jobMessage.domain,
            basepath: jobMessage.basepath,
            route: jobMessage.basepath ? "basepath-aware" : "default (no basepath)"
        });

        // Mark any stale running jobs as failed before checking for conflicts
        await markStaleJobsFailed(jobMessage.domain, domainLog, jobMessage.basepath);

        // Check if there's still a running job for this domain+basepath after stale cleanup
        const runningJob = await getRunningJobForDomain(jobMessage.domain, domainLog, jobMessage.basepath);

        if (runningJob && runningJob.id !== jobMessage.jobId && runningJob.status !== JobStatus.OOM_RETRY) {
            // A fresh (non-stale) job is still running — defer this new job
            const deferContext = {
                messageId,
                jobId: jobMessage.jobId,
                domain: jobMessage.domain,
                basepath: jobMessage.basepath,
                runningJobId: runningJob.id,
                currentStatus: runningJob.status
            };
            Sentry.captureMessage("Reindex job deferred: another job already running", {
                level: "warning",
                tags: { component: "orchestrator", operation: "job_conflict" },
                extra: deferContext
            });
            domainLog.warn("Job already running for domain, deferring new job", deferContext);

            // Mark the new job as failed since we can't process it now
            if (jobMessage.jobId) {
                await updateJobStatusById(
                    jobMessage.jobId,
                    JobStatus.FAILED,
                    { error: `Deferred: another job (${runningJob.id}) is already running for this domain` },
                    domainLog
                );
            }

            // Always delete the message — no more ChangeMessageVisibility loops
            await deleteMessage(message.ReceiptHandle);
            return;
        }

        // Look up the job record if we have a jobId from the message
        let jobId = jobMessage.jobId;
        if (jobId) {
            const jobRecord = await getJobById(jobId, domainLog);
            if (!jobRecord) {
                domainLog.warn("Job ID from message not found in DB, proceeding without job tracking", {
                    messageId,
                    jobId
                });
                jobId = undefined;
            }
        }

        // Default 4GB memory, rely on OOM retries (4GB → 8GB → 16GB) for larger sites
        const memoryMB = 4096;
        const cpu = Math.min(2048, Math.max(256, Math.floor(memoryMB / 2)));

        const { taskArn } = await delegateToWorkerTask(
            {
                memory: memoryMB,
                cpu,
                jobMessage,
                sqsMessageId: messageId
            },
            domainLog
        );

        if (jobId) {
            await updateJobStatusById(
                jobId,
                JobStatus.RECEIVED,
                { memoryMb: memoryMB, sqsMessageId: messageId, taskArn },
                domainLog
            );
        }

        // Always delete the message after successful delegation
        await deleteMessage(message.ReceiptHandle);

        domainLog.info("Successfully delegated job to worker task", {
            messageId,
            jobId,
            taskArn,
            memoryMB,
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

        // Mark the job as failed immediately so it doesn't block future jobs for this domain
        try {
            const body = JSON.parse(message.Body || "{}");
            const jobId = body.jobId as string | undefined;
            if (jobId) {
                await updateJobStatusById(
                    jobId,
                    JobStatus.FAILED,
                    { error: `Orchestrator error: ${errorMessage}` },
                    logger
                );
            }
        } catch (updateError) {
            logger.error("Failed to mark job as failed after orchestrator error", {
                messageId,
                error: updateError instanceof Error ? updateError.message : String(updateError)
            });
        }

        // Always delete the message even on error — prevents infinite retry loops.
        try {
            await deleteMessage(message.ReceiptHandle);
        } catch (deleteError) {
            logger.error("Failed to delete message after error", {
                messageId,
                error: deleteError instanceof Error ? deleteError.message : String(deleteError)
            });
        }
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
