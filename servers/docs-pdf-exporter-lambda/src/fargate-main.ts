import type { PdfExportSqsMessage } from "@fern-api/docs-pdf";
import { PdfExportTaskHandler } from "./lambda/pdf-export-task-handler";
import { createConsoleJsonLogger } from "./util/logger";

const logger = createConsoleJsonLogger({ component: "docs-pdf-exporter-fargate" });

/**
 * Fargate container entry point.
 *
 * EventBridge Pipes passes the SQS message body as the `PDF_EXPORT_MESSAGE`
 * environment variable via ECS container override.  This script parses it,
 * runs the export, and exits.
 */
async function main(): Promise<void> {
    const raw = process.env.PDF_EXPORT_MESSAGE;
    if (!raw) {
        logger.error({ event: "fargate.missing_message" }, "PDF_EXPORT_MESSAGE env var is not set");
        process.exit(1);
    }

    let message: PdfExportSqsMessage;
    try {
        message = JSON.parse(raw) as PdfExportSqsMessage;
    } catch {
        logger.error({ event: "fargate.invalid_message", raw }, "Failed to parse PDF_EXPORT_MESSAGE");
        process.exit(1);
    }

    logger.info({ event: "fargate.start", taskId: message.taskId, docsUrl: message.docsUrl }, "Starting PDF export");

    const handler = new PdfExportTaskHandler({ message, logger });
    await handler.handle();

    logger.info({ event: "fargate.done", taskId: message.taskId }, "PDF export finished");
}

void main()
    .then(() => process.exit(0))
    .catch((error) => {
        logger.error({ event: "fargate.fatal", error: String(error) }, "Unhandled error");
        process.exit(1);
    });
