import { randomUUID } from "node:crypto";
import {
    PRINT_CONTENT_PAGE_SELECTOR,
    PRINT_COVER_PAGE_SELECTOR,
    PRINT_COVER_PATH,
    PRINT_PAGE_PATH_PREFIX,
    PRINT_PAGES_PATH,
    PRINT_TOC_PAGE_HYDRATED_SELECTOR,
    PRINT_TOC_PATH,
    TEMPLATE_PAGE_INDEX_PLACEHOLDER,
    TEMPLATE_TOTAL_PAGES_PLACEHOLDER,
    TOC_LINK_SENTINEL_URL_PREFIX
} from "@fern-api/docs-pdf";
import axios from "axios";
import pLimit from "p-limit";
import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFString, StandardFonts } from "pdf-lib";
import { type Browser, type BrowserContext, type BrowserContextOptions, chromium, type Page } from "playwright";
import { z } from "zod";
import { assertNever } from "../util/assert";
import { extractErrorMessage } from "../util/extract-error-message";
import { createConsoleJsonLogger, createPrettyConsoleLogger, type Logger, withLogLevel } from "../util/logger";
import { mergePdfDocuments } from "../util/merge-pdf-documents";
import { parseObjectWithSchema } from "../util/parse-object-with-schema";
import {
    A4_VIEWPORT_PX,
    FILE_METADATA_CREATOR,
    FILE_METADATA_PRODUCER,
    HEADER_FOOTER_FONT_SIZE,
    HEADER_FOOTER_INSET_PT,
    HEADER_FOOTER_TEXT_COLOR,
    RETRY_BASE_DELAY_MS,
    RETRY_MAX_DELAY_MS
} from "./constants";
import type {
    CoverPdfGenerateResult,
    DocsPdfExporterConfig,
    DocsPdfGenerateOptions,
    DocsPdfGenerateResult,
    PageRenderError
} from "./types";

