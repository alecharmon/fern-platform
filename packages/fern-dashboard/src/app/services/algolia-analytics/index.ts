/**
 * Algolia Analytics Services
 *
 * This module provides a clean separation between HTTP client and business logic:
 * - AlgoliaAnalyticsClient: Pure HTTP/query execution layer
 * - AlgoliaAnalyticsService: Business logic for specific analytics queries
 */
import { AlgoliaAnalyticsService } from "./service";

/**
 * Convenience function to create Algolia analytics service
 */
export function getAlgoliaAnalyticsService(config: {
    userId: string;
    indexName: string;
    appId?: string;
    apiKey?: string;
}) {
    return new AlgoliaAnalyticsService(config);
}

// Alias for consistency
export { getAlgoliaAnalyticsService as createAlgoliaAnalyticsService };

// Re-export types
export type {
    AlgoliaAnalyticsConfig,
    AlgoliaClientConfig,
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
