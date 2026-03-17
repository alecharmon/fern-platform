import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import {
    HEADER_FOOTER_FONT_SIZE_PT,
    HEADER_FOOTER_INSET_PT,
    HEADER_FOOTER_TEXT_COLOR_RGB,
    PRINT_CONTENT_PAGE_SELECTOR,
    PRINT_COVER_PAGE_SELECTOR,
    PRINT_COVER_PATH,
    PRINT_PAGE_PATH_PREFIX,
    PRINT_PAGES_PATH,
    PRINT_TOC_PAGE_HYDRATED_SELECTOR,
    PRINT_TOC_PATH,
    type PrintPagesResponse,
    TEMPLATE_PAGE_INDEX_PLACEHOLDER,
    TEMPLATE_TOTAL_PAGES_PLACEHOLDER,
    TOC_LINK_SENTINEL_URL_PREFIX
} from "@fern-api/docs-pdf";
import axios from "axios";
import pLimit from "p-limit";
import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFString, rgb, StandardFonts } from "pdf-lib";
import { type Browser, type BrowserContext, type BrowserContextOptions, chromium, type Page } from "playwright";
import { assertNever } from "../util/assert";
import { extractErrorMessage } from "../util/extract-error-message";
import { createConsoleJsonLogger, createPrettyConsoleLogger, type Logger, withLogLevel } from "../util/logger";
import { mergePdfDocuments } from "../util/merge-pdf-documents";
import { withRetry } from "../util/retry";
import { withTimeout } from "../util/timeout";
import {
    A4_VIEWPORT_PX,
    FILE_METADATA_CREATOR,
    FILE_METADATA_PRODUCER,
    NETWORK_IDLE_BEST_EFFORT_TIMEOUT_MS,
    RENDER_STAGGER_DELAY_MS,
    RETRY_BASE_DELAY_MS,
    RETRY_MAX_DELAY_MS
} from "./constants";
import { createStubContentPagePdf } from "./stub-content-page";
import type {
    CoverPdfGenerateResult,
    DocsPdfExporterConfig,
    DocsPdfGenerateResult,
    GenerateDocsPdfOptions,
    GenerateDocsPdfParams,
    PageRenderError,
    PdfCompressionConfig
} from "./types";

const HEADER_FOOTER_TEXT_COLOR = rgb(
    HEADER_FOOTER_TEXT_COLOR_RGB.r / 255,
    HEADER_FOOTER_TEXT_COLOR_RGB.g / 255,
    HEADER_FOOTER_TEXT_COLOR_RGB.b / 255
);

const execFileAsync = promisify(execFile);

