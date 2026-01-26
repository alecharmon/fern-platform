/**
 * Data attribute name for print content pages.
 * Added to the root element of successfully rendered content pages.
 */
export const PRINT_CONTENT_PAGE_DATA_ATTR = "data-fern-print-single-page";

/**
 * Data attribute name for print cover pages.
 * Added to the root element of successfully rendered cover pages.
 */
export const PRINT_COVER_PAGE_DATA_ATTR = "data-fern-print-cover-page";

/**
 * Data attribute name for print TOC pages.
 * Added to the root element of successfully rendered TOC pages.
 */
export const PRINT_TOC_PAGE_DATA_ATTR = "data-fern-print-toc-page";

/**
 * Data attribute name indicating TOC hydration is complete.
 * Set by the client-side hydrator after page numbers are applied.
 */
export const PRINT_TOC_HYDRATED_DATA_ATTR = "data-fern-toc-hydrated";

/**
 * CSS selector for successfully rendered print content pages.
 * Used by the PDF generator to validate page render success.
 */
export const PRINT_CONTENT_PAGE_SELECTOR = `[${PRINT_CONTENT_PAGE_DATA_ATTR}]`;

/**
 * CSS selector for successfully rendered print cover pages.
 * Used by the PDF generator to validate page render success.
 */
export const PRINT_COVER_PAGE_SELECTOR = `[${PRINT_COVER_PAGE_DATA_ATTR}]`;

/**
 * CSS selector for print TOC pages (without hydration check).
 * Used by the client-side hydrator to find the TOC root element.
 */
export const PRINT_TOC_PAGE_SELECTOR = `[${PRINT_TOC_PAGE_DATA_ATTR}]`;

/**
 * CSS selector for successfully rendered and hydrated print TOC pages.
 * Used by the PDF generator to wait for TOC hydration before rendering.
 */
export const PRINT_TOC_PAGE_HYDRATED_SELECTOR = `[${PRINT_TOC_PAGE_DATA_ATTR}][${PRINT_TOC_HYDRATED_DATA_ATTR}="true"]`;
