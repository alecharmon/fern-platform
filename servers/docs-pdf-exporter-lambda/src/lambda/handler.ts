import type { PdfExportSqsMessage } from "@fern-api/docs-pdf";
import type { Context, SQSEvent, SQSRecord } from "aws-lambda";
import axios from "axios";
import { DocsPdfExporter } from "../exporter/docs-pdf-exporter";
import { extractErrorMessage } from "../util/extract-error-message";
import { createConsoleJsonLogger } from "../util/logger";
import { env } from "./env";
import { getServiceJwt } from "./jwt";

/**
 * Payload for updating task status in FDR.
 */
interface StatusUpdatePayload {
    status: "RUNNING" | "COMPLETED" | "FAILED";
    startedAt?: string;
    completedAt?: string;
    s3Key?: string;
    fileName?: string;
    sizeBytes?: number;
    errorMessage?: string;
}

const logger = createConsoleJsonLogger({ component: "docs-pdf-exporter-lambda" });

/**
 * Keep a single browser instance warm across Lambda invocations.
 *
 * AWS Lambda may reuse the same execution environment for multiple invocations.
 * Keeping Chromium open avoids the very expensive cold-start cost of launching a browser
 * for every message.
 *
 * Important: `handler` sets `context.callbackWaitsForEmptyEventLoop = false` so the
 * Lambda invocation can finish even though the browser keeps the event loop alive.
 */
let exporter: DocsPdfExporter | undefined;
let exporterStartPromise: Promise<DocsPdfExporter> | undefined;

async function getStartedExporter(): Promise<DocsPdfExporter> {
    if (exporterStartPromise != null) {
        return await exporterStartPromise;
    }

    exporterStartPromise = (async () => {
        const instance =
            exporter ??
            new DocsPdfExporter({
                logLevel: "debug",
                logFormat: "json",
                maxRenderConcurrency: env.DOCS_PDF_MAX_RENDER_CONCURRENCY,
                renderTimeoutSeconds: env.DOCS_PDF_RENDER_TIMEOUT_SECONDS,
                maxRenderRetries: env.DOCS_PDF_MAX_RENDER_RETRIES,
                continueOnPageError: true,
                compression: {
                    quality: "ebook",
                    timeoutSeconds: env.DOCS_PDF_COMPRESSION_TIMEOUT_SECONDS,
                    maxConcurrency: env.DOCS_PDF_MAX_COMPRESSION_CONCURRENCY
                },
                authToken: env.PDF_EXPORT_FERN_TOKEN
            });

        exporter = instance;
        await instance.start();
        return instance;
    })().catch((e) => {
        // Reset so the next invocation/message can retry starting a fresh browser.
        exporterStartPromise = undefined;
        exporter = undefined;
        logger.error(
            { event: "pdf_export.browser.start_failed", error: extractErrorMessage(e) },
            "Browser start failed"
        );
        throw e;
    });

    return await exporterStartPromise;
}

/**
 * Update task status in FDR via HTTP callback.
 */
