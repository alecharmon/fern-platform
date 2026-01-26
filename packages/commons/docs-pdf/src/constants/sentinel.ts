/**
 * Prefix for "sentinel" links in the TOC HTML.
 *
 * The TOC page renders anchors like:
 * `https://fern-pdf.local/__fern_pdf_link/<encoded-slug>`
 *
 * Chromium prints those as URI link annotations. After merging PDFs, the PDF
 * generator rewrites those annotations into internal PDF /Dest links to the
 * correct page. This avoids brittle geometry/coordinate-based link placement.
 */
export const TOC_LINK_SENTINEL_URL_PREFIX = "https://fern-pdf.local/__fern_pdf_link";
