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

// Date range options using discriminated union
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
          startDate: string; // ISO date string: "2024-01-01"
          endDate: string; // ISO date string: "2024-01-31"
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
