/**
 * Maximum number of PDF export tasks an organization can create within
 * a rolling 24-hour window. Only non-failed tasks (PENDING, RUNNING,
 * COMPLETED) count toward this limit.
 */
export const MAX_PDF_EXPORTS_PER_ORG_PER_DAY = 25;
