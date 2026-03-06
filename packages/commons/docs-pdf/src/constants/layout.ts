/**
 * A4 page dimensions in PDF points (1pt = 1/72 inch).
 * Standard ISO A4: 210mm x 297mm ≈ 595pt x 842pt.
 */
export const A4_PAGE_SIZE_PT = { width: 595, height: 842 } as const;

/**
 * Header/footer inset from the page edge in PDF points.
 */
export const HEADER_FOOTER_INSET_PT = 32;

/**
 * Font size for headers/footers in PDF points.
 */
export const HEADER_FOOTER_FONT_SIZE_PT = 9;

/**
 * Header/footer text color as RGB components (0–255).
 * Matches Tailwind `gray-400` (#9ca3af).
 */
export const HEADER_FOOTER_TEXT_COLOR_RGB = { r: 156, g: 163, b: 175 } as const;