async function sleep(ms: number) {
    await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Options for content validation after page navigation.
 */
interface ContentValidationOptions {
    /**
     * When provided, the validator will wait for the specified CSS selector to appear in the
     * DOM before running point-in-time error checks.
     *
     * Note: if this wait times out, the method throws the Playwright timeout error immediately
     * (no additional error-UI inspection is performed in that failure path).
     */
    successCondition?: {
        /** CSS selector that must exist for the page to be considered successfully rendered. */
        selector: string;
        /** Maximum time in milliseconds to wait for the selector to appear. */
        timeoutMs: number;
    };

    /**
     * Whether to check for known client-side error patterns in the page content.
     * @default true
     */
    checkErrorPatterns?: boolean;
}

/**
 * Default configuration for the generator.
 */
const DEFAULT_DOCS_PDF_GENERATOR_CONFIG: DocsPdfExporterConfig = {
    maxRenderConcurrency: 10,
    renderTimeoutSeconds: 60,
    maxRenderRetries: 4,
    logLevel: "info",
    logFormat: "pretty",
    continueOnPageError: false,
    compression: undefined,
    stubContentPages: false
};

const DEFAULT_COMPRESSION_CONFIG: PdfCompressionConfig = {
    quality: "ebook",
    timeoutSeconds: 180
};

type DeepPartial<T> = T extends object
    ? {
          [P in keyof T]?: DeepPartial<T[P]>;
      }
    : T;

/**
 * In-memory representation of a rendered content page PDF plus its slug.
 */
type ContentPagePdfInfo = {
    /**
     * Slug used to build the page URL and to map TOC entries to page numbers.
     */
    slug: string;

    /**
     * PDF bytes parsed into a `pdf-lib` document.
     */
    pdf: PDFDocument;

    /**
     * Original order in the pages list (0-based).
     * Used only for logging/debugging.
     */
    orderIndex: number;
};

/**
 * Generates printable docs PDFs by:
 * - rendering cover/TOC/content pages via Playwright (Chromium)
 * - merging the TOC + content pages and optionally compressing that intermediate PDF via Ghostscript
 * - merging the cover page with the TOC + content PDF via `pdf-lib`
 * - rewriting TOC link annotations into internal destinations
 * - stamping headers/footers on content pages via `pdf-lib`
 *
 * Usage:
 * - call `start()` once
 * - call `generateDocsPdf()`/`generateCoverPdf()` as needed
 * - call `stop()` to close the browser
 */
export class DocsPdfExporter {
    private readonly config: DocsPdfExporterConfig;
    private readonly logger: Logger;
    protected browser: Browser | null = null;

    /**
     * Create a generator instance.
     * Call `start()` before using any generation methods.
     */
    public constructor(config: DeepPartial<DocsPdfExporterConfig> = {}) {
        this.config = {
            maxRenderConcurrency: config.maxRenderConcurrency ?? DEFAULT_DOCS_PDF_GENERATOR_CONFIG.maxRenderConcurrency,
            maxRenderRetries: config.maxRenderRetries ?? DEFAULT_DOCS_PDF_GENERATOR_CONFIG.maxRenderRetries,
            renderTimeoutSeconds: config.renderTimeoutSeconds ?? DEFAULT_DOCS_PDF_GENERATOR_CONFIG.renderTimeoutSeconds,
            continueOnPageError: config.continueOnPageError ?? DEFAULT_DOCS_PDF_GENERATOR_CONFIG.continueOnPageError,
            compression:
                config.compression != null
                    ? {
                          quality: config.compression.quality ?? DEFAULT_COMPRESSION_CONFIG.quality,
                          timeoutSeconds: config.compression.timeoutSeconds ?? DEFAULT_COMPRESSION_CONFIG.timeoutSeconds
                      }
                    : undefined,
            logLevel: config.logLevel ?? DEFAULT_DOCS_PDF_GENERATOR_CONFIG.logLevel,
            logFormat: config.logFormat ?? DEFAULT_DOCS_PDF_GENERATOR_CONFIG.logFormat,
            authToken: config.authToken,
            stubContentPages: config.stubContentPages ?? DEFAULT_DOCS_PDF_GENERATOR_CONFIG.stubContentPages
        };
        this.logger = withLogLevel(this.createLogger(), this.config.logLevel);
    }

    private createLogger() {
        switch (this.config.logFormat) {
            case "json":
                return createConsoleJsonLogger({ component: "DocsPdfExporter" });
            case "pretty":
                return createPrettyConsoleLogger({ component: "DocsPdfExporter" });
            default:
                assertNever(this.config.logFormat);
        }
    }

    /**
     * @param attempt - The 1-based attempt index (1 = first retry after initial failure)
     * @returns The delay in milliseconds
     */
    private computeRetryDelayMs(attempt: number): number {
        const exp = Math.min(RETRY_MAX_DELAY_MS, RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
        const jitter = Math.floor(Math.random() * 200);
        return exp + jitter;
    }

    private isRetryableError(error: unknown): boolean {
        // We intentionally treat timeouts and most Playwright navigation/print flakiness as retryable.
        // Non-retryable errors should be wrapped in `NonRetryableError`.
        if (error instanceof NonRetryableError) {
            return false;
        }
        return true;
    }

    /**
     * Validate that a page rendered successfully by:
     * 1. Waiting for the success selector to appear in the DOM (if configured)
     * 2. Checking for absence of known error UI elements (catches client-side hydration failures)
     * 3. Verifying the success selector is actually visible (if configured)
     *
     * @throws {Error} If validation fails (retryable)
     */
    private async validatePageContent(page: Page, options: ContentValidationOptions = {}): Promise<void> {
        const { successCondition, checkErrorPatterns = true } = options;

        if (successCondition) {
            await page.waitForSelector(successCondition.selector, {
                timeout: successCondition.timeoutMs
            });
        }

        if (checkErrorPatterns) {
            const errorDetails = await this.detectErrorUIElements(page);
            if (errorDetails) {
                throw new Error(
                    `Page content validation failed: ${errorDetails}. ` +
                        "This is likely a transient React/Next.js error that may succeed on retry."
                );
            }
        }

        if (successCondition) {
            const hasSuccessMarker = await page
                .locator(successCondition.selector)
                .first()
                .isVisible()
                .catch(() => false);
            if (!hasSuccessMarker) {
                throw new Error(
                    `Page content validation failed: success marker "${successCondition.selector}" is in the DOM but not visible. ` +
                        "The page may not have rendered correctly."
                );
            }
        }
    }

    /**
     * Detect error UI elements in the page DOM.
     *
     * This checks for actual error boundary UI elements, NOT text content.
     * This avoids false positives when documentation pages legitimately contain
     * phrases like "client-side exception" in their content.
     *
     * @returns A description of the error if found, or null if page appears normal.
     */
    private async detectErrorUIElements(page: Page): Promise<string | null> {
        // Check for Fern's error boundary fallback badge.
        // This is a SemanticBadge with intent="error" that shows "Something went wrong".
        const hasErrorBoundaryBadge = await page
            .locator('[data-slot="badge"][data-intent="error"]')
            .first()
            .isVisible()
            .catch(() => false);

        if (hasErrorBoundaryBadge) {
            return "detected error boundary fallback UI (error badge visible)";
        }

        // Check for Next.js global error indicator.
        // When Next.js catches an unhandled error, it renders an error page with specific structure.
        // The error message appears in a hydration error boundary with id="__next_error__" or
        // in the NextJS error overlay.
        const hasNextJsError = await page
            .locator("#__next_error__, [data-nextjs-dialog], nextjs-portal")
            .first()
            .isVisible()
            .catch(() => false);

        if (hasNextJsError) {
            return "detected Next.js error overlay or boundary";
        }

        return null;
    }

    /**
     * Compress a PDF via Ghostscript.
     *
     * This writes the PDF bytes to a temp file, invokes `gs` with the configured
     * quality preset, reads the compressed output, and cleans up.
     *
     * In the main docs export flow, this is used on the merged TOC + content PDF
     * before the cover page is added. It can also be used for per-page compression
     * by callers that opt into that behavior.
     *
     * On any failure (gs not installed, timeout, unexpected error) the method
     * logs a warning and returns the original bytes unchanged. If Ghostscript's
     * output is larger than the input (can happen for already-compact PDFs),
     * the original is kept.
     */
    private async compressPdfWithGhostscript(pdfBytes: Buffer, runLogger: Logger): Promise<Buffer> {
        const { compression } = this.config;
        if (!compression) {
            return pdfBytes;
        }
        return await this.runGhostscript(pdfBytes, runLogger, compression);
    }

    private async runGhostscript(
        pdfBytes: Buffer,
        runLogger: Logger,
        compression: PdfCompressionConfig
    ): Promise<Buffer> {
        const quality = compression.quality;
        const timeoutMs = compression.timeoutSeconds * 1000;

        const id = randomUUID();
        const workDir = path.join(tmpdir(), "fern-pdf-gs");
        const inputPath = path.join(workDir, `${id}.pdf`);
        const outputPath = path.join(workDir, `${id}-out.pdf`);

        try {
            await mkdir(workDir, { recursive: true });
            await writeFile(inputPath, pdfBytes);

            runLogger.info(
                {
                    event: "docs_pdf.gs_compress.start",
                    originalBytes: pdfBytes.length,
                    quality
                },
                "Starting Ghostscript compression"
            );

            await execFileAsync(
                "gs",
                [
                    "-sDEVICE=pdfwrite",
                    "-dCompatibilityLevel=1.7",
                    `-dPDFSETTINGS=/${quality}`,
                    "-dDetectDuplicateImages=true",
                    "-dCompressFonts=true",
                    "-dSubsetFonts=true",
                    "-dCompressPages=true",
                    "-dPassThroughJPEGImages=true",
                    "-sColorConversionStrategy=RGB",
                    "-dNOPAUSE",
                    "-dBATCH",
                    "-dQUIET",
                    `-sOutputFile=${outputPath}`,
                    inputPath
                ],
                { timeout: timeoutMs }
            );

            const compressedBytes = await readFile(outputPath);

            const originalSize = pdfBytes.length;
            const compressedSize = compressedBytes.length;
            const reductionPercent = originalSize > 0 ? ((1 - compressedSize / originalSize) * 100).toFixed(1) : "0.0";

            // Ghostscript can occasionally produce *larger* output for small or
            // already-compact PDFs.  Only use the compressed version if it's smaller.
            if (compressedSize < originalSize) {
                runLogger.debug(
                    {
                        event: "docs_pdf.gs_compress.ok",
                        originalBytes: originalSize,
                        compressedBytes: compressedSize,
                        reductionPercent
                    },
                    `Ghostscript: ${originalSize} → ${compressedSize} bytes (${reductionPercent}% reduction)`
                );
                return compressedBytes;
            }

            runLogger.debug(
                {
                    event: "docs_pdf.gs_compress.skip_larger",
                    originalBytes: originalSize,
                    compressedBytes: compressedSize
                },
                "Ghostscript output was not smaller; keeping original"
            );
            return pdfBytes;
        } catch (e) {
            runLogger.warn(
                {
                    event: "docs_pdf.gs_compress.failed",
                    error: extractErrorMessage(e)
                },
                "Ghostscript compression failed; using uncompressed PDF"
            );
            return pdfBytes;
        } finally {
            // Clean up temp files
            await rm(inputPath, { force: true }).catch(() => {});
            await rm(outputPath, { force: true }).catch(() => {});
        }
    }

    private async withRetries<T>(
        runLogger: Logger,
        opts: {
            operation: string;
            fields?: Record<string, unknown>;
        },
        fn: (attemptIndex: number) => Promise<T>
    ): Promise<T> {
        const maxRetries = this.config.maxRenderRetries;
        const maxAttempts = 1 + maxRetries;
        let lastError: unknown;

        for (let attemptIndex = 1; attemptIndex <= maxAttempts; attemptIndex++) {
            try {
                if (attemptIndex > 1) {
                    runLogger.info(
                        {
                            event: "docs_pdf.retry.attempt",
                            operation: opts.operation,
                            attemptIndex,
                            maxAttempts,
                            ...(opts.fields ?? {})
                        },
                        "Retrying operation"
                    );
                }
                return await fn(attemptIndex);
            } catch (e) {
                lastError = e;
                const retryable = this.isRetryableError(e);
                const errorMessage = extractErrorMessage(e);

                if (!retryable || attemptIndex >= maxAttempts) {
                    runLogger.error(
                        {
                            event: "docs_pdf.retry.exhausted",
                            operation: opts.operation,
                            attemptIndex,
                            maxAttempts,
                            retryable,
                            error: errorMessage,
                            ...(opts.fields ?? {})
                        },
                        "Operation failed"
                    );
                    throw e;
                }

                const retryDelayMs = this.computeRetryDelayMs(attemptIndex);
                runLogger.warn(
                    {
                        event: "docs_pdf.retry.wait",
                        operation: opts.operation,
                        attemptIndex,
                        maxAttempts,
                        retryDelayMs,
                        error: errorMessage,
                        ...(opts.fields ?? {})
                    },
                    "Transient failure; will retry"
                );
                await sleep(retryDelayMs);
            }
        }
        throw lastError instanceof Error ? lastError : new Error("Operation failed");
    }

    private async renderUrlToPdfWithRetries(
        runLogger: Logger,
        browserContext: BrowserContext,
        opts: {
            operation: string;
            url: string;
            fields?: Record<string, unknown>;
            initScript?: {
                fn: (...args: unknown[]) => void;
                args?: unknown[];
            };
            waitForSelector?: string;
            /**
             * Content validation options to detect client-side render errors.
             * When provided, validates the page content after navigation to catch
             * errors that don't cause HTTP failures but produce error UI.
             */
            contentValidation?: ContentValidationOptions;
            /**
             * Whether to post-process this rendered PDF through Ghostscript.
             * The main docs export flow currently compresses the merged TOC +
             * content PDF instead of compressing content pages one-by-one.
             */
            compress?: boolean;
        }
    ) {
        return await this.withRetries(
            runLogger,
            { operation: opts.operation, fields: { url: opts.url, ...(opts.fields ?? {}) } },
            async () => {
                const start = Date.now();
                const timeoutMs = this.config.renderTimeoutSeconds * 1000;
                const page = await withTimeout(browserContext.newPage(), timeoutMs, "browserContext.newPage");

                let teardownAuth = async () => {};
                let rawBytes: Buffer;

                try {
                    const pageSetupTimeoutMs = 15_000;
                    await withTimeout(
                        page.emulateMedia({ media: "print", colorScheme: "light" }),
                        pageSetupTimeoutMs,
                        "page.emulateMedia"
                    );
                    teardownAuth = await withTimeout(this.setupPageAuth(page), pageSetupTimeoutMs, "setupPageAuth");

                    if (opts.initScript) {
                        await withTimeout(
                            page.addInitScript(opts.initScript.fn, ...(opts.initScript.args ?? [])),
                            pageSetupTimeoutMs,
                            "page.addInitScript"
                        );
                    }
                    const response = await page.goto(opts.url, {
                        waitUntil: "load",
                        timeout: timeoutMs
                    });

                    if (response == null) {
                        throw new Error(`Navigation returned no response for ${opts.url}`);
                    }

                    const status = response.status();
                    if (status >= 400 && status < 500) {
                        // Likely permanent (bad slug, auth, etc). Don't retry.
                        throw new NonRetryableError(`Navigation failed with status ${status} for ${opts.url}`);
                    }
                    if (status >= 500) {
                        // Server-side error page; treat as transient by default and retry.
                        throw new Error(`Navigation failed with status ${status} for ${opts.url}`);
                    }

                    const waitForSelector = async () => {
                        if (opts.waitForSelector) {
                            await page.waitForSelector(opts.waitForSelector, { timeout: timeoutMs });
                        }
                    };

                    const validatePageContent = async () => {
                        if (opts.contentValidation) {
                            await this.validatePageContent(page, opts.contentValidation);
                        }
                    };

                    const waitForSyntaxHighlighting = async () => {
                        await page
                            .waitForSelector('pre.code-block-root[data-code-highlighted="false"]', {
                                state: "detached",
                                timeout: timeoutMs
                            })
                            .catch(() => {});
                    };

                    await Promise.all([waitForSelector(), validatePageContent(), waitForSyntaxHighlighting()]);

                    // Best-effort wait for all sub-resources (lazy images, fonts, dynamic
                    // highlights, etc.) to finish loading. If this times out, we proceed
                    // anyway — the critical content is already confirmed in the DOM above.
                    await page
                        .waitForLoadState("networkidle", { timeout: NETWORK_IDLE_BEST_EFFORT_TIMEOUT_MS })
                        .catch(() => {});

                    rawBytes = await withTimeout(
                        page.pdf({
                            printBackground: true,
                            preferCSSPageSize: true
                        }),
                        timeoutMs,
                        "page.pdf"
                    );
                } finally {
                    await withTimeout(teardownAuth(), 15_000, "teardownAuth").catch(() => {});
                    await page.close().catch(() => {});
                }

                const bytes = opts.compress ? await this.compressPdfWithGhostscript(rawBytes, runLogger) : rawBytes;
                const pdf = await withTimeout(PDFDocument.load(bytes), timeoutMs, "PDFDocument.load");
                return { pdf, bytesLength: bytes.length, durationMs: Date.now() - start };
            }
        );
    }

    /**
     * Launch a headless Chromium instance via Playwright.
     * Must be called before any generation method.
     *
     * @throws {Error} If the generator is already started.
     */
    public async start() {
        this.assertNotStarted();
        this.logger.info({ event: "docs_pdf.browser.start" }, "Starting browser");
        try {
            (this as DocsPdfExporter).browser = await chromium.launch({
                headless: true,
                chromiumSandbox: false,
                args: [
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-gpu",
                    "--no-zygote",
                    "--num-raster-threads=4",
                    "--disable-background-networking",
                    "--disable-backgrounding-occluded-windows"
                ]
            });
            this.logger.info({ event: "docs_pdf.browser.started" }, "Browser started");
        } catch (e) {
            this.logger.error(
                { event: "docs_pdf.browser.start_failed", error: extractErrorMessage(e) },
                "Failed to start browser"
            );
            throw new Error(
                "Failed to launch Chromium via Playwright. This usually means the Playwright browsers aren't installed yet.\n" +
                    `Original error: ${extractErrorMessage(e)}`
            );
        }
    }

    /**
     * Close the Playwright browser instance.
     * Call this when you're done generating PDFs.
     *
     * @throws {Error} If the generator is not started.
     */
    public async stop() {
        this.assertStarted();
        this.logger.info({ event: "docs_pdf.browser.stop" }, "Stopping browser");
        await this.browser.close();
        (this as DocsPdfExporter).browser = null;
        this.logger.info({ event: "docs_pdf.browser.stopped" }, "Browser stopped");
    }

    /**
     * Generate a full docs PDF (cover + TOC + all content pages).
     */
    public async generateDocsPdf(
        params: GenerateDocsPdfParams,
        options: GenerateDocsPdfOptions = {}
    ): Promise<DocsPdfGenerateResult> {
        this.assertStarted();
        const { docsUrl } = params;
        const runId = randomUUID();
        const runLogger = this.logger.child({ runId, docsUrl });
        const start = Date.now();
        const pageErrors: PageRenderError[] = [];
        const { authToken: _, ...configWithoutAuthToken } = this.config;

        runLogger.info(
            {
                event: "docs_pdf.generate.start",
                params,
                options,
                config: configWithoutAuthToken
            },
            "Generating docs PDF"
        );

        const browserContext = await this.browser.newContext(this.getBrowserContextOptions());

        if (params.previewHost) {
            await browserContext.addCookies([
                {
                    name: "_fern_docs_preview",
                    value: params.previewHost,
                    domain: new URL(docsUrl).hostname,
                    path: "/"
                }
            ]);
        }

        try {
            const [coverPdf, contentPdfs] = await Promise.all([
                this.renderCoverPdf(runLogger, browserContext, docsUrl, options),
                this.renderContentPdfs(runLogger, browserContext, params, pageErrors)
            ]);

            const contentPageNumbersBySlug = this.buildContentPageNumbersBySlug(contentPdfs);
            const tocPdf = await this.renderTocPdf(runLogger, browserContext, params, contentPageNumbersBySlug);

            runLogger.info({ event: "docs_pdf.merge.start" }, "Merging PDFs");
            const mergeStart = Date.now();
            const mergedTocAndContentPdf = await mergePdfDocuments(tocPdf, ...contentPdfs.map(({ pdf }) => pdf));
            const compressedTocAndContentPdfBytes = await this.compressPdfWithGhostscript(
                Buffer.from(await mergedTocAndContentPdf.save()),
                runLogger
            );
            const compressedTocAndContentPdf = await PDFDocument.load(compressedTocAndContentPdfBytes);
            const mergedPdf = await mergePdfDocuments(coverPdf, compressedTocAndContentPdf);
            runLogger.info(
                {
                    event: "docs_pdf.merge.end",
                    durationMs: Date.now() - mergeStart,
                    pages: mergedPdf.getPageCount()
                },
                "Merged PDFs"
            );

            await this.rewriteTocLinksToInternalDestinations(
                runLogger,
                mergedPdf,
                coverPdf.getPageCount(),
                tocPdf.getPageCount(),
                contentPageNumbersBySlug
            );

            const contentStartPageIndex = coverPdf.getPageCount() + tocPdf.getPageCount();
            await this.drawHeadersAndFooters(runLogger, mergedPdf, contentStartPageIndex, options);

            runLogger.info({ event: "docs_pdf.save.start", pages: mergedPdf.getPageCount() }, "Saving PDF");
            const saveStart = Date.now();
            this.setMetadata(mergedPdf);
            const pdfBytes = await mergedPdf.save();
            runLogger.info(
                { event: "docs_pdf.save.end", durationMs: Date.now() - saveStart, bytes: pdfBytes.length },
                "Saved PDF"
            );

            runLogger.info(
                {
                    event: "docs_pdf.generate.end",
                    durationMs: Date.now() - start,
                    bytes: pdfBytes.length,
                    pages: mergedPdf.getPageCount(),
                    pageErrors: pageErrors.length
                },
                "Docs PDF generated"
            );

            return { pdfBytes, pageErrors };
        } finally {
            await browserContext.close();
        }
    }

    /**
     * Generate only the cover page PDF.
     * Useful for iterating on cover design quickly.
     */
    public async generateCoverPdf(
        docsUrl: string,
        options: Pick<GenerateDocsPdfOptions, "coverTitle" | "coverSubtitle" | "hideCoverFooter"> = {}
    ): Promise<CoverPdfGenerateResult> {
        this.assertStarted();
        const runId = randomUUID();
        const runLogger = this.logger.child({ runId, docsUrl });
        const start = Date.now();

        runLogger.info({ event: "docs_pdf.generate_cover.start" }, "Generating cover PDF");

        const browserContext = await this.browser.newContext(this.getBrowserContextOptions());

        try {
            const coverPdf = await this.renderCoverPdf(runLogger, browserContext, docsUrl, options);
            const saveStart = Date.now();
            this.setMetadata(coverPdf);
            const pdfBytes = await coverPdf.save();
            runLogger.debug(
                { event: "docs_pdf.save.end", durationMs: Date.now() - saveStart, bytes: pdfBytes.length },
                "Saved PDF"
            );
            runLogger.info(
                {
                    event: "docs_pdf.generate_cover.end",
                    durationMs: Date.now() - start,
                    bytes: pdfBytes.length,
                    pages: coverPdf.getPageCount()
                },
                "Cover PDF generated"
            );
            return { pdfBytes };
        } finally {
            await browserContext.close();
        }
    }

    /**
     * Build browser context options (viewport only — no extra HTTP headers).
     *
     * Authentication is handled by {@link setupPageAuth} which uses CDP
     * `Fetch.enable` with a URL pattern to inject the `FERN_TOKEN` header
     * only on `/_print/` navigation requests, with zero overhead on
     * sub-resource requests.
     */
    private getBrowserContextOptions(): BrowserContextOptions {
        return { viewport: A4_VIEWPORT_PX };
    }

    /**
     * Install per-page CDP `Fetch` interception to inject the `FERN_TOKEN`
     * header on `/_print/` navigation requests.
     *
     * Returns a teardown function that **must** be called before `page.close()`.
     * It detaches the CDP session so Chrome stops routing `Fetch.requestPaused`
     * events and releases any currently-paused requests back to the normal network
     * path. Without this, `page.close()` races in-flight handlers and produces
     * unhandled promise rejections.
     */
    private async setupPageAuth(page: Page): Promise<() => Promise<void>> {
        if (!this.config.authToken) {
            return async () => {};
        }
        const authToken = this.config.authToken;
        const cdpSession = await page.context().newCDPSession(page);
        await cdpSession.send("Fetch.enable", {
            patterns: [{ urlPattern: "*/_print/*", requestStage: "Request" }]
        });
        cdpSession.on("Fetch.requestPaused", async (event) => {
            const request = event.request;
            const headers = Object.entries({
                ...request.headers,
                "x-fern-token": authToken,
                FERN_TOKEN: authToken
            }).map(([name, value]) => ({ name, value }));
            try {
                await cdpSession.send("Fetch.continueRequest", {
                    requestId: event.requestId,
                    headers
                });
            } catch {
                // The CDP session may have been detached (teardown) while this event was
                // already queued in Node's event loop. This is expected and harmless.
            }
        });
        return async () => {
            await cdpSession.detach().catch(() => {});
        };
    }

    /**
     * Render the cover page HTML to a single-page PDF.
     */
    private async renderCoverPdf(
        runLogger: Logger,
        browserContext: BrowserContext,
        docsUrl: string,
        options: Pick<GenerateDocsPdfOptions, "coverTitle" | "coverSubtitle" | "hideCoverFooter"> = {}
    ) {
        const url = new URL(`${docsUrl}/${PRINT_COVER_PATH}`);
        const coverTitleTrimmed = typeof options.coverTitle === "string" ? options.coverTitle.trim() : "";
        if (coverTitleTrimmed !== "") {
            url.searchParams.set("title", coverTitleTrimmed);
        }
        const coverSubtitleTrimmed = typeof options.coverSubtitle === "string" ? options.coverSubtitle.trim() : "";
        if (coverSubtitleTrimmed !== "") {
            url.searchParams.set("subtitle", coverSubtitleTrimmed);
        }
        if (options.hideCoverFooter === true) {
            url.searchParams.set("hideFooter", "1");
        }
        const { pdf, bytesLength, durationMs } = await this.renderUrlToPdfWithRetries(runLogger, browserContext, {
            operation: "render_cover",
            url: url.toString(),
            contentValidation: {
                successCondition: {
                    selector: PRINT_COVER_PAGE_SELECTOR,
                    timeoutMs: this.config.renderTimeoutSeconds * 1000
                },
                checkErrorPatterns: true
            }
        });
        runLogger.debug(
            { event: "docs_pdf.render.cover.end", durationMs, bytes: bytesLength, pages: pdf.getPageCount() },
            "Cover rendered"
        );
        return pdf;
    }

    /**
     * Render each content page to an individual `pdf-lib` document.
     *
     * Rendering is parallelized and bounded by `config.maxRenderConcurrency`.
     *
     * When `config.continueOnPageError` is enabled, failed pages are skipped
     * and their errors collected in `pageErrors`.
     */
    private async renderContentPdfs(
        runLogger: Logger,
        browserContext: BrowserContext,
        params: GenerateDocsPdfParams,
        pageErrors: PageRenderError[]
    ): Promise<ContentPagePdfInfo[]> {
        const start = Date.now();
        const { docsUrl } = params;
        const pages = await this.fetchContentPageList(runLogger, params);

        const pageLimiter = pLimit(this.config.maxRenderConcurrency);

        runLogger.info(
            {
                event: "docs_pdf.render.content_pages.start",
                pages: pages.length,
                maxRenderConcurrency: this.config.maxRenderConcurrency
            },
            "Rendering content pages"
        );

        const renderPromises: Promise<ContentPagePdfInfo | null>[] = [];
        for (const [orderIndex, pageInfo] of pages.entries()) {
            renderPromises.push(
                pageLimiter(async () => {
                    try {
                        if (this.config.stubContentPages) {
                            const pdf = await createStubContentPagePdf(pageInfo.title, pageInfo.slug);
                            runLogger.debug(
                                {
                                    event: "docs_pdf.render.content_page.stub",
                                    slug: pageInfo.slug,
                                    orderIndex,
                                    listIndex: orderIndex + 1,
                                    listTotal: pages.length
                                },
                                "Stub content page created"
                            );
                            return { pdf, slug: pageInfo.slug, orderIndex };
                        }

                        const pageUrl = `${docsUrl}/${PRINT_PAGE_PATH_PREFIX}/${pageInfo.slug}`;
                        const { pdf, bytesLength, durationMs } = await this.renderUrlToPdfWithRetries(
                            runLogger,
                            browserContext,
                            {
                                operation: "render_content_page",
                                url: pageUrl,
                                fields: {
                                    slug: pageInfo.slug,
                                    orderIndex,
                                    listIndex: orderIndex + 1,
                                    listTotal: pages.length
                                },
                                contentValidation: {
                                    successCondition: {
                                        selector: PRINT_CONTENT_PAGE_SELECTOR,
                                        timeoutMs: this.config.renderTimeoutSeconds * 1000
                                    },
                                    checkErrorPatterns: true
                                },
                                compress: false
                            }
                        );
                        runLogger.debug(
                            {
                                event: "docs_pdf.render.content_page.end",
                                durationMs,
                                slug: pageInfo.slug,
                                orderIndex,
                                listIndex: orderIndex + 1,
                                listTotal: pages.length,
                                bytes: bytesLength,
                                pages: pdf.getPageCount()
                            },
                            "Content page rendered"
                        );
                        return { pdf, slug: pageInfo.slug, orderIndex };
                    } catch (e) {
                        const errorMessage = extractErrorMessage(e);
                        runLogger.error(
                            {
                                event: "docs_pdf.render.content_page.failed",
                                slug: pageInfo.slug,
                                orderIndex,
                                error: errorMessage
                            },
                            "Failed to render content page"
                        );

                        if (!this.config.continueOnPageError) {
                            throw new Error(`Failed to render content page "${pageInfo.slug}": ${errorMessage}`);
                        }

                        pageErrors.push({
                            slug: pageInfo.slug,
                            orderIndex,
                            message: errorMessage
                        });
                        return null;
                    }
                })
            );
            if (orderIndex < this.config.maxRenderConcurrency - 1) {
                await sleep(RENDER_STAGGER_DELAY_MS);
            }
        }
        const rendered = await Promise.all(renderPromises);
        const successful = rendered.filter((x) => x != null);
        runLogger.info(
            {
                event: "docs_pdf.render.content_pages.end",
                durationMs: Date.now() - start,
                total: pages.length,
                successful: successful.length,
                failed: pageErrors.length
            },
            "Rendered content pages"
        );
        return successful;
    }

    /**
     * Fetch the ordered list of content pages to include in the PDF.
     *
     * This calls the docs app's `_print/pages` endpoint, which returns slugs.
     */
    private async fetchContentPageList(runLogger: Logger, params: GenerateDocsPdfParams) {
        const fetchStart = Date.now();
        const { docsUrl, productId, versionId } = params;
        const pagesUrl = new URL(`${docsUrl}/${PRINT_PAGES_PATH}`);
        if (versionId != null) {
            pagesUrl.searchParams.set("versionId", versionId);
        }
        if (productId != null) {
            pagesUrl.searchParams.set("productId", productId);
        }
        try {
            const pagesResponse = await withRetry(
                () =>
                    axios.get<PrintPagesResponse>(pagesUrl.toString(), {
                        headers: {
                            ...(this.config.authToken
                                ? { "x-fern-token": this.config.authToken, FERN_TOKEN: this.config.authToken }
                                : {}),
                            ...(params.previewHost ? { Cookie: `_fern_docs_preview=${params.previewHost}` } : {}),
                            Accept: "application/json"
                        },
                        timeout: 30_000
                    }),
                {
                    maxRetries: 3,
                    baseDelayMs: 1_000,
                    maxDelayMs: 5_000,
                    shouldRetry: (e) => {
                        if (!axios.isAxiosError(e)) {
                            return true;
                        }
                        const status = e.response?.status;
                        return status == null || status >= 500;
                    }
                }
            );

            const { data: pagesData } = pagesResponse;
            runLogger.info(
                {
                    event: "docs_pdf.fetch.pages_list.ok",
                    durationMs: Date.now() - fetchStart,
                    pages: pagesData.pages.length,
                    resolvedProduct: pagesData.resolvedProduct,
                    resolvedVersion: pagesData.resolvedVersion,
                    availableProducts: pagesData.availableProducts?.length,
                    availableVersions: pagesData.availableVersions?.length
                },
                "Fetched content pages list"
            );
            return pagesData.pages;
        } catch (e) {
            const status = axios.isAxiosError(e) ? e.response?.status : undefined;
            const statusText = axios.isAxiosError(e) ? e.response?.statusText : undefined;
            runLogger.error(
                {
                    event: "docs_pdf.fetch.pages_list.failed",
                    status,
                    statusText,
                    error: extractErrorMessage(e)
                },
                "Failed to fetch pages list"
            );
            throw new Error(`Failed to fetch pages list: ${extractErrorMessage(e)}`);
        }
    }

    /**
     * Render the table-of-contents HTML to a PDF.
     *
     * `contentPageNumberBySlug` uses *content section* page numbers (1-based),
     * so the TOC can display "Page N" correctly.
     */
    private async renderTocPdf(
        runLogger: Logger,
        browserContext: BrowserContext,
        params: GenerateDocsPdfParams,
        contentPageNumberBySlug: Map<string, number>
    ) {
        const { docsUrl, productId, versionId } = params;
        const entries = Array.from(contentPageNumberBySlug.entries());
        const tocUrl = new URL(`${docsUrl}/${PRINT_TOC_PATH}`);
        if (versionId != null) {
            tocUrl.searchParams.set("versionId", versionId);
        }
        if (productId != null) {
            tocUrl.searchParams.set("productId", productId);
        }
        const url = tocUrl.toString();
        const tocInitScript = (tocEntries: [string, number][]) => {
            (globalThis as { __FERN_TOC_PAGE_NUMBERS__?: [string, number][] }).__FERN_TOC_PAGE_NUMBERS__ = tocEntries;
        };

        const { pdf, bytesLength, durationMs } = await this.renderUrlToPdfWithRetries(runLogger, browserContext, {
            operation: "render_toc",
            url,
            initScript: {
                fn: tocInitScript as (...args: unknown[]) => void,
                args: [entries]
            },
            waitForSelector: PRINT_TOC_PAGE_HYDRATED_SELECTOR,
            fields: { entries: contentPageNumberBySlug.size },
            contentValidation: {
                checkErrorPatterns: true
            }
        });
        runLogger.debug(
            {
                event: "docs_pdf.render.toc.end",
                durationMs,
                entries: contentPageNumberBySlug.size,
                bytes: bytesLength,
                pages: pdf.getPageCount()
            },
            "TOC rendered"
        );
        return pdf;
    }

    /**
     * Build a mapping from content page slug → displayed page number (1-based).
     *
     * These numbers are *within the content section only* (i.e. cover/TOC not included),
     * which matches what we show in the TOC.
     */
    private buildContentPageNumbersBySlug(contentPdfs: ContentPagePdfInfo[]) {
        const map = new Map<string, number>();
        let currentContentPageNumber = 1;
        for (const { pdf, slug } of contentPdfs) {
            map.set(slug, currentContentPageNumber);
            currentContentPageNumber += pdf.getPageCount();
        }
        return map;
    }

    /**
     * Rewrite Chromium-generated TOC link annotations into internal PDF links.
     *
     * The TOC HTML contains sentinel URI links (see `TOC_LINK_SENTINEL_URL_PREFIX`).
     * Chromium prints those as `/A << /S /URI /URI (...) >>` annotations.
     *
     * After merging documents, the original URI targets no longer make sense, so we:
     * - locate TOC pages in the merged document
     * - find matching URI annotations
     * - decode the slug from the sentinel URL
     * - compute the target page index inside the merged PDF
     * - replace the annotation action with a `/Dest` pointing to the target page
     *
     * This preserves Chromium's precise clickable rectangle while making links internal.
     */
    private async rewriteTocLinksToInternalDestinations(
        runLogger: Logger,
        mergedPdf: PDFDocument,
        coverDocumentPageCount: number,
        tocDocumentPageCount: number,
        contentPageNumberBySlug: Map<string, number>
    ) {
        const start = Date.now();
        let tocPagesProcessed = 0;
        let annotationsSeen = 0;
        let uriAnnotationsSeen = 0;
        let sentinelLinksSeen = 0;
        let linksRewritten = 0;
        let missingSlugMappings = 0;

        const tocStartPageIndex = coverDocumentPageCount;
        const contentStartPageIndex = coverDocumentPageCount + tocDocumentPageCount;

        for (let i = 0; i < tocDocumentPageCount; i++) {
            const pageIndex = tocStartPageIndex + i;
            const page = mergedPdf.getPage(pageIndex);
            const annots = page.node.lookupMaybe(PDFName.Annots, PDFArray);
            if (!annots) {
                continue;
            }
            tocPagesProcessed++;

            for (let annotIndex = 0; annotIndex < annots.size(); annotIndex++) {
                annotationsSeen++;
                const annot = annots.lookupMaybe(annotIndex, PDFDict);
                if (!annot) {
                    continue;
                }

                const subtype = annot.lookupMaybe(PDFName.of("Subtype"), PDFName);
                if (subtype?.decodeText() !== "Link") {
                    continue;
                }

                const action = annot.lookupMaybe(PDFName.of("A"), PDFDict);
                if (!action) {
                    continue;
                }

                const actionType = action.lookupMaybe(PDFName.of("S"), PDFName);
                if (actionType?.decodeText() !== "URI") {
                    continue;
                }
                uriAnnotationsSeen++;

                const uriObj = action.lookupMaybe(PDFName.of("URI"), PDFString, PDFHexString);
                const uri = uriObj?.decodeText();
                if (!uri || !uri.startsWith(TOC_LINK_SENTINEL_URL_PREFIX + "/")) {
                    continue;
                }
                sentinelLinksSeen++;

                let slug: string;
                try {
                    slug = decodeURIComponent(uri.slice(TOC_LINK_SENTINEL_URL_PREFIX.length + 1));
                } catch {
                    continue;
                }

                const targetPageNumber = contentPageNumberBySlug.get(slug);
                if (targetPageNumber == null) {
                    missingSlugMappings++;
                    continue;
                }

                const targetPageIndex = contentStartPageIndex + (targetPageNumber - 1);
                if (targetPageIndex < 0 || targetPageIndex >= mergedPdf.getPageCount()) {
                    continue;
                }

                const targetPage = mergedPdf.getPage(targetPageIndex);

                // Set /Dest and remove /A to make this an internal link.
                const dest = page.doc.context.obj([targetPage.ref, PDFName.of("XYZ"), null, null, null]);
                annot.set(PDFName.of("Dest"), dest);
                annot.delete(PDFName.of("A"));
                linksRewritten++;
            }
        }

        runLogger.info(
            {
                event: "docs_pdf.toc_links.rewrite.end",
                durationMs: Date.now() - start,
                tocPages: tocDocumentPageCount,
                tocPagesProcessed,
                annotationsSeen,
                uriAnnotationsSeen,
                sentinelLinksSeen,
                linksRewritten,
                missingSlugMappings
            },
            "Rewrote TOC links"
        );
    }

    /**
     * Draw headers and footers onto all pages in the content section.
     *
     * This stamps text directly into the PDF via `pdf-lib` (not Playwright templates),
     * which avoids Chromium footer limitations and supports templated placeholders.
     */
    private async drawHeadersAndFooters(
        runLogger: Logger,
        mergedPdf: PDFDocument,
        contentStartPageIndex: number,
        options: GenerateDocsPdfOptions
    ) {
        const start = Date.now();
        const font = await mergedPdf.embedFont(StandardFonts.Helvetica);
        const fontSize = HEADER_FOOTER_FONT_SIZE_PT;
        const color = HEADER_FOOTER_TEXT_COLOR;

        const totalContentPages = mergedPdf.getPageCount() - contentStartPageIndex;

        runLogger.info(
            {
                event: "docs_pdf.headers_footers.start",
                totalContentPages
            },
            "Stamping headers/footers"
        );

        for (let i = contentStartPageIndex; i < mergedPdf.getPageCount(); i++) {
            const page = mergedPdf.getPage(i);
            const { width, height } = page.getSize();

            const pageIndex = i - contentStartPageIndex + 1; // 1-based within content

            const renderTemplate = (template: string | undefined) =>
                template == null
                    ? undefined
                    : template
                          .replaceAll(TEMPLATE_PAGE_INDEX_PLACEHOLDER, String(pageIndex))
                          .replaceAll(TEMPLATE_TOTAL_PAGES_PLACEHOLDER, String(totalContentPages));

            const headerLeft = renderTemplate(options.headerLeftTemplate);
            const headerRight = renderTemplate(options.headerRightTemplate);
            const footerLeft = renderTemplate(options.footerLeftTemplate);
            const footerRight = renderTemplate(options.footerRightTemplate);

            const xInset = HEADER_FOOTER_INSET_PT;
            const headerY = height - HEADER_FOOTER_INSET_PT;
            const footerY = HEADER_FOOTER_INSET_PT;

            if (headerLeft) {
                page.drawText(headerLeft, { x: xInset, y: headerY, size: fontSize, font, color });
            }
            if (headerRight) {
                const textWidth = font.widthOfTextAtSize(headerRight, fontSize);
                page.drawText(headerRight, {
                    x: Math.max(xInset, width - xInset - textWidth),
                    y: headerY,
                    size: fontSize,
                    font,
                    color
                });
            }

            if (footerLeft) {
                page.drawText(footerLeft, { x: xInset, y: footerY, size: fontSize, font, color });
            }
            if (footerRight) {
                const textWidth = font.widthOfTextAtSize(footerRight, fontSize);
                page.drawText(footerRight, {
                    x: Math.max(xInset, width - xInset - textWidth),
                    y: footerY,
                    size: fontSize,
                    font,
                    color
                });
            }
        }

        runLogger.info(
            { event: "docs_pdf.headers_footers.end", durationMs: Date.now() - start, totalContentPages },
            "Stamped headers/footers"
        );
    }

    private setMetadata(pdf: PDFDocument) {
        pdf.setTitle("");
        pdf.setAuthor("");
        pdf.setCreator(FILE_METADATA_CREATOR);
        pdf.setProducer(FILE_METADATA_PRODUCER);
    }

    /**
     * Runtime guard ensuring the browser is launched.
     * Throws a clear error if `start()` has not been called.
     */
    public assertStarted(): asserts this is DocsPdfExporter & { browser: Browser } {
        if (this.browser === null) {
            throw new Error("Browser is not launched. Call start() first.");
        }
    }

    public assertNotStarted(): asserts this is DocsPdfExporter & { browser: null } {
        if (this.browser !== null) {
            throw new Error("Browser is already launched. Call stop() first.");
        }
    }
}

class NonRetryableError extends Error {
    public constructor(message: string) {
        super(message);
        this.name = "NonRetryableError";
    }
}
