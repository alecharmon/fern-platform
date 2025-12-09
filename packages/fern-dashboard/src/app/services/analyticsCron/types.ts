/**
 * Analytics Cron Types
 *
 * Type definitions for the analytics cron job.
 */

/**
 * Supported date range periods for analytics records
 */
export type DateRangePeriod = 7 | 14 | 30 | 90 | 180;

/**
 * Configuration for an analytics cron run
 */
export interface AnalyticsCronConfig {
    /**
     * The date range period in days (7, 14, 30, 90, or 180)
     */
    period: DateRangePeriod;
}

/**
 * Result from inserting analytics for a single docs site
 */
export interface InsertAnalyticsResult {
    success: boolean;
    docsSite: string;
    docsOrg: string | null;
    error?: string;
}

/**
 * Result from running analytics cron for an organization
 */
export interface OrgAnalyticsResult {
    orgName: string;
    results: InsertAnalyticsResult[];
    totalSites: number;
    successCount: number;
    errorCount: number;
}

/**
 * Overall result from an analytics cron run
 */
export interface AnalyticsCronRunResult {
    startedAt: string;
    completedAt: string;
    period: DateRangePeriod;
    orgResults: OrgAnalyticsResult[];
    totalOrgs: number;
    totalSites: number;
    totalSuccesses: number;
    totalErrors: number;
}
