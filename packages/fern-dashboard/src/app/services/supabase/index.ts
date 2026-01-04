/**
 * Supabase Service
 *
 * Provides access to Supabase client and types for database operations.
 */
export { getSupabaseClient } from "./client";
export type {
    AnalyticsRecord,
    AnalyticsRecordInsert,
    ChartDataPoint,
    CustomDomainVerificationInsert,
    CustomDomainVerificationRow,
    DomainVerificationStatus,
    TopAPIExplorerEntry,
    TopChannelsEntry,
    TopCountriesEntry,
    TopDeviceTypesEntry,
    TopLLMBotTrafficEntry,
    TopLLMTxtsEntry,
    TopPathsEntry,
    TopReferringDomainsEntry
} from "./types";