async function sleep(ms: number) {
    await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Schema for a single content page entry returned by the docs "print pages" endpoint.
 * This is the minimum information needed to render each page to PDF.
 */
const ContentPageInfoSchema = z.object({
    slug: z.string(),
    title: z.string().optional()
});

/**
 * Response schema for the docs "print pages" endpoint.
 */
const ContentPagesResponseSchema = z.object({
    pages: z.array(ContentPageInfoSchema)
});

/**
 * Options for content validation after page navigation.
 */
interface ContentValidationOptions {
    /**
     * CSS selector that must exist for the page to be considered successfully rendered.
     * If provided and the selector is not found, validation fails.
     */
    successSelector?: string;

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
    maxRenderConcurrency: 5,
    renderTimeoutSeconds: 60,
    maxRenderRetries: 2,
    logLevel: "info",
    logFormat: "pretty",
    continueOnPageError: false
};

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
 * - merging pages into a single PDF via `pdf-lib`
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
    public constructor(config: Partial<DocsPdfExporterConfig> = {}) {
        this.config = { ...DEFAULT_DOCS_PDF_GENERATOR_CONFIG, ...config };
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
     * Validate that a page rendered successfully by checking for:
     * 1. Absence of error UI elements (always checked - catches client-side hydration failures)
     * 2. Presence of a success marker element (if configured - confirms server render succeeded)
     *
     * @throws {Error} If validation fails (retryable)
     */
    private async validatePageContent(page: Page, options: ContentValidationOptions = {}): Promise<void> {
        const { successSelector, checkErrorPatterns = true } = options;

        if (checkErrorPatterns) {
            const errorDetails = await this.detectErrorUIElements(page);
            if (errorDetails) {
                throw new Error(
                    `Page content validation failed: ${errorDetails}. ` +
                        "This is likely a transient React/Next.js error that may succeed on retry."
                );
            }
        }

        if (successSelector) {
            const hasSuccessMarker = await page
                .locator(successSelector)
                .first()
                .isVisible()
                .catch(() => false);
            if (!hasSuccessMarker) {
                throw new Error(
                    `Page content validation failed: success marker "${successSelector}" not found. ` +
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
        }
    ) {
        return await this.withRetries(
            runLogger,
            { operation: opts.operation, fields: { url: opts.url, ...(opts.fields ?? {}) } },
            async () => {
                const start = Date.now();
                const page = await browserContext.newPage();
                await page.emulateMedia({ media: "print", colorScheme: "light" });
                await this.setupPageAuth(page);
                try {
                    if (opts.initScript) {
                        await page.addInitScript(opts.initScript.fn, ...(opts.initScript.args ?? []));
                    }
                    const response = await page.goto(opts.url, {
                        waitUntil: "networkidle",
                        timeout: this.config.renderTimeoutSeconds * 1000
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

                    if (opts.waitForSelector) {
                        await page.waitForSelector(opts.waitForSelector, {
                            timeout: this.config.renderTimeoutSeconds * 1000
                        });
                    }

                    if (opts.contentValidation) {
                        await this.validatePageContent(page, opts.contentValidation);
                    }

                    const bytes = await page.pdf({
                        printBackground: true,
                        preferCSSPageSize: true
                    });
                    const pdf = await PDFDocument.load(bytes);
                    return { pdf, bytesLength: bytes.length, durationMs: Date.now() - start };
                } finally {
                    await page.close();
                }
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
                    // Lambda's seccomp profile restricts clone() flags used by Chromium's zygote process.
                    // Without this, the main browser process starts but renderer processes can't be created,
                    // causing "Target page, context or browser has been closed" on newPage().
                    "--no-zygote"
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
        baseUrl: string,
        options: DocsPdfGenerateOptions = {}
    ): Promise<DocsPdfGenerateResult> {
        this.assertStarted();
        const runId = randomUUID();
        const runLogger = this.logger.child({ runId, baseUrl });
        const start = Date.now();
        const pageErrors: PageRenderError[] = [];

        runLogger.info(
            {
                event: "docs_pdf.generate.start",
                maxRenderConcurrency: this.config.maxRenderConcurrency,
                renderTimeoutSeconds: this.config.renderTimeoutSeconds
            },
            "Generating docs PDF"
        );

        const browserContext = await this.browser.newContext(this.getBrowserContextOptions());

        try {
            const [coverPdf, contentPdfs] = await Promise.all([
                this.renderCoverPdf(runLogger, browserContext, baseUrl, options),
                this.renderContentPdfs(runLogger, browserContext, baseUrl, pageErrors)
            ]);

            const contentPageNumbersBySlug = this.buildContentPageNumbersBySlug(contentPdfs);
            const tocPdf = await this.renderTocPdf(runLogger, browserContext, baseUrl, contentPageNumbersBySlug);

            const mergeStart = Date.now();
            const mergedPdf = await mergePdfDocuments(coverPdf, tocPdf, ...contentPdfs.map(({ pdf }) => pdf));
            runLogger.debug(
                {
                    event: "docs_pdf.merge.end",
                    durationMs: Date.now() - mergeStart,
                    documents: 2 + contentPdfs.length,
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

            const saveStart = Date.now();
            this.setMetadata(mergedPdf);
            const pdfBytes = await mergedPdf.save();
            runLogger.debug(
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
        baseUrl: string,
        options: Pick<DocsPdfGenerateOptions, "coverTitle" | "coverSubtitle" | "hideCoverFooter"> = {}
    ): Promise<CoverPdfGenerateResult> {
        this.assertStarted();
        const runId = randomUUID();
        const runLogger = this.logger.child({ runId, baseUrl });
        const start = Date.now();

        runLogger.info({ event: "docs_pdf.generate_cover.start" }, "Generating cover PDF");

        const browserContext = await this.browser.newContext(this.getBrowserContextOptions());

        try {
            const coverPdf = await this.renderCoverPdf(runLogger, browserContext, baseUrl, options);
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
     * header **only** on `/_print/` navigation requests.
     */
    private async setupPageAuth(page: Page): Promise<void> {
        if (!this.config.authToken) {
            return;
        }
        const authToken = this.config.authToken;
        const cdpSession = await page.context().newCDPSession(page);
        await cdpSession.send("Fetch.enable", {
            patterns: [{ urlPattern: "*/_print/*", requestStage: "Request" }]
        });
        cdpSession.on("Fetch.requestPaused", async (event: Record<string, unknown>) => {
            const request = event.request as { headers: Record<string, string> };
            const headers = Object.entries({ ...request.headers, FERN_TOKEN: authToken }).map(([name, value]) => ({
                name,
                value
            }));
            await cdpSession.send("Fetch.continueRequest", {
                requestId: event.requestId as string,
                headers
            });
        });
    }

    /**
     * Render the cover page HTML to a single-page PDF.
     */
    private async renderCoverPdf(
        runLogger: Logger,
        browserContext: BrowserContext,
        baseUrl: string,
        options: Pick<DocsPdfGenerateOptions, "coverTitle" | "coverSubtitle" | "hideCoverFooter"> = {}
    ) {
        const url = new URL(`${baseUrl}/${PRINT_COVER_PATH}`);
        // Presence of an empty string means "hide" on the frontend.
        if (options.coverTitle === null) {
            url.searchParams.set("title", "");
        } else if (typeof options.coverTitle === "string") {
            url.searchParams.set("title", options.coverTitle.trim());
        }
        if (options.coverSubtitle === null) {
            url.searchParams.set("subtitle", "");
        } else if (typeof options.coverSubtitle === "string") {
            url.searchParams.set("subtitle", options.coverSubtitle.trim());
        }
        if (options.hideCoverFooter === true) {
            url.searchParams.set("hideFooter", "1");
        }

        const { pdf, bytesLength, durationMs } = await this.renderUrlToPdfWithRetries(runLogger, browserContext, {
            operation: "render_cover",
            url: url.toString(),
            contentValidation: {
                successSelector: PRINT_COVER_PAGE_SELECTOR,
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
        baseUrl: string,
        pageErrors: PageRenderError[]
    ): Promise<ContentPagePdfInfo[]> {
        const start = Date.now();
        const pages = await this.fetchContentPageList(runLogger, baseUrl);

        const limitFn = pLimit(this.config.maxRenderConcurrency);

        runLogger.info(
            {
                event: "docs_pdf.render.content_pages.start",
                pages: pages.length,
                maxRenderConcurrency: this.config.maxRenderConcurrency
            },
            "Rendering content pages"
        );

        const rendered = await Promise.all(
            pages.map((pageInfo, orderIndex) =>
                limitFn(async () => {
                    try {
                        const pageUrl = `${baseUrl}/${PRINT_PAGE_PATH_PREFIX}/${pageInfo.slug}`;
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
                                    successSelector: PRINT_CONTENT_PAGE_SELECTOR,
                                    checkErrorPatterns: true
                                }
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
            )
        );
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
    private async fetchContentPageList(runLogger: Logger, baseUrl: string) {
        const fetchStart = Date.now();
        try {
            const pagesResponse = await axios.get(`${baseUrl}/${PRINT_PAGES_PATH}`, {
                headers: {
                    ...(this.config.authToken ? { FERN_TOKEN: this.config.authToken } : {}),
                    Accept: "application/json"
                }
            });

            const pagesData = parseObjectWithSchema(pagesResponse.data, ContentPagesResponseSchema, "pages response");
            runLogger.info(
                {
                    event: "docs_pdf.fetch.pages_list.ok",
                    durationMs: Date.now() - fetchStart,
                    pages: pagesData.pages.length
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
        baseUrl: string,
        contentPageNumberBySlug: Map<string, number>
    ) {
        const entries = Array.from(contentPageNumberBySlug.entries());
        const url = `${baseUrl}/${PRINT_TOC_PATH}`;
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
        options: DocsPdfGenerateOptions
    ) {
        const start = Date.now();
        const font = await mergedPdf.embedFont(StandardFonts.Helvetica);
        const fontSize = HEADER_FOOTER_FONT_SIZE;
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
