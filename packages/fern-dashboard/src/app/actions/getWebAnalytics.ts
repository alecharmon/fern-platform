"use server";

import { fernToken_admin } from "@fern-api/docs-server";
import { z } from "zod";

import type { AnalyticsField, AnalyticsSortDir } from "@/components/web-analytics/constants";

import { getDocsUrlMetadata } from "../api/utils/getDocsUrlMetadata";
import { getCurrentSessionOrThrow } from "../services/auth0/getCurrentSession";
import getDocsSitesForOrg from "../services/dal/fdr/getDocsSitesForOrg";
import { getAnalyticsService } from "../services/posthog";
import type { DateRangeOptions } from "../services/posthog/types";
import { AsyncRedisCache } from "../services/redis/AsyncRedisCache";
import { RedisCacheKey, RedisCacheKeyType } from "../services/redis/cacheKey";
import { redisDelPattern } from "../services/redis/redis";

// Interface for cache key generation - uses flattened structure
interface CacheKeyParams {
    dateRange?: DateRangeOptions;
    includeInternal?: boolean;
    groupBy?: number;
    limit?: number;
    orderBy?: string;
    order?: string;
}

const DEFAULT_DATE_RANGE: DateRangeOptions = {
    type: "last_n_days",
    days: 7
};

// Cache web analytics for 1 hour (3600 seconds)
const WEB_ANALYTICS_CACHE = new AsyncRedisCache(RedisCacheKeyType.WEB_ANALYTICS, { ttlInSeconds: 3600 });

const VERIFY_ACCESS_CACHE = new AsyncRedisCache(RedisCacheKeyType.WEB_ANALYTICS, {
    ttlInSeconds: 600
});

