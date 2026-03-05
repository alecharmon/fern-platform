import type { PdfExportSqsMessage } from "@fern-api/docs-pdf";
import axios from "axios";
import { env } from "./env";
import { DocsPdfExporter } from "./exporter";
import { getServiceJwt } from "./jwt";
import { extractErrorMessage } from "./util/extract-error-message";
import type { Logger } from "./util/logger";
import { withRetry } from "./util/retry";

/**
 * Default hard deadline for a single PDF export run.
 * On Lambda this was derived from `context.getRemainingTimeInMillis()`;
 * on Fargate (no built-in deadline) we use a generous fixed value.
 */
const DEFAULT_DEADLINE_MS = 60 * 60 * 1000; // 60 minutes

/**
 * Safety margin subtracted from the deadline so we still have time to
 * mark the task as FAILED before the process is killed.
 */
const DEADLINE_SAFETY_MARGIN_MS = 30_000;

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

export interface PdfExportTaskHandlerOptions {
    message: PdfExportSqsMessage;
    /**
     * Time remaining (ms) before the compute environment kills the process.
     * On Fargate, omit to use the default (60 minutes).
     */
    deadlineMs?: number;
    logger: Logger;
}

export class PdfExportTaskHandler {
    private readonly opts: PdfExportTaskHandlerOptions;
    private finished: boolean;

    constructor(opts: PdfExportTaskHandlerOptions) {
        this.opts = opts;
        this.finished = false;
    }

    /**
     * Handle a single PDF export message.
     */
    public async handle(): Promise<void> {
        const {
            message: { taskId, docsUrl, versionId, productId, options },
            logger
        } = this.opts;

        logger.info(
            { event: "pdf_export.process.start", taskId, docsUrl, productId, versionId, options },
            "Processing PDF export"
        );

        const startedAt = new Date();

        const effectiveDeadlineMs = Math.max(
            0,
            (this.opts.deadlineMs ?? DEFAULT_DEADLINE_MS) - DEADLINE_SAFETY_MARGIN_MS
        );
        const deadlineTimer = setTimeout(() => {
            if (this.finished) {
                return;
            }
            this.finished = true;
            logger.error(
                { event: "pdf_export.deadline.exceeded", taskId },
                "Deadline approaching; marking task as FAILED"
            );
            void this.tryMarkTaskFailed("PDF generation timed out. Please try again.");
        }, effectiveDeadlineMs);

        const exporter = this.createExporter();

        try {
            await this.markTaskRunning(startedAt);

            await exporter.start();
            const result = await exporter.generateDocsPdf(
                {
                    docsUrl: this.normalizeUrl(docsUrl),
                    versionId,
                    productId
                },
                options
            );

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

            await this.uploadPdfToPresignedUrl(result.pdfBytes);

            const completedAt = new Date();
            const { s3Key, fileName } = await this.markTaskCompleted(completedAt, result.pdfBytes.length);
            this.finished = true;

            logger.info(
                { event: "pdf_export.process.completed", taskId, bytes: result.pdfBytes.length, s3Key, fileName },
                "PDF export completed"
            );
        } catch (error) {
            logger.error(
                { event: "pdf_export.process.failed", taskId, error: extractErrorMessage(error) },
                "PDF export failed"
            );
            if (!this.finished) {
                this.finished = true;
                await this.tryMarkTaskFailed(
                    "PDF generation failed. Please try again or contact support if the issue persists."
                );
            }
        } finally {
            clearTimeout(deadlineTimer);
            await exporter.stop().catch((e) => {
                logger.warn(
                    { event: "pdf_export.browser.stop_failed", error: extractErrorMessage(e) },
                    "Failed to stop browser (may already be closed)"
                );
            });
        }
    }

    private async markTaskRunning(startedAt: Date): Promise<void> {
        await this.updateTaskStatus({
            status: "RUNNING",
            startedAt: startedAt.toISOString()
        });
    }

    private async markTaskCompleted(completedAt: Date, sizeBytes: number) {
        const { uploadUrl, docsUrl } = this.opts.message;
        const s3Key = this.extractS3KeyFromUrl(uploadUrl);
        const fileName = `${docsUrl.replace(/\./g, "-")}.pdf`;
        await this.updateTaskStatus({
            status: "COMPLETED",
            completedAt: completedAt.toISOString(),
            s3Key,
            fileName,
            sizeBytes
        });
        return { s3Key, fileName };
    }

    /**
     * Best-effort attempt to mark a task as FAILED.
     */
    private async tryMarkTaskFailed(errorMessage: string): Promise<void> {
        const { taskId } = this.opts.message;
        try {
            await this.updateTaskStatus({
                status: "FAILED",
                completedAt: new Date().toISOString(),
                errorMessage
            });
        } catch (e) {
            this.opts.logger.error(
                { event: "pdf_export.mark_failed.error", taskId, error: extractErrorMessage(e) },
                "Failed to mark task as FAILED in FDR"
            );
        }
    }

    /**
     * Update task status in FDR via HTTP callback.
     */
    private async updateTaskStatus(payload: StatusUpdatePayload): Promise<void> {
        const { callbackUrl, taskId } = this.opts.message;
        const url = `${callbackUrl}/pdf-export/task/${taskId}`;

        try {
            const jwt = await getServiceJwt();
            await withRetry(
                () =>
                    axios.post(url, payload, {
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${jwt}`
                        },
                        timeout: 15_000
                    }),
                {
                    maxRetries: 3,
                    baseDelayMs: 500,
                    maxDelayMs: 3_000,
                    shouldRetry: (e) => {
                        if (!axios.isAxiosError(e)) {
                            return true;
                        }
                        const status = e.response?.status;
                        return status == null || status >= 500;
                    }
                }
            );
            this.opts.logger.info(
                { event: "pdf_export.status_update.ok", taskId, status: payload.status },
                "Updated task status"
            );
        } catch (error) {
            this.opts.logger.error(
                {
                    event: "pdf_export.status_update.failed",
                    taskId,
                    status: payload.status,
                    error: extractErrorMessage(error)
                },
                "Failed to update task status"
            );
            throw error;
        }
    }

    /**
     * Upload PDF bytes to S3 using presigned URL.
     */
    private async uploadPdfToPresignedUrl(pdfBytes: Uint8Array): Promise<void> {
        const { uploadUrl } = this.opts.message;
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
    private extractS3KeyFromUrl(presignedUrl: string): string {
        const url = new URL(presignedUrl);
        // Remove leading slash from pathname
        return url.pathname.slice(1);
    }

    private normalizeUrl(url: string): string {
        return url.startsWith("http://") || url.startsWith("https://") ? url : `https://${url}`;
    }

    private createExporter(): DocsPdfExporter {
        return new DocsPdfExporter({
            logLevel: "debug",
            logFormat: "json",
            maxRenderConcurrency: 25,
            renderTimeoutSeconds: 60,
            maxRenderRetries: 2,
            continueOnPageError: true,
            compression: {
                quality: "ebook",
                timeoutSeconds: 30
            },
            authToken: env.PDF_EXPORT_FERN_TOKEN
        });
    }
}
