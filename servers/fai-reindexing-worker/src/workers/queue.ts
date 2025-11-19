import { DeleteMessageCommand, ReceiveMessageCommand } from "@aws-sdk/client-sqs";
import { sqsClient } from "../config/clients";
import { env } from "../config/env";
import { logger } from "../config/logger";
import type { ReindexJobMessage } from "../types";
import { processReindexJob } from "./reindex";

const MAX_CONCURRENT_JOBS = 4;

export async function pollSQSQueue(): Promise<void> {
    logger.info("Starting SQS polling", {
        queueUrl: env.sqsQueueUrl,
        maxConcurrentJobs: MAX_CONCURRENT_JOBS
    });

    const activeJobs = new Set<Promise<void>>();

    while (true) {
        try {
            if (activeJobs.size >= MAX_CONCURRENT_JOBS) {
                await Promise.race(activeJobs);
                continue;
            }

            const response = await sqsClient.send(
                new ReceiveMessageCommand({
                    QueueUrl: env.sqsQueueUrl,
                    MaxNumberOfMessages: MAX_CONCURRENT_JOBS - activeJobs.size,
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
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }
        } catch (error) {
            logger.error("Error polling SQS", { error });
            await new Promise((resolve) => setTimeout(resolve, 5000));
        }
    }
}

async function handleMessage(message: any): Promise<void> {
    const messageId = message.MessageId;

    try {
        logger.info("Received message", { messageId });

        const body = JSON.parse(message.Body || "{}");
        const jobMessage: ReindexJobMessage = body;

        if (!jobMessage.domain) {
            logger.error("Invalid message: missing domain", { messageId, body: message.Body });
            await deleteMessage(message.ReceiptHandle);
            return;
        }

        await processReindexJob(jobMessage, messageId);

        await deleteMessage(message.ReceiptHandle);

        logger.info("Successfully processed and deleted message", { messageId, domain: jobMessage.domain });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        logger.error("Error processing message", {
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
