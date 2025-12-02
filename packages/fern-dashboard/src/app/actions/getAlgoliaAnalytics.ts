"use server";

import { z } from "zod";
import { getAlgoliaAnalyticsService } from "../services/algolia-analytics";
import type { DateRangeOptions } from "../services/algolia-analytics/types";
import { getCurrentSessionOrThrow } from "../services/auth0/getCurrentSession";
import { AsyncRedisCache } from "../services/redis/AsyncRedisCache";
import { RedisCacheKey, RedisCacheKeyType } from "../services/redis/cacheKey";
import { redisDelPattern } from "../services/redis/redis";

// Interface for cache key generation
interface CacheKeyParams {
    dateRange?: DateRangeOptions;
    limit?: number;
    tags?: string;
}

const DEFAULT_DATE_RANGE: DateRangeOptions = {
    type: "last_n_days",
    days: 7
};

// Cache Algolia analytics for 1 hour (3600 seconds)
const ALGOLIA_ANALYTICS_CACHE = new AsyncRedisCache(RedisCacheKeyType.ALGOLIA_ANALYTICS, { ttlInSeconds: 3600 });

// Helper to generate a deterministic cache key from request parameters
function getCacheKey(
    endpoint: string,
    params: CacheKeyParams
): RedisCacheKey<typeof RedisCacheKeyType.ALGOLIA_ANALYTICS> {
    const dateRange = params.dateRange;
    const flatParams: Record<string, unknown> = {
        limit: params.limit,
        tags: params.tags
    };

    // Flatten date range based on its discriminated type
    if (dateRange) {
        flatParams.dateRangeType = dateRange.type;

        if (dateRange.type === "last_n_days") {
            flatParams.dateRangeDays = dateRange.days;
        } else if (dateRange.type === "last_n_weeks") {
            flatParams.dateRangeWeeks = dateRange.weeks;
        } else if (dateRange.type === "last_n_months") {
            flatParams.dateRangeMonths = dateRange.months;
        } else if (dateRange.type === "custom_range") {
            flatParams.dateRangeStartDate = dateRange.startDate;
            flatParams.dateRangeEndDate = dateRange.endDate;
        }
    }

    const sortedParams = JSON.stringify(flatParams, Object.keys(flatParams).sort());
    return RedisCacheKey.algoliaAnalytics(endpoint, sortedParams);
}

// Schema for Algolia analytics request
const GetAlgoliaAnalyticsSchema = z.object({
    dateRange: z
        .union([
            z.object({
                type: z.literal("last_n_days"),
                days: z.number().int().min(1).max(365)
            }),
            z.object({
                type: z.literal("last_n_weeks"),
                weeks: z.number().int().min(1).max(52)
            }),
            z.object({
                type: z.literal("last_n_months"),
                months: z.number().int().min(1).max(24)
            }),
            z.object({
                type: z.literal("custom_range"),
                startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
                endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
            })
        ])
        .optional(),
    limit: z.number().int().min(1).max(500).optional(),
    tags: z.string().optional()
});

export type GetAlgoliaAnalyticsRequest = z.infer<typeof GetAlgoliaAnalyticsSchema>;

export interface SearchMetricsResponse {
    searchCount: number;
    noResultsRate: number;
    clickThroughRate?: number;
    conversionRate?: number;
    dateRange: DateRangeOptions;
}

export interface TopSearch {
    search: string;
    count: number;
    percentage?: number;
}

export interface TopSearchesResponse {
    searches: TopSearch[];
    totalSearches: number;
    dateRange: DateRangeOptions;
}

export interface SearchWithNoResults {
    search: string;
    count: number;
    percentage?: number;
}

export interface SearchesWithNoResultsResponse {
    searches: SearchWithNoResults[];
    totalSearchesWithNoResults: number;
    dateRange: DateRangeOptions;
}

export interface TimeSeriesData {
    date: string;
    value: number;
}

export interface SearchTimeSeriesResponse {
    timeSeries: TimeSeriesData[];
    dateRange: DateRangeOptions;
}

/**
 * Server action to fetch search metrics from Algolia Analytics
 */
