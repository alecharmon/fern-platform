import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import type { PdfExportSqsMessage } from "@fern-api/docs-pdf";
import type { SqsConfig } from "../../app/FdrConfig";

export class PdfExportSqsClient {
    private client: SQSClient;
    private queueUrl: string;

    constructor(config: SqsConfig) {
        this.queueUrl = config.queueUrl;
        this.client = new SQSClient({
            region: config.region
        });
    }

    public async sendMessage(message: PdfExportSqsMessage): Promise<void> {
        const command = new SendMessageCommand({
            QueueUrl: this.queueUrl,
            MessageBody: JSON.stringify(message),
            // Use taskId as deduplication ID to prevent duplicate processing
            MessageDeduplicationId: message.taskId,
            // Group by docsUrl to process exports for the same site sequentially
            MessageGroupId: message.docsUrl.replace(/[^a-zA-Z0-9-]/g, "-")
        });

        await this.client.send(command);
    }
}
