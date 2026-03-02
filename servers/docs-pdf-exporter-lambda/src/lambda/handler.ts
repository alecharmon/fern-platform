import type { PdfExportSqsMessage } from "@fern-api/docs-pdf";
import type { Context, SQSEvent } from "aws-lambda";
import { createConsoleJsonLogger } from "../util/logger";
import { PdfExportTaskHandler } from "./pdf-export-task-handler";

const logger = createConsoleJsonLogger({ component: "docs-pdf-exporter-lambda" });

/**
 * Lambda handler for SQS-triggered PDF export.
 *
 * This function is triggered by SQS when a PDF export task is queued.
 * It:
 * 1. Calls FDR to mark the task as RUNNING
 * 2. Launches a fresh browser and generates the PDF
 * 3. Uploads the PDF to S3 via presigned URL
 * 4. Calls FDR to mark the task as COMPLETED (or FAILED)
 * 5. Tears down the browser
 */
export async function handler(event: SQSEvent, context: Context): Promise<void> {
    logger.info(
        { event: "pdf_export.sqs.received", records: event.Records.length, requestId: context.awsRequestId },
        "Received SQS messages"
    );

    for (const record of event.Records) {
        const message: PdfExportSqsMessage = JSON.parse(record.body);
        const taskHandler = new PdfExportTaskHandler({
            message,
            deadlineMs: context.getRemainingTimeInMillis(),
            logger
        });
        await taskHandler.handle();
    }
}