async function updateTaskStatus(callbackUrl: string, taskId: string, payload: StatusUpdatePayload): Promise<void> {
    const url = `${callbackUrl}/pdf-export/task/${taskId}`;

    try {
        const jwt = await getServiceJwt();
        await axios.post(url, payload, {
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${jwt}`
            },
            timeout: 30_000
        });
        logger.info({ event: "pdf_export.status_update.ok", taskId, status: payload.status }, "Updated task status");
    } catch (error) {
        logger.error(
            {
                event: "pdf_export.status_update.failed",
                taskId,
                status: payload.status,
                error: extractErrorMessage(error)
            },
            "Failed to update task status"
        );
        // Re-throw to fail the Lambda and trigger SQS retry
        throw error;
    }
}

/**
 * Upload PDF bytes to S3 using presigned URL.
 */
async function uploadPdfToPresignedUrl(uploadUrl: string, pdfBytes: Uint8Array): Promise<void> {
    await axios.put(uploadUrl, pdfBytes, {
        headers: {
            "Content-Type": "application/pdf"
        },
        timeout: 300_000,
        maxBodyLength: Infinity,
        maxContentLength: Infinity
    });
}

/**
 * Extract S3 key from presigned URL.
 * The URL format is: https://bucket.s3.region.amazonaws.com/key?signature...
 */
function extractS3KeyFromUrl(presignedUrl: string): string {
    const url = new URL(presignedUrl);
    // Remove leading slash from pathname
    return url.pathname.slice(1);
}

/**
 * Process a single PDF export message.
 */
async function processMessage(message: PdfExportSqsMessage): Promise<void> {
    const { taskId, docsUrl, options, uploadUrl, callbackUrl } = message;

    logger.info({ event: "pdf_export.process.start", taskId, docsUrl }, "Processing PDF export");

    const startedAt = new Date().toISOString();

    await updateTaskStatus(callbackUrl, taskId, {
        status: "RUNNING",
        startedAt
    });

    try {
        const exporter = await getStartedExporter();

        const baseUrl =
            docsUrl.startsWith("http://") || docsUrl.startsWith("https://") ? docsUrl : `https://${docsUrl}`;
        const result = await exporter.generateDocsPdf(baseUrl, options);

        if (result.pageErrors.length > 0) {
            logger.warn(
                {
                    event: "pdf_export.generate.page_errors",
                    taskId,
                    pageErrorsCount: result.pageErrors.length,
                    pageErrors: result.pageErrors
                },
                "PDF generated with page errors"
            );
        }

        await uploadPdfToPresignedUrl(uploadUrl, result.pdfBytes);

        const s3Key = extractS3KeyFromUrl(uploadUrl);
        const fileName = `${docsUrl.replace(/\./g, "-")}.pdf`;
        const completedAt = new Date().toISOString();

        await updateTaskStatus(callbackUrl, taskId, {
            status: "COMPLETED",
            completedAt,
            s3Key,
            fileName,
            sizeBytes: result.pdfBytes.length
        });

        logger.info(
            { event: "pdf_export.process.completed", taskId, bytes: result.pdfBytes.length, s3Key, fileName },
            "PDF export completed"
        );
    } catch (error) {
        const userFacingErrorMessage =
            "PDF generation failed. Please try again or contact support if the issue persists.";
        try {
            await updateTaskStatus(callbackUrl, taskId, {
                status: "FAILED",
                completedAt: new Date().toISOString(),
                errorMessage: userFacingErrorMessage
            });
            logger.info(
                {
                    event: "pdf_export.process.failed_and_reported",
                    taskId,
                    error: extractErrorMessage(error)
                },
                "Failure reported to FDR; message will be deleted from SQS"
            );
        } catch (statusError) {
            logger.error(
                {
                    event: "pdf_export.process.failed_status_update_failed",
                    taskId,
                    error: extractErrorMessage(statusError)
                },
                "Failed to report failure to FDR; re-throwing so SQS retries"
            );
            throw error;
        }
    }
}

/**
 * Process a single SQS record.
 */
async function processRecord(record: SQSRecord): Promise<void> {
    const message: PdfExportSqsMessage = JSON.parse(record.body);
    await processMessage(message);
}

/**
 * Lambda handler for SQS-triggered PDF export.
 *
 * This function is triggered by SQS when a PDF export task is queued.
 * It:
 * 1. Calls FDR to mark the task as RUNNING
 * 2. Generates the PDF using DocsPdfExporter
 * 3. Uploads the PDF to S3 via presigned URL
 * 4. Calls FDR to mark the task as COMPLETED (or FAILED)
 */
export async function handler(event: SQSEvent, context: Context): Promise<void> {
    // Keep the browser alive across invocations; Lambda will freeze the environment after completion.
    context.callbackWaitsForEmptyEventLoop = false;

    logger.info(
        { event: "pdf_export.sqs.received", records: event.Records.length, requestId: context.awsRequestId },
        "Received SQS messages"
    );

    for (const record of event.Records) {
        await processRecord(record);
    }
}
