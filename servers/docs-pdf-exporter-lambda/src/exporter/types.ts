import type { ConsoleLogFormat, LogLevel } from "../util/logger";

export interface DocsPdfExporterConfig {
    /**
     * Maximum number of content pages to render concurrently during generation.
     * This bounds browser page creation and prevents thrashing on large sites.
     *
     * @defaultValue 10
     */
    maxRenderConcurrency: number;

    /**
     * Maximum number of retries for rendering an individual page to PDF (cover/TOC/content).
     *
     * Retries are useful for transient failures (timeouts, navigation flakiness,
     * Chromium hiccups). Total attempts = 1 + maxRenderRetries.
     *
     * @defaultValue 4
     */
    maxRenderRetries: number;

    /**
     * Maximum time to wait for any printed page (cover/TOC/content) to load and become idle.
     *
     * @defaultValue 60
     */
    renderTimeoutSeconds: number;

    /**
     * Whether to continue generating the PDF when a content page fails to render after all retries.
     *
     * - When `false` (default), any content page render failure aborts the entire run and throws.
     * - When `true`, failed pages are skipped and their errors collected in the result.
     *   The PDF is still produced with the remaining pages.
     *
     * This only affects content page rendering. Failures in cover, TOC, merge, etc. always throw.
     *
     * @defaultValue false
     */
    continueOnPageError: boolean;

    /**
     * Ghostscript-based PDF compression settings.
     *
     * When provided, each individual page PDF (cover, TOC, content) is post-processed
     * through Ghostscript *before* merging.  This recompresses embedded images,
     * consolidates fonts, and removes unused objects — targeting the biggest sources
     * of PDF file-size bloat.
     *
     * Because compression runs on each page independently (before merge, TOC link
     * rewriting, and header/footer stamping), annotations and cross-references
     * added in later pipeline stages are never affected.
     *
     * Requires `gs` (Ghostscript) to be available on `$PATH`.
     *
     * Set to `undefined` to disable compression.
     *
     * @defaultValue undefined
     */
    compression: PdfCompressionConfig | undefined;

    /**
     * Logging verbosity.
     *
     * - `silent`: no logs
     * - `error`: only failures
     * - `warn`: warnings + errors
     * - `info`: high-level progress
     * - `debug`: verbose per-step and per-page timing
     *
     * @defaultValue "info"
     */
    logLevel: LogLevel;

    /**
     * Output format used when logging to console (only applies to the default logger).
     *
     * @defaultValue "pretty"
     */
    logFormat: ConsoleLogFormat;

    /**
     * Authentication token sent as `FERN_TOKEN` header to protected print routes.
     * Required when accessing authenticated documentation sites.
     *
     * This should be the Fern admin token.
     */
    authToken?: string;
}

/**
 * Configuration for Ghostscript-based PDF compression.
 *
 * All fields are optional and fall back to sensible defaults.
 */
export interface PdfCompressionConfig {
    /**
     * Quality presets for Ghostscript PDF compression, controlling image
     * downsampling resolution and overall compression aggressiveness.
     *
     * - `"screen"`:   72 dpi images — smallest files, suitable for screen viewing only
     * - `"ebook"`:    150 dpi images — good balance of quality and size
     * - `"printer"`:  300 dpi images — high quality, suitable for printing
     * - `"prepress"`: 300 dpi images — highest quality with full color
     *
     * @defaultValue "ebook"
     */
    quality: "screen" | "ebook" | "printer" | "prepress";

    /**
     * Maximum time in seconds to wait for Ghostscript to compress a single
     * page PDF.  If exceeded, the uncompressed page PDF is used instead and
     * a warning is logged.
     *
     * @defaultValue 30
     */
    timeoutSeconds: number;

    /**
     * Maximum number of Ghostscript processes that may run concurrently.
     *
     * Page rendering uses `maxRenderConcurrency` (e.g. 50) for fast Chromium
     * rendering, but each Ghostscript subprocess consumes significant memory.
     * This limit decouples compression concurrency from render concurrency so
     * that render slots release their Chromium pages quickly while compression
     * is rate-limited.
     *
     * @defaultValue 5
     */
    maxConcurrency: number;
}

export interface DocsPdfGenerateOptions {
    /**
     * Cover title (center heading).
     *
     * - omit / `undefined`: use the site's configured default
     * - `null`: render nothing (hide)
     * - string: render the provided string (after trimming)
     */
    coverTitle?: string | null;

    /**
     * Cover subtitle (center subheading).
     *
     * - omit / `undefined`: use the default subtitle
     * - `null`: render nothing (hide)
     * - string: render the provided string (after trimming)
     */
    coverSubtitle?: string | null;

    /**
     * Hide the "Generated by Fern" footer on the cover page.
     *
     * @defaultValue false
     */
    hideCoverFooter?: boolean;

    /**
     * Header (top-left) template for content pages.
     * Supports placeholders: `{pageIndex}`, `{totalPages}`.
     */
    headerLeftTemplate?: string;

    /**
     * Header (top-right) template for content pages.
     * Supports placeholders: `{pageIndex}`, `{totalPages}`.
     */
    headerRightTemplate?: string;

    /**
     * Footer (bottom-left) template for content pages.
     * Supports placeholders: `{pageIndex}`, `{totalPages}`.
     */
    footerLeftTemplate?: string;

    /**
     * Footer (bottom-right) template for content pages.
     * Supports placeholders: `{pageIndex}`, `{totalPages}`.
     */
    footerRightTemplate?: string;
}

/**
 * Result of generating a cover PDF.
 */
export interface CoverPdfGenerateResult {
    /**
     * The generated PDF bytes.
     */
    pdfBytes: Uint8Array;
}

/**
 * Information about a content page that failed to render.
 */
export interface PageRenderError {
    /**
     * The slug of the page that failed to render.
     */
    slug: string;

    /**
     * The 0-based index in the original page list.
     */
    orderIndex: number;

    /**
     * The error message.
     */
    message: string;
}

/**
 * Result of generating a docs PDF.
 */
export interface DocsPdfGenerateResult {
    /**
     * The generated PDF bytes.
     */
    pdfBytes: Uint8Array;

    /**
     * Content pages that failed to render and were skipped.
     * Only populated when `continueOnPageError` is enabled.
     */
    pageErrors: PageRenderError[];
}
