/**
 * Supabase Database Types
 *
 * Type definitions for the Supabase database schema.
 * These types provide type safety when interacting with the database.
 */

export interface ChartDataPoint {
    date: string;
    value: number;
}

export interface AnalyticsRecord {
    id: number;
    created_at: string;
    start_date: string | null;
    end_date: string | null;
    top_paths: TopPathsEntry[] | null;
    top_countries: TopCountriesEntry[] | null;
    top_channels: TopChannelsEntry[] | null;
    top_device_types: TopDeviceTypesEntry[] | null;
    top_referring_domains: TopReferringDomainsEntry[] | null;
    top_llm_txts: TopLLMTxtsEntry[] | null;
    top_api_explorer: TopAPIExplorerEntry[] | null;
    top_llm_bot_traffic: TopLLMBotTrafficEntry[] | null;
    pages_404: Array<{ path: string; count: number }> | null;
    docs_site: string | null;
    docs_org: string | null;
    total_visitors: number | null;
    total_views: number | null;
    visitor_chart: ChartDataPoint[] | null;
    view_chart: ChartDataPoint[] | null;
}

export interface TopPathsEntry {
    path: string;
    visitors: number;
    views: number;
}

export interface TopCountriesEntry {
    country: string;
    visitors: number;
    views: number;
}

export interface TopChannelsEntry {
    channel: string;
    visitors: number;
    views: number;
}

export interface TopDeviceTypesEntry {
    deviceType: string;
    visitors: number;
    views: number;
}

export interface TopReferringDomainsEntry {
    domain: string;
    visitors: number;
    views: number;
}

export interface TopLLMTxtsEntry {
    path: string;
    agentViews: number;
    humanViews: number;
}

export interface TopAPIExplorerEntry {
    method: string;
    endpoint: string;
    name: string;
    count: number;
    numSuccesses: number;
    numFailures: number;
}

export interface TopLLMBotTrafficEntry {
    provider: string;
    count: number;
}

export type AnalyticsRecordInsert = Omit<AnalyticsRecord, "id" | "created_at">;
