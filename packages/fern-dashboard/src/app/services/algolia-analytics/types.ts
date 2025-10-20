export interface AlgoliaClientConfig {
    appId: string;
    apiKey: string;
    indexName: string;
}

export interface AlgoliaAnalyticsConfig {
    userId: string;
    indexName: string;
}

// Date range options matching PostHog pattern
export type DateRangeOptions =
    | {
          type: "last_n_days";
          days: number;
      }
    | {
          type: "last_n_weeks";
          weeks: number;
      }
    | {
          type: "last_n_months";
          months: number;
      }
    | {
          type: "custom_range";
          startDate: string;
          endDate: string;
      };

// Common analytics query options
export interface AnalyticsQueryOptions {
    dateRange?: DateRangeOptions;
    limit?: number;
    tags?: string; // Filter by analytics tags (e.g., endpoint, user segment)
}

// Top searches response
export interface TopSearch {
    search: string;
    count: number;
    percentage?: number;
}

export interface TopSearchesResponse {
    searches: TopSearch[];
    totalSearches: number;
}

// Searches with no results
export interface SearchWithNoResults {
    search: string;
    count: number;
    percentage?: number;
}

export interface SearchesWithNoResultsResponse {
    searches: SearchWithNoResults[];
    totalSearchesWithNoResults: number;
}

// Search count metrics
export interface SearchMetrics {
    searchCount: number;
    noResultsRate: number;
    clickThroughRate?: number;
    conversionRate?: number;
    averageClickPosition?: number;
}

// Time series data
export interface TimeSeriesData {
    date: string;
    value: number;
}

export interface TimeSeriesOptions extends AnalyticsQueryOptions {
    groupBy?: "day" | "week" | "month";
}

// Top searches by endpoint/tag
export interface TopSearchesByTagOptions extends AnalyticsQueryOptions {
    tag: string; // e.g., "endpoint:openrouter.ai"
}

// Raw Algolia Analytics API response types
export interface AlgoliaAnalyticsAPIResponse {
    searches?: {
        search: string;
        count: number;
        nbHits: number;
    }[];
    searchesCount?: number;
    noResultsCount?: number;
    clickThroughRate?: number;
    conversionRate?: number;
    averageClickPosition?: number;
}

// Error handling
export interface AlgoliaAnalyticsError {
    message: string;
    status?: number;
    statusText?: string;
}
