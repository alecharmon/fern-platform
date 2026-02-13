/**
 * Supabase Service
 *
 * Re-exports from @fern-platform/supabase for database operations.
 * Custom analytics types are kept locally for detailed type safety.
 */
export { getSupabaseClient, type SupabaseDatabase } from "./client";

// Detailed analytics types (more specific than generated Json types)
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
