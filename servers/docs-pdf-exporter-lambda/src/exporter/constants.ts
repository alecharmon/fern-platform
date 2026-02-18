import { rgb } from "pdf-lib";

/**
 * Browser viewport used for consistent layout during printing.
 * This approximates A4 at 96dpi (794×1123). 1240×1754 also works, but is heavier.
 */
export const A4_VIEWPORT_PX = { width: 794, height: 1123 } as const;

/**
 * Header/footer inset from the page edge in PDF points.
 * PDF units are points (pt). 1in = 72pt.
 */
export const HEADER_FOOTER_INSET_PT = 32;

/**
 * Font size used for headers/footers (in PDF points).
 */
export const HEADER_FOOTER_FONT_SIZE = 9;

/**
 * Text color used for headers/footers.
 * Matches Tailwind `text-gray-400` (design system) used on the cover page footer.
 */
export const HEADER_FOOTER_TEXT_COLOR = rgb(156 / 255, 163 / 255, 175 / 255);

export const FILE_METADATA_CREATOR = "Fern";
export const FILE_METADATA_PRODUCER = "Fern PDF Generator";

export const RETRY_BASE_DELAY_MS = 250;
export const RETRY_MAX_DELAY_MS = 3_000;

/**
 * After navigation and content validation, we do a best-effort wait for
 * `networkidle` to let remaining sub-resources (lazy images, fonts, dynamic
 * code block highlighting, etc.) finish loading before printing.
 *
 * If this timeout expires, we proceed with printing anyway — the critical
 * content is already in the DOM (confirmed by the success selector).
 *
 * This is deliberately much shorter than the main render timeout so that
 * long-running background requests (analytics, prefetch, polling) don't
 * block the entire pipeline.
 */
export const NETWORK_IDLE_BEST_EFFORT_TIMEOUT_MS = 15_000;