// Helper to generate a deterministic cache key from request parameters
function getCacheKey(endpoint: string, domain: string, params: CacheKeyParams): string {
    const dateRange = params.dateRange;
    const flatParams: Record<string, unknown> = {
        includeInternal: params.includeInternal,
        groupBy: params.groupBy,
        limit: params.limit,
        orderBy: params.orderBy,
        order: params.order
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
    return RedisCacheKey.webAnalytics(endpoint, domain, sortedParams);
}

// Schema for web analytics request
const GetWebAnalyticsSchema = z.object({
    docsUrl: z.string(), // Accept any string, we'll decode and validate later
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
    includeInternal: z.boolean().optional(),
    groupBy: z.number().optional() // Number of days to group by (7 for weekly, 30 for monthly)
});

// Extended schema for table requests with sorting parameters
const TableRequestSchema = GetWebAnalyticsSchema.extend({
    limit: z.number().int().min(1).max(100).optional(),
    orderBy: z.enum(["visitors", "views"]).optional(),
    order: z.enum(["asc", "desc"]).optional()
});

// Extended schema for LLM file views requests with specific sorting parameters
const LLMFileViewsRequestSchema = GetWebAnalyticsSchema.extend({
    limit: z.number().int().min(1).max(100).optional(),
    orderBy: z.enum(["agentViews", "humanViews", "totalViews"]).optional(),
    order: z.enum(["asc", "desc"]).optional()
});

export type GetWebAnalyticsRequest = z.infer<typeof GetWebAnalyticsSchema>;

export interface WebAnalyticsMetrics {
    visitors: number;
    pageViews: number;
    sessions: number;
}

export interface GetWebAnalyticsResponse {
    metrics: WebAnalyticsMetrics;
    baseSiteUrl: string;
    dateRange: DateRangeOptions;
}

export interface TableRequest extends GetWebAnalyticsRequest {
    limit?: number;
    orderBy?: AnalyticsField;
    order?: AnalyticsSortDir;
}

export type LLMFileViewsRequest = z.infer<typeof LLMFileViewsRequestSchema>;

function getBaseDomain(rawUrl: string) {
    const decodedUrl = decodeURIComponent(rawUrl);
    let baseDomain: string;
    try {
        const url = new URL(decodedUrl.startsWith("http") ? decodedUrl : `https://${decodedUrl}`);
        baseDomain = url.hostname;
    } catch {
        // If URL parsing fails, assume it's already just a domain
        baseDomain = decodedUrl.split("/")[0] ?? "";
    }

    if (!baseDomain) {
        throw new Error("Invalid docs URL");
    }

    return baseDomain;
}

async function verifyDomainAccessAndGetSite(url: string) {
    const session = await getCurrentSessionOrThrow();
    const userId = session.user.sub;

    // Decode the URL (handles %2F -> /)
    const decodedUrl = decodeURIComponent(url);
    const baseDomain = getBaseDomain(decodedUrl);

    const cacheKeyParams = JSON.stringify({
        userId
    });
    const cacheKey = RedisCacheKey.webAnalytics("verify-access", baseDomain, cacheKeyParams);

    const cachedResult = await VERIFY_ACCESS_CACHE.get(cacheKey, async () => {
        const docsMetadata = await getDocsUrlMetadata({
            url: decodedUrl,
            token: fernToken_admin() ?? session.accessToken
        });

        // Get all organizations the user has access to
        if (!docsMetadata.ok || !docsMetadata.body.org) {
            throw new Error(`Invalid docs URL`);
        }

        // Verify user has access to this org's docs
        const orgSites = await getDocsSitesForOrg({
            token: session.accessToken,

            // @ts-expect-error - OrgId vs Auth0OrgName type mismatch
            orgName: docsMetadata.body.org
        });
        if (!orgSites.ok) {
            throw new Error("Failed to fetch organization sites");
        }
        const docsSite = orgSites.docsSites.find((site) => site.urls.some((siteUrl) => siteUrl.domain === baseDomain));

        if (!docsSite) {
            throw new Error("You don't have access to analytics for this docs site");
        }

        return { docsSite };
    });

    return cachedResult.docsSite!;
}

/**
 * Server action to fetch web analytics from PostHog
 * This is different from getDomainAnalytics which uses FAI
 */
export async function getWebAnalytics(request: GetWebAnalyticsRequest): Promise<GetWebAnalyticsResponse> {
    // Validate input
    const validated = GetWebAnalyticsSchema.parse(request);

    const docsSite = await verifyDomainAccessAndGetSite(validated.docsUrl);

    // Get current session
    const session = await getCurrentSessionOrThrow();
    const userId = session.user.sub;
    // Default date range if not provided
    const dateRange = validated.dateRange || DEFAULT_DATE_RANGE;

    const baseDomain = getBaseDomain(validated.docsUrl);

    const allDomains = docsSite.urls.map((url) => url.domain);
    const additionalDomains = allDomains.filter((domain) => domain !== baseDomain);

    // Generate cache key using all domains
    const cacheKey = getCacheKey("metrics", allDomains.sort().join(","), {
        dateRange,
        includeInternal: validated.includeInternal,
        groupBy: validated.groupBy
    });

    // Use cache
    const cachedData = await WEB_ANALYTICS_CACHE.get(cacheKey, async () => {
        // Initialize PostHog analytics service with all domains
        const analytics = getAnalyticsService({
            userId,
            baseSiteUrl: baseDomain,
            additionalDomains
        });

        // Fetch metrics from PostHog (now includes all domains)
        const metrics = await analytics.getMetrics({
            dateRange,
            includeInternal: validated.includeInternal
        });

        return {
            metrics: {
                visitors: metrics.visitors,
                pageViews: metrics.pageViews,
                sessions: metrics.sessions
            }
        };
    });

    return {
        metrics: cachedData.metrics!,
        baseSiteUrl: baseDomain,
        dateRange
    };
}

/**
 * Server action to fetch page views by day from PostHog
 */
export async function getPageViewsByDay(
    request: GetWebAnalyticsRequest
): Promise<{ timeSeries: { date: string; value: number }[] }> {
    // Validate input
    const validated = GetWebAnalyticsSchema.parse(request);

    const docsSite = await verifyDomainAccessAndGetSite(validated.docsUrl);

    // Get current session
    const session = await getCurrentSessionOrThrow();
    const userId = session.user.sub;
    // Default date range if not provided
    const dateRange = validated.dateRange || DEFAULT_DATE_RANGE;

    const baseDomain = getBaseDomain(validated.docsUrl);

    const allDomains = docsSite.urls.map((url) => url.domain);
    const additionalDomains = allDomains.filter((domain) => domain !== baseDomain);

    // Generate cache key
    const cacheKey = getCacheKey("pageViewsByDay", allDomains.sort().join(","), {
        dateRange,
        includeInternal: validated.includeInternal,
        groupBy: validated.groupBy
    });

    // Use cache
    const cachedData = await WEB_ANALYTICS_CACHE.get(cacheKey, async () => {
        // Initialize PostHog analytics service
        const analytics = getAnalyticsService({
            userId,
            baseSiteUrl: baseDomain,
            additionalDomains
        });

        // Fetch page views time series from PostHog
        const timeSeries = await analytics.getPageViewsTimeSeries({
            dateRange,
            includeInternal: validated.includeInternal,
            groupBy: validated.groupBy
        });

        return { timeSeries };
    });

    return { timeSeries: cachedData.timeSeries! };
}

/**
 * Server action to fetch visitors by day from PostHog
 */
export async function getVisitorsByDay(
    request: GetWebAnalyticsRequest
): Promise<{ timeSeries: { date: string; value: number }[] }> {
    // Validate input
    const validated = GetWebAnalyticsSchema.parse(request);

    const docsSite = await verifyDomainAccessAndGetSite(validated.docsUrl);

    // Get current session
    const session = await getCurrentSessionOrThrow();
    const userId = session.user.sub;

    // Default date range if not provided
    const dateRange = validated.dateRange || DEFAULT_DATE_RANGE;

    const baseDomain = getBaseDomain(validated.docsUrl);

    const allDomains = docsSite.urls.map((url) => url.domain);
    const additionalDomains = allDomains.filter((domain) => domain !== baseDomain);

    // Generate cache key
    const cacheKey = getCacheKey("visitorsByDay", allDomains.sort().join(","), {
        dateRange,
        includeInternal: validated.includeInternal,
        groupBy: validated.groupBy
    });

    // Use cache
    const cachedData = await WEB_ANALYTICS_CACHE.get(cacheKey, async () => {
        // Initialize PostHog analytics service
        const analytics = getAnalyticsService({
            userId,
            baseSiteUrl: baseDomain,
            additionalDomains
        });

        // Fetch visitors time series from PostHog
        const timeSeries = await analytics.getVisitorsTimeSeries({
            dateRange,
            includeInternal: validated.includeInternal,
            groupBy: validated.groupBy
        });

        return { timeSeries };
    });

    return { timeSeries: cachedData.timeSeries! };
}

/**
 * Server action to fetch top pages from PostHog
 */
export async function getTopPages(
    request: TableRequest
): Promise<{ topPages: { path: string; visitors: number; views: number }[] }> {
    // Validate input
    const validated = TableRequestSchema.parse(request);

    const docsSite = await verifyDomainAccessAndGetSite(validated.docsUrl);

    // Get current session
    const session = await getCurrentSessionOrThrow();
    const userId = session.user.sub;

    // Default date range if not provided
    const dateRange = validated.dateRange || DEFAULT_DATE_RANGE;

    const baseDomain = getBaseDomain(validated.docsUrl);

    const allDomains = docsSite.urls.map((url) => url.domain);
    const additionalDomains = allDomains.filter((domain) => domain !== baseDomain);

    // Generate cache key
    const cacheKey = getCacheKey("topPages", allDomains.sort().join(","), {
        dateRange,
        includeInternal: validated.includeInternal,
        groupBy: validated.groupBy,
        limit: validated.limit,
        orderBy: validated.orderBy,
        order: validated.order
    });

    // Use cache
    const cachedData = await WEB_ANALYTICS_CACHE.get(cacheKey, async () => {
        // Initialize PostHog analytics service
        const analytics = getAnalyticsService({
            userId,
            baseSiteUrl: baseDomain,
            additionalDomains
        });

        // Fetch top pages from PostHog
        const topPages = await analytics.getTopPages({
            dateRange,
            includeInternal: validated.includeInternal,
            groupBy: validated.groupBy,
            limit: validated.limit || 10,
            orderBy: validated.orderBy || "views",
            order: validated.order || "desc"
        });

        return { topPages };
    });

    return { topPages: cachedData.topPages! };
}

/**
 * Server action to fetch top countries from PostHog
 */
export async function getTopCountries(request: TableRequest): Promise<{
    topCountries: { country: string; visitors: number; views: number }[];
}> {
    // Validate input
    const validated = TableRequestSchema.parse(request);

    const docsSite = await verifyDomainAccessAndGetSite(validated.docsUrl);

    // Get current session
    const session = await getCurrentSessionOrThrow();
    const userId = session.user.sub;
    // Default date range if not provided
    const dateRange = validated.dateRange || DEFAULT_DATE_RANGE;

    const baseDomain = getBaseDomain(validated.docsUrl);

    const allDomains = docsSite.urls.map((url) => url.domain);
    const additionalDomains = allDomains.filter((domain) => domain !== baseDomain);

    // Generate cache key
    const cacheKey = getCacheKey("topCountries", allDomains.sort().join(","), {
        dateRange,
        includeInternal: validated.includeInternal,
        groupBy: validated.groupBy,
        limit: validated.limit,
        orderBy: validated.orderBy,
        order: validated.order
    });

    // Use cache
    const cachedData = await WEB_ANALYTICS_CACHE.get(cacheKey, async () => {
        // Initialize PostHog analytics service
        const analytics = getAnalyticsService({
            userId,
            baseSiteUrl: baseDomain,
            additionalDomains
        });

        // Fetch top countries from PostHog
        const topCountries = await analytics.getTopCountries({
            dateRange,
            includeInternal: validated.includeInternal,
            groupBy: validated.groupBy,
            limit: validated.limit || 10,
            orderBy: validated.orderBy || "visitors",
            order: validated.order || "desc"
        });

        return { topCountries };
    });

    return { topCountries: cachedData.topCountries! };
}

/**
 * Server action to fetch LLM file views (llms.txt, llms-full.txt, .md files) from PostHog
 */
export async function getLLMFileViews(request: LLMFileViewsRequest): Promise<{
    llmFileViews: { path: string; agentViews: number; humanViews: number }[];
}> {
    // Validate input
    const validated = LLMFileViewsRequestSchema.parse(request);

    const docsSite = await verifyDomainAccessAndGetSite(validated.docsUrl);

    // Get current session
    const session = await getCurrentSessionOrThrow();
    const userId = session.user.sub;

    // Default date range if not provided
    const dateRange = validated.dateRange || DEFAULT_DATE_RANGE;

    const baseDomain = getBaseDomain(validated.docsUrl);

    const allDomains = docsSite.urls.map((url) => url.domain);
    const additionalDomains = allDomains.filter((domain) => domain !== baseDomain);

    // Generate cache key
    const cacheKey = getCacheKey("llmFileViews", allDomains.sort().join(","), {
        dateRange,
        includeInternal: validated.includeInternal,
        groupBy: validated.groupBy,
        limit: validated.limit,
        orderBy: validated.orderBy,
        order: validated.order
    });

    // Use cache
    const cachedData = await WEB_ANALYTICS_CACHE.get(cacheKey, async () => {
        // Initialize PostHog analytics service
        const analytics = getAnalyticsService({
            userId,
            baseSiteUrl: baseDomain,
            additionalDomains
        });

        // Fetch LLM file views from PostHog
        const llmFileViews = await analytics.getLLMFileViews({
            dateRange,
            includeInternal: validated.includeInternal,
            groupBy: validated.groupBy,
            limit: validated.limit || 20,
            orderBy: validated.orderBy || "humanViews",
            order: validated.order || "desc"
        });

        return { llmFileViews };
    });

    return { llmFileViews: cachedData.llmFileViews! };
}

/**
 * Server action to fetch channel data from PostHog
 */
export async function getChannels(request: TableRequest): Promise<{
    channels: { channel: string; visitors: number; views: number }[];
}> {
    // Validate input
    const validated = TableRequestSchema.parse(request);

    const docsSite = await verifyDomainAccessAndGetSite(validated.docsUrl);

    // Get current session
    const session = await getCurrentSessionOrThrow();
    const userId = session.user.sub;

    // Default date range if not provided
    const dateRange = validated.dateRange || DEFAULT_DATE_RANGE;

    const baseDomain = getBaseDomain(validated.docsUrl);

    const allDomains = docsSite.urls.map((url) => url.domain);
    const additionalDomains = allDomains.filter((domain) => domain !== baseDomain);

    // Generate cache key
    const cacheKey = getCacheKey("channels", allDomains.sort().join(","), {
        dateRange,
        includeInternal: validated.includeInternal,
        groupBy: validated.groupBy,
        limit: validated.limit,
        orderBy: validated.orderBy,
        order: validated.order
    });

    // Use cache
    const cachedData = await WEB_ANALYTICS_CACHE.get(cacheKey, async () => {
        // Initialize PostHog analytics service
        const analytics = getAnalyticsService({
            userId,
            baseSiteUrl: baseDomain,
            additionalDomains
        });

        // Fetch channels from PostHog
        const channels = await analytics.getChannels({
            dateRange,
            includeInternal: validated.includeInternal,
            groupBy: validated.groupBy,
            limit: validated.limit || 20,
            orderBy: validated.orderBy || "visitors",
            order: validated.order || "desc"
        });

        return { channels };
    });

    return { channels: cachedData.channels! };
}

/**
 * Server action to fetch device type data from PostHog
 */
export async function getDeviceTypes(request: TableRequest): Promise<{
    deviceTypes: { deviceType: string; visitors: number; views: number }[];
}> {
    // Validate input
    const validated = TableRequestSchema.parse(request);

    const docsSite = await verifyDomainAccessAndGetSite(validated.docsUrl);

    // Get current session
    const session = await getCurrentSessionOrThrow();
    const userId = session.user.sub;

    // Default date range if not provided
    const dateRange = validated.dateRange || DEFAULT_DATE_RANGE;

    const baseDomain = getBaseDomain(validated.docsUrl);

    const allDomains = docsSite.urls.map((url) => url.domain);
    const additionalDomains = allDomains.filter((domain) => domain !== baseDomain);

    // Generate cache key
    const cacheKey = getCacheKey("deviceTypes", allDomains.sort().join(","), {
        dateRange,
        includeInternal: validated.includeInternal,
        groupBy: validated.groupBy,
        limit: validated.limit,
        orderBy: validated.orderBy,
        order: validated.order
    });

    // Use cache
    const cachedData = await WEB_ANALYTICS_CACHE.get(cacheKey, async () => {
        // Initialize PostHog analytics service
        const analytics = getAnalyticsService({
            userId,
            baseSiteUrl: baseDomain,
            additionalDomains
        });

        // Fetch device types from PostHog
        const deviceTypes = await analytics.getDeviceTypes({
            dateRange,
            includeInternal: validated.includeInternal,
            groupBy: validated.groupBy,
            limit: validated.limit || 10,
            orderBy: validated.orderBy || "visitors",
            order: validated.order || "desc"
        });

        return { deviceTypes };
    });

    return { deviceTypes: cachedData.deviceTypes! };
}

/**
 * Server action to fetch referring domains from PostHog
 */
export async function getReferringDomains(request: TableRequest): Promise<{
    referringDomains: { domain: string; visitors: number; views: number }[];
}> {
    // Validate input
    const validated = TableRequestSchema.parse(request);

    const docsSite = await verifyDomainAccessAndGetSite(validated.docsUrl);

    // Get current session
    const session = await getCurrentSessionOrThrow();
    const userId = session.user.sub;

    // Default date range if not provided
    const dateRange = validated.dateRange || DEFAULT_DATE_RANGE;

    const baseDomain = getBaseDomain(validated.docsUrl);

    const allDomains = docsSite.urls.map((url) => url.domain);
    const additionalDomains = allDomains.filter((domain) => domain !== baseDomain);

    // Generate cache key
    const cacheKey = getCacheKey("referringDomains", allDomains.sort().join(","), {
        dateRange,
        includeInternal: validated.includeInternal,
        groupBy: validated.groupBy,
        limit: validated.limit,
        orderBy: validated.orderBy,
        order: validated.order
    });

    // Use cache
    const cachedData = await WEB_ANALYTICS_CACHE.get(cacheKey, async () => {
        // Initialize PostHog analytics service
        const analytics = getAnalyticsService({
            userId,
            baseSiteUrl: baseDomain,
            additionalDomains
        });

        // Fetch referring domains from PostHog
        const referringDomains = await analytics.getReferringDomains({
            dateRange,
            includeInternal: validated.includeInternal,
            groupBy: validated.groupBy,
            limit: validated.limit || 10,
            orderBy: validated.orderBy || "visitors",
            order: validated.order || "desc"
        });

        return { referringDomains };
    });

    return { referringDomains: cachedData.referringDomains! };
}

/**
 * Server action to fetch 404 pages from PostHog
 */
export async function get404Pages(request: TableRequest): Promise<{ pages404: { path: string; count: number }[] }> {
    // Validate input
    const validated = TableRequestSchema.parse(request);

    const docsSite = await verifyDomainAccessAndGetSite(validated.docsUrl);

    // Get current session
    const session = await getCurrentSessionOrThrow();
    const userId = session.user.sub;

    // Default date range if not provided
    const dateRange = validated.dateRange || DEFAULT_DATE_RANGE;

    const baseDomain = getBaseDomain(validated.docsUrl);

    const allDomains = docsSite.urls.map((url) => url.domain);
    const additionalDomains = allDomains.filter((domain) => domain !== baseDomain);

    // Generate cache key
    const cacheKey = getCacheKey("404Pages", allDomains.sort().join(","), {
        dateRange,
        includeInternal: validated.includeInternal,
        groupBy: validated.groupBy,
        limit: validated.limit,
        order: validated.order
    });

    // Use cache
    const cachedData = await WEB_ANALYTICS_CACHE.get(cacheKey, async () => {
        // Initialize PostHog analytics service
        const analytics = getAnalyticsService({
            userId,
            baseSiteUrl: baseDomain,
            additionalDomains
        });

        // Fetch 404 pages from PostHog
        const pages404 = await analytics.get404Pages({
            dateRange,
            includeInternal: validated.includeInternal,
            groupBy: validated.groupBy,
            limit: validated.limit || 20,
            order: validated.order || "desc"
        });

        return { pages404 };
    });

    return { pages404: cachedData.pages404! };
}

/**
 * Server action to fetch API Explorer requests from PostHog
 */
export async function getAPIExplorerRequests(request: TableRequest): Promise<{
    apiExplorerRequests: {
        host: string;
        method: string;
        endpoint: string;
        name: string;
        count: number;
    }[];
}> {
    // Validate input
    const validated = TableRequestSchema.parse(request);

    const docsSite = await verifyDomainAccessAndGetSite(validated.docsUrl);

    // Get current session
    const session = await getCurrentSessionOrThrow();
    const userId = session.user.sub;

    // Default date range if not provided
    const dateRange = validated.dateRange || DEFAULT_DATE_RANGE;

    const baseDomain = getBaseDomain(validated.docsUrl);

    const allDomains = docsSite.urls.map((url) => url.domain);
    const additionalDomains = allDomains.filter((domain) => domain !== baseDomain);

    // Generate cache key
    const cacheKey = getCacheKey("apiExplorerRequests", allDomains.sort().join(","), {
        dateRange,
        includeInternal: validated.includeInternal,
        groupBy: validated.groupBy,
        limit: validated.limit,
        order: validated.order
    });

    // Use cache
    const cachedData = await WEB_ANALYTICS_CACHE.get(cacheKey, async () => {
        // Initialize PostHog analytics service
        const analytics = getAnalyticsService({
            userId,
            baseSiteUrl: baseDomain,
            additionalDomains
        });

        // Fetch API Explorer requests from PostHog
        const apiExplorerRequests = await analytics.getAPIExplorerRequests({
            dateRange,
            limit: validated.limit || 20,
            order: validated.order || "desc"
        });

        return { apiExplorerRequests };
    });

    return { apiExplorerRequests: cachedData.apiExplorerRequests! };
}

/**
 * Server action to clear all web analytics cache for a specific domain
 * This invalidates all cached analytics data, forcing fresh fetches from PostHog
 */
export async function clearWebAnalyticsCache(docsUrl: string): Promise<{ success: boolean }> {
    const docsSite = await verifyDomainAccessAndGetSite(docsUrl);

    const allDomains = docsSite.urls.map((url) => url.domain);

    for (const domain of allDomains) {
        await redisDelPattern(`web-analytics-*-${domain}-*`);

        const verifyAccessPattern = RedisCacheKey.webAnalytics("verify-access", domain, "*");
        await redisDelPattern(verifyAccessPattern);
    }

    await redisDelPattern(`web-analytics-*-${allDomains.sort().join(",")}-*`);

    return { success: true };
}

/**
 * Server action to fetch LLM bot traffic by provider from PostHog
 */
export async function getLLMBotTrafficByProvider(request: TableRequest): Promise<{
    providers: { provider: string; count: number }[];
}> {
    const validated = TableRequestSchema.parse(request);

    const docsSite = await verifyDomainAccessAndGetSite(validated.docsUrl);

    const session = await getCurrentSessionOrThrow();
    const userId = session.user.sub;

    const dateRange = validated.dateRange || DEFAULT_DATE_RANGE;
    const baseDomain = getBaseDomain(validated.docsUrl);

    const allDomains = docsSite.urls.map((url) => url.domain);
    const additionalDomains = allDomains.filter((domain) => domain !== baseDomain);

    const cacheKey = getCacheKey("llmBotProviders", allDomains.sort().join(","), {
        dateRange,
        includeInternal: validated.includeInternal,
        groupBy: validated.groupBy,
        limit: validated.limit,
        order: validated.order
    });

    const cachedData = await WEB_ANALYTICS_CACHE.get(cacheKey, async () => {
        const analytics = getAnalyticsService({
            userId,
            baseSiteUrl: baseDomain,
            additionalDomains
        });

        const providers = await analytics.getLLMBotTrafficByProvider({
            dateRange,
            includeInternal: validated.includeInternal,
            groupBy: validated.groupBy,
            limit: validated.limit || 20,
            order: validated.order || "desc"
        });

        return { providers };
    });

    return { providers: cachedData.providers! };
}
