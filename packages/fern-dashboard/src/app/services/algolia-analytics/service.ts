/**
 * Algolia Analytics Service
 *
 * Business logic layer for Algolia analytics queries.
 * Wraps AlgoliaAnalyticsClient and provides convenient methods for common queries.
 */
import { AlgoliaAnalyticsClient } from "./client";
import type {
    AlgoliaAnalyticsConfig,
    AnalyticsQueryOptions,
    DateRangeOptions,
    SearchesWithNoResultsResponse,
    SearchMetrics,
    SearchWithNoResults,
    TimeSeriesData,
    TimeSeriesOptions,
    TopSearch,
    TopSearchesByTagOptions,
    TopSearchesResponse
} from "./types";

export class AlgoliaAnalyticsService {
    private readonly client: AlgoliaAnalyticsClient;
    private readonly config: AlgoliaAnalyticsConfig;

    constructor(config: AlgoliaAnalyticsConfig & { appId?: string; apiKey?: string }) {
        this.config = config;
        this.client = new AlgoliaAnalyticsClient({
            appId: config.appId,
            apiKey: config.apiKey,
            indexName: config.indexName
        });
    }

    /**
     * Normalize date range to start/end dates
     */
    private normalizeDateRange(dateRange?: DateRangeOptions): {
        startDate: string;
        endDate: string;
    } {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        if (!dateRange || dateRange.type === "last_n_days") {
            const days = dateRange?.days ?? 7;
            const startDate = new Date(today);
            startDate.setDate(startDate.getDate() - days);
            return {
                startDate: this.formatDate(startDate),
                endDate: this.formatDate(today)
            };
        }

        if (dateRange.type === "last_n_weeks") {
            const days = dateRange.weeks * 7;
            const startDate = new Date(today);
            startDate.setDate(startDate.getDate() - days);
            return {
                startDate: this.formatDate(startDate),
                endDate: this.formatDate(today)
            };
        }

        if (dateRange.type === "last_n_months") {
            const startDate = new Date(today);
            startDate.setMonth(startDate.getMonth() - dateRange.months);
            return {
                startDate: this.formatDate(startDate),
                endDate: this.formatDate(today)
            };
        }

        return {
            startDate: dateRange.startDate,
            endDate: dateRange.endDate
        };
    }

    /**
     * Format date as YYYY-MM-DD for Algolia API
     */
    private formatDate(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    /**
     * Get top searches
     */
    async getTopSearches(options: AnalyticsQueryOptions = {}): Promise<TopSearchesResponse> {
        const { startDate, endDate } = this.normalizeDateRange(options.dateRange);
        const limit = options.limit ?? 50;

        const response = (await this.client.getTopSearches({
            startDate,
            endDate,
            limit,
            tags: options.tags
        })) as {
            searches: { search: string; count: number }[];
            searchesCount: number;
        };

        // Calculate percentages
        const totalSearches = response.searchesCount || 0;
        const searches: TopSearch[] = (response.searches || []).map((s) => ({
            search: s.search,
            count: s.count,
            percentage: totalSearches > 0 ? (s.count / totalSearches) * 100 : 0
        }));

        return {
            searches,
            totalSearches
        };
    }

    /**
     * Get searches with no results
     */
    async getSearchesWithNoResults(options: AnalyticsQueryOptions = {}): Promise<SearchesWithNoResultsResponse> {
        const { startDate, endDate } = this.normalizeDateRange(options.dateRange);
        const limit = options.limit ?? 50;

        const response = (await this.client.getSearchesWithNoResults({
            startDate,
            endDate,
            limit,
            tags: options.tags
        })) as {
            searches: { search: string; count: number }[];
            noResultsCount: number;
        };

        // Calculate percentages
        const totalNoResults = response.noResultsCount || 0;
        const searches: SearchWithNoResults[] = (response.searches || []).map((s) => ({
            search: s.search,
            count: s.count,
            percentage: totalNoResults > 0 ? (s.count / totalNoResults) * 100 : 0
        }));

        return {
            searches,
            totalSearchesWithNoResults: totalNoResults
        };
    }

    /**
     * Get search metrics (count, rates, etc.)
     */
    async getSearchMetrics(options: AnalyticsQueryOptions = {}): Promise<SearchMetrics> {
        const { startDate, endDate } = this.normalizeDateRange(options.dateRange);

        // Fetch all metrics in parallel
        const [countResponse, noResultsRateResponse, clickThroughRateResponse] = await Promise.all([
            this.client.getSearchCount({ startDate, endDate, tags: options.tags }),
            this.client.getNoResultsRate({
                startDate,
                endDate,
                tags: options.tags
            }),
            this.client.getClickThroughRate({
                startDate,
                endDate,
                tags: options.tags
            })
        ]);

        const count = (countResponse as { count: number }).count || 0;
        const noResultsRate = (noResultsRateResponse as { rate: number }).rate || 0;
        const clickThroughRate = (clickThroughRateResponse as { rate: number }).rate || 0;

        return {
            searchCount: count,
            noResultsRate,
            clickThroughRate
        };
    }

    /**
     * Get top searches by specific tag (e.g., by endpoint)
     */
    async getTopSearchesByTag(options: TopSearchesByTagOptions): Promise<TopSearchesResponse> {
        return this.getTopSearches({
            ...options,
            tags: options.tag
        });
    }

    /**
     * Get searches with no results by specific tag
     */
    async getSearchesWithNoResultsByTag(options: TopSearchesByTagOptions): Promise<SearchesWithNoResultsResponse> {
        return this.getSearchesWithNoResults({
            ...options,
            tags: options.tag
        });
    }

    /**
     * Get search count over time (time series)
     */
    async getSearchCountTimeSeries(options: TimeSeriesOptions = {}): Promise<TimeSeriesData[]> {
        const { startDate, endDate } = this.normalizeDateRange(options.dateRange);

        // For time series, we need to make multiple requests for each day/week/month
        // or use a single request and group the data client-side
        const groupBy = options.groupBy || "day";

        // Calculate date range
        const start = new Date(startDate);
        const end = new Date(endDate);
        const timeSeries: TimeSeriesData[] = [];

        // Generate time series data by making requests for each period
        let current = new Date(start);
        while (current <= end) {
            const periodEnd = new Date(current);
            let nextCurrent: Date;

            if (groupBy === "week") {
                periodEnd.setDate(periodEnd.getDate() + 7);
                nextCurrent = new Date(periodEnd);
            } else if (groupBy === "month") {
                periodEnd.setMonth(periodEnd.getMonth() + 1);
                nextCurrent = new Date(periodEnd);
            } else {
                // day
                periodEnd.setDate(periodEnd.getDate() + 1);
                nextCurrent = new Date(periodEnd);
            }

            // Cap periodEnd to the end date for the API request
            const cappedPeriodEnd = periodEnd > end ? end : periodEnd;

            const response = (await this.client.getSearchCount({
                startDate: this.formatDate(current),
                endDate: this.formatDate(cappedPeriodEnd),
                tags: options.tags
            })) as { count: number };

            timeSeries.push({
                date: this.formatDate(current),
                value: response.count || 0
            });

            // Always advance by the full period, not the capped value
            current = nextCurrent;
        }

        return timeSeries;
    }

    /**
     * Get the client configuration
     */
    getConfig(): Readonly<AlgoliaAnalyticsConfig> {
        return { ...this.config };
    }
}
