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
     * When provided, the exporter merges the TOC and content pages into an
     * intermediate PDF and then runs Ghostscript on that merged document before
     * adding the cover page. This allows Ghostscript to deduplicate shared fonts
     * and other resources across the bulk of the document while leaving the final
     * TOC-link rewriting and header/footer stamping steps in `pdf-lib`.
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

    /**
     * **Internal / testing only.** When enabled, content pages are not rendered
     * through the browser. Instead, a lightweight single-page placeholder PDF is
     * generated for each page containing only the page title and slug.
     *
     * This dramatically speeds up local test runs against a slow dev server
     * because the expensive Next.js SSR + Playwright render loop is skipped
     * for content pages. Cover and TOC pages are still rendered normally so
     * that the overall PDF structure (TOC links, page numbering, merge logic)
     * can be validated end-to-end.
     *
     * **Never use this in production.**
     *
     * @defaultValue false
     * @internal
     */
    stubContentPages?: boolean;
}

/**
 * Configuration for Ghostscript-based PDF compression.
 *
 * These settings control the compression pass applied to the merged TOC +
 * content PDF.
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
     * Maximum time in seconds to wait for Ghostscript to compress the merged
     * TOC + content PDF. If exceeded, the uncompressed merged PDF is used
     * instead and a warning is logged.
     *
     * @defaultValue 180
     */
    timeoutSeconds: number;
}

/**
 * Parameters used to generate a documentation PDF.
 */
export interface GenerateDocsPdfParams {
    /**
     * Base docs site URL or hostname (e.g. `"https://ada.docs.buildwithfern.com"`
     * or `"ada.docs.buildwithfern.com"`). The exporter will normalize it and
     * append `/_print/...` paths.
     */
    docsUrl: string;

    /**
     * Version ID to export (only valid for versioned docs). If omitted, the
     * docs site will resolve a default version (typically the configured
     * default, otherwise the first available version).
     */
    versionId?: string;

    /**
     * Product ID to export (only valid for multi-product docs). If omitted, the
     * docs site will resolve a default product (typically the configured
     * default, otherwise the first internal product).
     */
    productId?: string;
}

export interface GenerateDocsPdfOptions {
    /**
     * Cover title (center heading). Omit to hide the title.
     */
    coverTitle?: string;

    /**
     * Cover subtitle (center subheading).
     */
    coverSubtitle?: string;

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
