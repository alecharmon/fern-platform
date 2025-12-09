/**
 * Analytics Cache Service
 *
 * Retrieves pre-computed analytics data from Supabase cache.
 * Use this instead of querying PostHog directly for faster responses.
 */
if (process.env.NODE_ENV !== "test") {
    require("server-only");
}

import { getSupabaseClient } from "../supabase";
import type {
    AnalyticsRecord,
    ChartDataPoint,
    TopAPIExplorerEntry,
    TopChannelsEntry,
    TopCountriesEntry,
    TopDeviceTypesEntry,
    TopLLMBotTrafficEntry,
    TopLLMTxtsEntry,
    TopPathsEntry,
    TopReferringDomainsEntry
} from "../supabase/types";

export type DateRangePeriod = 7 | 14 | 30 | 90 | 180;

export interface CachedAnalytics {
    id: number;
    createdAt: string;
    startDate: string;
    endDate: string;
    docsSite: string;
    docsOrg: string;
    totalVisitors: number;
    totalViews: number;
    visitorChart: ChartDataPoint[];
    viewChart: ChartDataPoint[];
    topPaths: TopPathsEntry[];
    topCountries: TopCountriesEntry[];
    topChannels: TopChannelsEntry[];
    topDeviceTypes: TopDeviceTypesEntry[];
    topReferringDomains: TopReferringDomainsEntry[];
    topLlmTxts: TopLLMTxtsEntry[];
    topApiExplorer: TopAPIExplorerEntry[];
    topLlmBotTraffic: TopLLMBotTrafficEntry[];
}

export interface GetCachedAnalyticsOptions {
    docsSite: string;
    period: DateRangePeriod;
}

function mapRecordToCachedAnalytics(record: AnalyticsRecord): CachedAnalytics {
    return {
        id: record.id,
        createdAt: record.created_at,
        startDate: record.start_date || "",
        endDate: record.end_date || "",
        docsSite: record.docs_site || "",
        docsOrg: record.docs_org || "",
        totalVisitors: record.total_visitors || 0,
        totalViews: record.total_views || 0,
        visitorChart: record.visitor_chart || [],
        viewChart: record.view_chart || [],
        topPaths: record.top_paths || [],
        topCountries: record.top_countries || [],
        topChannels: record.top_channels || [],
        topDeviceTypes: record.top_device_types || [],
        topReferringDomains: record.top_referring_domains || [],
        topLlmTxts: record.top_llm_txts || [],
        topApiExplorer: record.top_api_explorer || [],
        topLlmBotTraffic: record.top_llm_bot_traffic || []
    };
}

/**
 * Get cached analytics for a docs site and time period
 *
 * @param options.docsSite - The docs site domain (e.g., "buildwithfern.com/learn")
 * @param options.period - The date range period in days (7, 14, 30, 90, or 180)
 * @returns The cached analytics record, or null if not found
 */
export async function getCachedAnalytics(options: GetCachedAnalyticsOptions): Promise<CachedAnalytics | null> {
    const { docsSite, period } = options;

    console.log("[getCachedAnalytics] Called with:", { docsSite, period });

    const now = new Date();
    const endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const startDate = new Date(endDate);
    startDate.setUTCDate(startDate.getUTCDate() - period);

    const startDateStr = startDate.toISOString().split("T")[0]!; // Safe: ISO string always has 'T'
    const endDateStr = endDate.toISOString().split("T")[0]!; // Safe: ISO string always has 'T'

    console.log("[getCachedAnalytics] Querying for:", { docsSite, startDateStr, endDateStr });

    const supabase = getSupabaseClient();
    console.log("[getCachedAnalytics] Got supabase client");

    const queryStartTime = Date.now();

    const { data, error } = await supabase
        .from("AnalyticsRecord")
        .select("*")
        .eq("docs_site", docsSite)
        .eq("start_date", startDateStr)
        .eq("end_date", endDateStr)
        .order("created_at", { ascending: false })
        .limit(1);

    const queryEndTime = Date.now();
    console.log("[getCachedAnalytics] Query result:", {
        found: !!data && data.length > 0,
        error: error?.message,
        duration: queryEndTime - queryStartTime,
        recordsReturned: data?.length || 0,
        newestRecordCreatedAt: data && data.length > 0 ? (data[0] as any)?.created_at : null
    });

    if (error || !data || data.length === 0) {
        return null;
    }

    const record = data[0] as unknown as AnalyticsRecord;
    console.log("[getCachedAnalytics] Returning record:", {
        id: record.id,
        createdAt: record.created_at,
        totalVisitors: record.total_visitors,
        totalViews: record.total_views,
        startDate: record.start_date,
        endDate: record.end_date
    });

    return mapRecordToCachedAnalytics(record);
}

/**
 * Get the most recent cached analytics for a docs site (any period)
 *
 * @param docsSite - The docs site domain
 * @returns The most recent cached analytics record, or null if not found
 */
export async function getLatestCachedAnalytics(docsSite: string): Promise<CachedAnalytics | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
        .from("AnalyticsRecord")
        .select("*")
        .eq("docs_site", docsSite)
        .order("created_at", { ascending: false })
        .limit(1);

    if (error || !data || data.length === 0) {
        return null;
    }

    return mapRecordToCachedAnalytics(data[0] as unknown as AnalyticsRecord);
}

/**
 * Get all cached analytics records for a docs site
 *
 * @param docsSite - The docs site domain
 * @param limit - Maximum number of records to return (default: 10)
 * @returns Array of cached analytics records
 */
export async function getAllCachedAnalytics(docsSite: string, limit: number = 10): Promise<CachedAnalytics[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
        .from("AnalyticsRecord")
        .select("*")
        .eq("docs_site", docsSite)
        .order("created_at", { ascending: false })
        .limit(limit);

    if (error || !data) {
        return [];
    }

    return (data as unknown as AnalyticsRecord[]).map(mapRecordToCachedAnalytics);
}

/**
 * Check if cached analytics exists for a docs site and period
 *
 * @param options.docsSite - The docs site domain
 * @param options.period - The date range period in days
 * @returns True if cache exists and is fresh (created today)
 */
export async function hasFreshCache(options: GetCachedAnalyticsOptions): Promise<boolean> {
    const cached = await getCachedAnalytics(options);
    if (!cached) {
        return false;
    }

    const today = new Date().toISOString().split("T")[0];
    const cacheDate = cached.createdAt.split("T")[0];

    return cacheDate === today;
}
