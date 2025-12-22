/**
 * Analytics Cron Service
 *
 * Caches expensive PostHog analytics queries by inserting records into Supabase.
 * This allows the dashboard to display cached analytics data instead of making
 * expensive PostHog API calls for each page load.
 *
 * Usage:
 * - Call `runAnalyticsCron({ period: 7 })` to collect analytics for the last 7 days
 * - Call `runAnalyticsCron({ period: 30 }, { orgId: 'my-org' })` for a specific org
 * - Call `runAnalyticsCronForOrgId(orgId, 30)` to collect analytics for a specific org by ID
 * - Call `runAnalyticsCronForOrgName(orgName, 30)` to collect analytics for a specific org by name
 * - Call `runAnalyticsCronForAllPeriods()` to collect analytics for all supported periods
 */

export type { ProductionDomain } from "./getAllProductionDomains";
export {
    getAllDomainsIncludingPreviews,
    getAllProductionDomains
} from "./getAllProductionDomains";
export { insertAnalyticsForSite } from "./insert";
export type { AnalyticsCronOptions } from "./run";
export {
    runAnalyticsCron,
    runAnalyticsCronForAllPeriods,
    runAnalyticsCronForSite
} from "./run";
export type {
    AnalyticsCronConfig,
    AnalyticsCronRunResult,
    DateRangePeriod,
    InsertAnalyticsResult,
    OrgAnalyticsResult
} from "./types";
