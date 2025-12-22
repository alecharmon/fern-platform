export interface PostHogClientConfig {
    projectId: string;
    apiUrl?: string;
}

export interface HogQLQueryRequest {
    query: {
        kind: "HogQLQuery";
        query: string;
    };
    name?: string;
}

export interface HogQLQueryResponse<T = unknown> {
    results: T[];
    columns: string[];
    types: string[];
    hasMore: boolean;
    timings?: {
        k: string;
        t: number;
    }[];
}

export interface AnalyticsConfig {
    userId: string;
    baseSiteUrl: string;
    additionalDomains?: string[];
}

export interface AnalyticsMetrics {
    visitors: number;
    pageViews: number;
    sessions: number;
}

export interface TimeSeriesData {
    date: string;
    value: number;
}

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
    includeInternal?: boolean;
}

// Specific options for different query types
export interface MetricsOptions extends AnalyticsQueryOptions {}

export interface TimeSeriesOptions extends AnalyticsQueryOptions {
    groupBy?: number; // Number of days to group by (e.g., 7 for weekly, 30 for monthly)
}

export interface TopPagesOptions extends AnalyticsQueryOptions {
    limit?: number;
}

export interface APIExplorerEndpoint {
    host: string;
    method: string;
    endpoint: string;
    name: string;
    count: number;
    numSuccesses: number;
    numFailures: number;
    currentUrl: string;
}

export interface APIExplorerOptions extends AnalyticsQueryOptions {
    limit?: number;
    host?: string;
    order?: "asc" | "desc";
    orderBy?: "count" | "numSuccesses" | "numFailures";
}