export async function getSearchMetrics(request: GetAlgoliaAnalyticsRequest): Promise<SearchMetricsResponse> {
    // Validate input
    const validated = GetAlgoliaAnalyticsSchema.parse(request);

    // Get current session
    const session = await getCurrentSessionOrThrow();
    const userId = session.user.sub;

    // Default date range if not provided
    const dateRange = validated.dateRange || DEFAULT_DATE_RANGE;

    // Generate cache key
    const cacheKey = getCacheKey("searchMetrics", {
        dateRange,
        tags: validated.tags
    });

    // Use cache
    const cachedData = await ALGOLIA_ANALYTICS_CACHE.get(cacheKey, async () => {
        // Initialize Algolia analytics service
        const analytics = getAlgoliaAnalyticsService({
            userId,
            indexName: "fern_docs_search"
        });

        // Fetch metrics from Algolia
        const metrics = await analytics.getSearchMetrics({
            dateRange,
            tags: validated.tags
        });

        return {
            searchCount: metrics.searchCount,
            noResultsRate: metrics.noResultsRate,
            clickThroughRate: metrics.clickThroughRate,
            conversionRate: metrics.conversionRate
        };
    });

    return {
        searchCount: cachedData.searchCount!,
        noResultsRate: cachedData.noResultsRate!,
        clickThroughRate: cachedData.clickThroughRate,
        conversionRate: cachedData.conversionRate,
        dateRange
    };
}

/**
 * Server action to fetch top searches from Algolia Analytics
 */
export async function getTopSearches(request: GetAlgoliaAnalyticsRequest): Promise<TopSearchesResponse> {
    // Validate input
    const validated = GetAlgoliaAnalyticsSchema.parse(request);

    // Get current session
    const session = await getCurrentSessionOrThrow();
    const userId = session.user.sub;

    // Default date range if not provided
    const dateRange = validated.dateRange || DEFAULT_DATE_RANGE;

    // Generate cache key
    const cacheKey = getCacheKey("topSearches", {
        dateRange,
        limit: validated.limit,
        tags: validated.tags
    });

    // Use cache
    const cachedData = await ALGOLIA_ANALYTICS_CACHE.get(cacheKey, async () => {
        // Initialize Algolia analytics service
        const analytics = getAlgoliaAnalyticsService({
            userId,
            indexName: "fern_docs_search"
        });

        // Fetch top searches from Algolia
        const result = await analytics.getTopSearches({
            dateRange,
            limit: validated.limit || 50,
            tags: validated.tags
        });

        return {
            searches: result.searches,
            totalSearches: result.totalSearches
        };
    });

    return {
        searches: cachedData.searches!,
        totalSearches: cachedData.totalSearches!,
        dateRange
    };
}

/**
 * Server action to fetch searches with no results from Algolia Analytics
 */
export async function getSearchesWithNoResults(
    request: GetAlgoliaAnalyticsRequest
): Promise<SearchesWithNoResultsResponse> {
    // Validate input
    const validated = GetAlgoliaAnalyticsSchema.parse(request);

    // Get current session
    const session = await getCurrentSessionOrThrow();
    const userId = session.user.sub;

    // Default date range if not provided
    const dateRange = validated.dateRange || DEFAULT_DATE_RANGE;

    // Generate cache key
    const cacheKey = getCacheKey("searchesWithNoResults", {
        dateRange,
        limit: validated.limit,
        tags: validated.tags
    });

    // Use cache
    const cachedData = await ALGOLIA_ANALYTICS_CACHE.get(cacheKey, async () => {
        // Initialize Algolia analytics service
        const analytics = getAlgoliaAnalyticsService({
            userId,
            indexName: "fern_docs_search"
        });

        // Fetch searches with no results from Algolia
        const result = await analytics.getSearchesWithNoResults({
            dateRange,
            limit: validated.limit || 50,
            tags: validated.tags
        });

        return {
            searches: result.searches,
            totalSearchesWithNoResults: result.totalSearchesWithNoResults
        };
    });

    return {
        searches: cachedData.searches!,
        totalSearchesWithNoResults: cachedData.totalSearchesWithNoResults!,
        dateRange
    };
}

/**
 * Server action to fetch search count time series from Algolia Analytics
 */
export async function getSearchTimeSeries(request: GetAlgoliaAnalyticsRequest): Promise<SearchTimeSeriesResponse> {
    // Validate input
    const validated = GetAlgoliaAnalyticsSchema.parse(request);

    // Get current session
    const session = await getCurrentSessionOrThrow();
    const userId = session.user.sub;

    // Default date range if not provided
    const dateRange = validated.dateRange || DEFAULT_DATE_RANGE;

    // Generate cache key
    const cacheKey = getCacheKey("searchTimeSeries", {
        dateRange,
        tags: validated.tags
    });

    // Use cache
    const cachedData = await ALGOLIA_ANALYTICS_CACHE.get(cacheKey, async () => {
        // Initialize Algolia analytics service
        const analytics = getAlgoliaAnalyticsService({
            userId,
            indexName: "fern_docs_search"
        });

        // Fetch search time series from Algolia
        const timeSeries = await analytics.getSearchCountTimeSeries({
            dateRange,
            groupBy: "day",
            tags: validated.tags
        });

        return { timeSeries };
    });

    return {
        timeSeries: cachedData.timeSeries!,
        dateRange
    };
}

/**
 * Server action to fetch top searches by tag (e.g., by endpoint)
 */
export async function getTopSearchesByTag(
    request: GetAlgoliaAnalyticsRequest & { tag: string }
): Promise<TopSearchesResponse> {
    // Validate input
    const validated = GetAlgoliaAnalyticsSchema.extend({
        tag: z.string().min(1)
    }).parse(request);

    // Get current session
    const session = await getCurrentSessionOrThrow();
    const userId = session.user.sub;

    // Default date range if not provided
    const dateRange = validated.dateRange || DEFAULT_DATE_RANGE;

    // Generate cache key
    const cacheKey = getCacheKey("topSearchesByTag", {
        dateRange,
        limit: validated.limit,
        tags: validated.tag
    });

    // Use cache
    const cachedData = await ALGOLIA_ANALYTICS_CACHE.get(cacheKey, async () => {
        // Initialize Algolia analytics service
        const analytics = getAlgoliaAnalyticsService({
            userId,
            indexName: "fern_docs_search"
        });

        // Fetch top searches by tag from Algolia
        const result = await analytics.getTopSearchesByTag({
            tag: validated.tag,
            dateRange,
            limit: validated.limit || 50
        });

        return {
            searches: result.searches,
            totalSearches: result.totalSearches
        };
    });

    return {
        searches: cachedData.searches!,
        totalSearches: cachedData.totalSearches!,
        dateRange
    };
}

/**
 * Server action to fetch searches with no results by tag
 */
export async function getSearchesWithNoResultsByTag(
    request: GetAlgoliaAnalyticsRequest & { tag: string }
): Promise<SearchesWithNoResultsResponse> {
    // Validate input
    const validated = GetAlgoliaAnalyticsSchema.extend({
        tag: z.string().min(1)
    }).parse(request);

    // Get current session
    const session = await getCurrentSessionOrThrow();
    const userId = session.user.sub;

    // Default date range if not provided
    const dateRange = validated.dateRange || DEFAULT_DATE_RANGE;

    // Generate cache key
    const cacheKey = getCacheKey("searchesWithNoResultsByTag", {
        dateRange,
        limit: validated.limit,
        tags: validated.tag
    });

    // Use cache
    const cachedData = await ALGOLIA_ANALYTICS_CACHE.get(cacheKey, async () => {
        // Initialize Algolia analytics service
        const analytics = getAlgoliaAnalyticsService({
            userId,
            indexName: "fern_docs_search"
        });

        // Fetch searches with no results by tag from Algolia
        const result = await analytics.getSearchesWithNoResultsByTag({
            tag: validated.tag,
            dateRange,
            limit: validated.limit || 50
        });

        return {
            searches: result.searches,
            totalSearchesWithNoResults: result.totalSearchesWithNoResults
        };
    });

    return {
        searches: cachedData.searches!,
        totalSearchesWithNoResults: cachedData.totalSearchesWithNoResults!,
        dateRange
    };
}

/**
 * Server action to clear all Algolia analytics cache
 * This invalidates all cached analytics data, forcing fresh fetches from Algolia
 */
export async function clearAlgoliaAnalyticsCache(): Promise<{ success: boolean }> {
    // Verify user is authenticated
    await getCurrentSessionOrThrow();

    // Clear all Algolia analytics cache keys by pattern
    await redisDelPattern("algolia-analytics-*");

    return { success: true };
}
