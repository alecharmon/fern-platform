"use server";

import { z } from "zod";

import type { AnalyticsField, AnalyticsSortDir } from "@/components/web-analytics/constants";

import { insertAnalyticsForSite } from "../services/analytics/cron/insert";
import type { DateRangePeriod } from "../services/analytics/cron/types";
import { getCurrentSessionOrThrow } from "../services/auth0/getCurrentSession";
import { getAnalyticsService } from "../services/posthog";
import { type CachedAnalytics, getCachedAnalytics } from "../services/posthog/cache";
import type { DateRangeOptions } from "../services/posthog/types";

const DEFAULT_DATE_RANGE: DateRangeOptions = {
    type: "last_n_days",
    days: 7
};

const SUPABASE_CACHEABLE_PERIODS: DateRangePeriod[] = [7, 14, 30, 90, 180];

function getSupabaseCachePeriod(dateRange: DateRangeOptions): DateRangePeriod | null {
    if (dateRange.type === "last_n_days" && SUPABASE_CACHEABLE_PERIODS.includes(dateRange.days as DateRangePeriod)) {
        return dateRange.days as DateRangePeriod;
    }
    return null;
}

function getDocsSiteKey(docsUrl: string): string {
    const decodedUrl = decodeURIComponent(docsUrl);
    try {
        const url = new URL(decodedUrl.startsWith("http") ? decodedUrl : `https://${decodedUrl}`);
        return url.hostname;
    } catch {
        return decodedUrl.split("/")[0] ?? decodedUrl;
    }
}

const GetWebAnalyticsSchema = z.object({
    docsUrl: z.string(),
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
    groupBy: z.number().optional(),
    selectedDomain: z.string().optional()
});

const TableRequestSchema = GetWebAnalyticsSchema.extend({
    limit: z.number().int().min(1).max(100).optional(),
    orderBy: z.enum(["visitors", "views", "count", "numSuccesses", "numFailures"]).optional(),
    order: z.enum(["asc", "desc"]).optional()
});

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

/**
 * Unified response containing all analytics data
 * Single fetch instead of 9+ separate requests
 */
export interface AllAnalyticsResponse {
    metrics: WebAnalyticsMetrics;
    topPages: { path: string; visitors: number; views: number }[];
    topCountries: { country: string; visitors: number; views: number }[];
    channels: { channel: string; visitors: number; views: number }[];
    deviceTypes: { deviceType: string; visitors: number; views: number }[];
    referringDomains: { domain: string; visitors: number; views: number }[];
    llmFileViews: { path: string; agentViews: number; humanViews: number }[];
    apiExplorerRequests: {
        method: string;
        endpoint: string;
        name: string;
        count: number;
        numSuccesses: number;
        numFailures: number;
    }[];
    llmBotTraffic: { provider: string; count: number }[];
    pages404: { path: string; count: number }[];
    pageViewsTimeSeries: { date: string; value: number }[];
    visitorsTimeSeries: { date: string; value: number }[];
    baseSiteUrl: string;
    dateRange: DateRangeOptions;
    cacheHit: boolean;
}

function getBaseDomain(rawUrl: string) {
    const decodedUrl = decodeURIComponent(rawUrl);
    let baseDomain: string;
    try {
        const url = new URL(decodedUrl.startsWith("http") ? decodedUrl : `https://${decodedUrl}`);
        baseDomain = url.hostname;
    } catch {
        baseDomain = decodedUrl.split("/")[0] ?? "";
    }

    if (!baseDomain) {
        throw new Error("Invalid docs URL");
    }

    return baseDomain;
}

class AnalyticsQueryHandler {
    private supabaseCache: CachedAnalytics | null | undefined = undefined;
    private docsUrl: string;
    private dateRange: DateRangeOptions;
    private selectedDomain: string | undefined;

    constructor(docsUrl: string, dateRange: DateRangeOptions, selectedDomain?: string) {
        this.docsUrl = docsUrl;
        this.dateRange = dateRange;
        this.selectedDomain = selectedDomain;
    }

    async getSupabaseCache(): Promise<CachedAnalytics | null> {
        if (this.supabaseCache !== undefined) {
            return this.supabaseCache;
        }

        const period = getSupabaseCachePeriod(this.dateRange);
        if (!period) {
            this.supabaseCache = null;
            return null;
        }

        // Use selectedDomain if provided, otherwise extract from docsUrl
        const docsSiteKey = this.selectedDomain || getDocsSiteKey(this.docsUrl);
        const startTime = Date.now();
        this.supabaseCache = await getCachedAnalytics({
            docsSite: docsSiteKey,
            period
        });
        const endTime = Date.now();
        console.log("getCachedAnalytics", {
            docsSiteKey,
            period,
            found: !!this.supabaseCache,
            duration: endTime - startTime
        });
        return this.supabaseCache;
    }
}

const handlerCache = new Map<string, AnalyticsQueryHandler>();

function getHandler(docsUrl: string, dateRange: DateRangeOptions, selectedDomain?: string): AnalyticsQueryHandler {
    const key = `${docsUrl}:${JSON.stringify(dateRange)}:${selectedDomain || ""}`;
    let handler = handlerCache.get(key);
    if (!handler) {
        handler = new AnalyticsQueryHandler(docsUrl, dateRange, selectedDomain);
        handlerCache.set(key, handler);
        setTimeout(() => handlerCache.delete(key), 60000);
    }
    return handler;
}

async function getLiveAnalytics(docsUrl: string) {
    const session = await getCurrentSessionOrThrow();
    const userId = session.user.sub;
    const baseDomain = getBaseDomain(docsUrl);

    return {
        userId,
        baseDomain,
        getAnalytics: () =>
            getAnalyticsService({
                userId,
                baseSiteUrl: baseDomain
                // NOT including additionalDomains - each domain tracked separately
            })
    };
}

export async function getWebAnalytics(request: GetWebAnalyticsRequest): Promise<GetWebAnalyticsResponse> {
    const validated = GetWebAnalyticsSchema.parse(request);
    const dateRange = validated.dateRange || DEFAULT_DATE_RANGE;
    // Use selectedDomain if provided, otherwise extract from docsUrl
    const baseDomain = validated.selectedDomain || getBaseDomain(validated.docsUrl);

    const handler = getHandler(validated.docsUrl, dateRange, validated.selectedDomain);
    const supabaseCache = await handler.getSupabaseCache();

    if (supabaseCache) {
        console.log(`Using Supabase cache for ${validated.docsUrl} ${JSON.stringify(dateRange)}`);
        return {
            metrics: {
                visitors: supabaseCache.totalVisitors,
                pageViews: supabaseCache.totalViews,
                sessions: 0
            },
            baseSiteUrl: supabaseCache.docsSite,
            dateRange
        };
    }

    console.log(`Getting live analytics from PostHog`);

    const live = await getLiveAnalytics(validated.docsUrl);
    const analytics = live.getAnalytics();
    const metrics = await analytics.getMetrics({
        dateRange,
        includeInternal: validated.includeInternal
    });

    return {
        metrics: {
            visitors: metrics.visitors,
            pageViews: metrics.pageViews,
            sessions: metrics.sessions
        },
        baseSiteUrl: baseDomain,
        dateRange
    };
}

/**
 * Unified server action that fetches ALL analytics data in a single request
 * This replaces making 9+ separate HTTP requests
 */
export async function getAllAnalytics(request: GetWebAnalyticsRequest): Promise<AllAnalyticsResponse> {
    const validated = GetWebAnalyticsSchema.parse(request);
    const dateRange = validated.dateRange || DEFAULT_DATE_RANGE;
    // Use selectedDomain if provided, otherwise extract from docsUrl
    const baseDomain = validated.selectedDomain || getBaseDomain(validated.docsUrl);

    const handler = getHandler(validated.docsUrl, dateRange, validated.selectedDomain);
    const supabaseCache = await handler.getSupabaseCache();

    if (supabaseCache && !validated.groupBy) {
        console.log(`Using Supabase cache for ALL analytics data`, {
            docsSite: supabaseCache.docsSite,
            totalVisitors: supabaseCache.totalVisitors,
            totalViews: supabaseCache.totalViews,
            numPaths: supabaseCache.topPaths?.length || 0,
            numCountries: supabaseCache.topCountries?.length || 0,
            numChannels: supabaseCache.topChannels?.length || 0,
            numDeviceTypes: supabaseCache.topDeviceTypes?.length || 0
        });
        return {
            metrics: {
                visitors: supabaseCache.totalVisitors,
                pageViews: supabaseCache.totalViews,
                sessions: 0
            },
            topPages: supabaseCache.topPaths,
            topCountries: supabaseCache.topCountries,
            channels: supabaseCache.topChannels,
            deviceTypes: supabaseCache.topDeviceTypes,
            referringDomains: supabaseCache.topReferringDomains,
            llmFileViews: supabaseCache.topLlmTxts,
            apiExplorerRequests: supabaseCache.topApiExplorer.map((a) => ({
                method: a.method,
                endpoint: a.endpoint,
                name: a.name,
                count: a.count,
                numSuccesses: a.numSuccesses || 0,
                numFailures: a.numFailures || 0
            })),
            llmBotTraffic: supabaseCache.topLlmBotTraffic,
            pages404: supabaseCache.pages404,
            pageViewsTimeSeries: supabaseCache.viewChart,
            visitorsTimeSeries: supabaseCache.visitorChart,
            baseSiteUrl: supabaseCache.docsSite,
            dateRange,
            cacheHit: true
        };
    }

    console.log(`Getting ALL analytics from Redshift (cache miss) - data may be 3-4 hours delayed`);
    console.warn(
        `[getAllAnalytics] Cache miss for ${baseDomain} - querying Redshift directly. Use Refresh button for real-time PostHog data.`
    );

    // Use Redshift for cache misses - much faster than PostHog (parallel queries, no rate limits)
    const { RedshiftAnalytics } = await import("../services/analytics/redshift-analytics");
    const analytics = new RedshiftAnalytics(baseDomain);

    // Convert dateRange to Redshift format
    const dayjs = (await import("dayjs")).default;
    const utc = (await import("dayjs/plugin/utc")).default;
    dayjs.extend(utc);

    const endDateDay = dayjs().utc();
    let startDateDay = endDateDay;

    if (dateRange.type === "last_n_days") {
        startDateDay = endDateDay.subtract(dateRange.days, "days");
    } else if (dateRange.type === "last_n_weeks") {
        startDateDay = endDateDay.subtract(dateRange.weeks * 7, "days");
    } else if (dateRange.type === "last_n_months") {
        startDateDay = endDateDay.subtract(dateRange.months, "months");
    } else if (dateRange.type === "custom_range") {
        startDateDay = dayjs(dateRange.startDate).utc();
    }

    const redshiftDateRange = {
        startDate: startDateDay.startOf("day").toDate(),
        endDate: endDateDay.endOf("day").toDate()
    };

    // Query Redshift in PARALLEL (no rate limits!)
    const [
        metrics,
        topPages,
        topCountries,
        channels,
        deviceTypes,
        referringDomains,
        llmFileViews,
        apiExplorerRequests,
        llmBotTraffic,
        pages404,
        pageViewsTimeSeries,
        visitorsTimeSeries
    ] = await Promise.all([
        analytics.getMetrics({ dateRange: redshiftDateRange }),
        analytics.getTopPages({ dateRange: redshiftDateRange, limit: 10 }),
        analytics.getTopCountries({ dateRange: redshiftDateRange, limit: 10 }),
        analytics.getChannels({ dateRange: redshiftDateRange, limit: 20 }),
        analytics.getDeviceTypes({ dateRange: redshiftDateRange, limit: 10 }),
        analytics.getReferringDomains({ dateRange: redshiftDateRange, limit: 10 }),
        analytics.getLLMFileViews({ dateRange: redshiftDateRange, limit: 20 }),
        analytics.getAPIExplorerRequests({ dateRange: redshiftDateRange, limit: 20 }),
        analytics.getLLMBotTrafficByProvider({ dateRange: redshiftDateRange, limit: 20 }),
        analytics.get404Pages({ dateRange: redshiftDateRange, limit: 20 }),
        analytics.getPageViewsTimeSeries({ dateRange: redshiftDateRange }),
        analytics.getVisitorsTimeSeries({ dateRange: redshiftDateRange })
    ]);

    console.log("[getAllAnalytics] All Redshift queries completed");

    // Map Redshift results to expected format
    return {
        metrics: {
            visitors: metrics.visitors,
            pageViews: metrics.pageviews,
            sessions: metrics.sessions
        },
        topPages,
        topCountries,
        channels,
        deviceTypes: deviceTypes.map((d) => ({ deviceType: d.device, visitors: d.visitors, views: d.views })),
        referringDomains,
        llmFileViews: llmFileViews.map((f) => ({ path: f.file, agentViews: f.agentViews, humanViews: f.humanViews })),
        apiExplorerRequests: apiExplorerRequests.map((a) => ({
            method: a.method,
            endpoint: a.endpoint,
            name: a.name,
            count: a.requests,
            numSuccesses: a.numSuccesses,
            numFailures: a.numFailures
        })),
        llmBotTraffic: llmBotTraffic.map((b) => ({ provider: b.provider, count: b.requests })),
        pages404,
        pageViewsTimeSeries: pageViewsTimeSeries.map((t) => ({ date: t.date, value: t.count })),
        visitorsTimeSeries: visitorsTimeSeries.map((t) => ({ date: t.date, value: t.count })),
        baseSiteUrl: baseDomain,
        dateRange,
        cacheHit: false
    };
}

export async function getPageViewsByDay(
    request: GetWebAnalyticsRequest
): Promise<{ timeSeries: { date: string; value: number }[] }> {
    const validated = GetWebAnalyticsSchema.parse(request);
    const dateRange = validated.dateRange || DEFAULT_DATE_RANGE;

    const handler = getHandler(validated.docsUrl, dateRange, validated.selectedDomain);
    const supabaseCache = await handler.getSupabaseCache();

    if (supabaseCache && !validated.groupBy) {
        console.log(`Using Supabase cache for pageviews timeseries`);
        return {
            timeSeries: supabaseCache.viewChart.map((d) => ({
                date: d.date,
                value: d.value
            }))
        };
    }

    const live = await getLiveAnalytics(validated.docsUrl);
    const analytics = live.getAnalytics();
    const timeSeries = await analytics.getPageViewsTimeSeries({
        dateRange,
        includeInternal: validated.includeInternal,
        groupBy: validated.groupBy
    });

    return { timeSeries };
}

export async function getVisitorsByDay(
    request: GetWebAnalyticsRequest
): Promise<{ timeSeries: { date: string; value: number }[] }> {
    const validated = GetWebAnalyticsSchema.parse(request);
    const dateRange = validated.dateRange || DEFAULT_DATE_RANGE;

    const handler = getHandler(validated.docsUrl, dateRange, validated.selectedDomain);
    const supabaseCache = await handler.getSupabaseCache();

    if (supabaseCache && !validated.groupBy) {
        console.log(`Using Supabase cache for visitors timeseries`);
        return {
            timeSeries: supabaseCache.visitorChart.map((d) => ({
                date: d.date,
                value: d.value
            }))
        };
    }

    const live = await getLiveAnalytics(validated.docsUrl);
    const analytics = live.getAnalytics();
    const timeSeries = await analytics.getVisitorsTimeSeries({
        dateRange,
        includeInternal: validated.includeInternal,
        groupBy: validated.groupBy
    });

    return { timeSeries };
}

export async function getTopPages(
    request: TableRequest
): Promise<{ topPages: { path: string; visitors: number; views: number }[] }> {
    const validated = TableRequestSchema.parse(request);
    const dateRange = validated.dateRange || DEFAULT_DATE_RANGE;
    const limit = validated.limit || 10;
    const orderBy = validated.orderBy === "visitors" || validated.orderBy === "views" ? validated.orderBy : "views";
    const order = validated.order || "desc";

    const handler = getHandler(validated.docsUrl, dateRange, validated.selectedDomain);
    const supabaseCache = await handler.getSupabaseCache();

    if (supabaseCache) {
        console.log(`Using Supabase cache for top pages`);
        const pages = [...supabaseCache.topPaths];
        if (orderBy === "visitors") {
            pages.sort((a, b) => (order === "desc" ? b.visitors - a.visitors : a.visitors - b.visitors));
        } else {
            pages.sort((a, b) => (order === "desc" ? b.views - a.views : a.views - b.views));
        }
        return { topPages: pages.slice(0, limit) };
    }

    const live = await getLiveAnalytics(validated.docsUrl);
    const analytics = live.getAnalytics();
    const topPages = await analytics.getTopPages({
        dateRange,
        includeInternal: validated.includeInternal,
        limit,
        orderBy,
        order
    });

    return { topPages };
}

export async function getTopCountries(request: TableRequest): Promise<{
    topCountries: { country: string; visitors: number; views: number }[];
}> {
    const validated = TableRequestSchema.parse(request);
    const dateRange = validated.dateRange || DEFAULT_DATE_RANGE;
    const limit = validated.limit || 10;
    const orderBy = validated.orderBy === "visitors" || validated.orderBy === "views" ? validated.orderBy : "visitors";
    const order = validated.order || "desc";

    const handler = getHandler(validated.docsUrl, dateRange, validated.selectedDomain);
    const supabaseCache = await handler.getSupabaseCache();

    if (supabaseCache) {
        console.log(`Using Supabase cache for top countries`);
        const countries = [...supabaseCache.topCountries];
        if (orderBy === "visitors") {
            countries.sort((a, b) => (order === "desc" ? b.visitors - a.visitors : a.visitors - b.visitors));
        } else if (orderBy === "views") {
            countries.sort((a, b) => (order === "desc" ? b.views - a.views : a.views - b.views));
        } else {
            // Sort by country name alphabetically
            countries.sort((a, b) => {
                const comparison = a.country.localeCompare(b.country);
                return order === "desc" ? -comparison : comparison;
            });
        }
        return { topCountries: countries.slice(0, limit) };
    }

    const live = await getLiveAnalytics(validated.docsUrl);
    const analytics = live.getAnalytics();
    const topCountries = await analytics.getTopCountries({
        dateRange,
        includeInternal: validated.includeInternal,
        limit,
        orderBy,
        order
    });

    return { topCountries };
}

export async function getLLMFileViews(request: LLMFileViewsRequest): Promise<{
    llmFileViews: { path: string; agentViews: number; humanViews: number }[];
}> {
    const validated = LLMFileViewsRequestSchema.parse(request);
    const dateRange = validated.dateRange || DEFAULT_DATE_RANGE;

    const handler = getHandler(validated.docsUrl, dateRange, validated.selectedDomain);
    const supabaseCache = await handler.getSupabaseCache();

    if (supabaseCache) {
        console.log(`Using Supabase cache for LLM file views`);
        return {
            llmFileViews: supabaseCache.topLlmTxts.slice(0, validated.limit || 20)
        };
    }

    const live = await getLiveAnalytics(validated.docsUrl);
    const analytics = live.getAnalytics();
    const llmFileViews = await analytics.getLLMFileViews({
        dateRange,
        includeInternal: validated.includeInternal,
        limit: validated.limit || 20,
        orderBy: validated.orderBy || "humanViews",
        order: validated.order || "desc"
    });

    return { llmFileViews };
}

export async function getChannels(request: TableRequest): Promise<{
    channels: { channel: string; visitors: number; views: number }[];
}> {
    const validated = TableRequestSchema.parse(request);
    const dateRange = validated.dateRange || DEFAULT_DATE_RANGE;

    const handler = getHandler(validated.docsUrl, dateRange, validated.selectedDomain);
    const supabaseCache = await handler.getSupabaseCache();

    if (supabaseCache) {
        console.log(`Using Supabase cache for channels`);
        return {
            channels: supabaseCache.topChannels.slice(0, validated.limit || 20)
        };
    }

    const live = await getLiveAnalytics(validated.docsUrl);
    const analytics = live.getAnalytics();
    const orderBy = validated.orderBy === "visitors" || validated.orderBy === "views" ? validated.orderBy : "visitors";
    const channels = await analytics.getChannels({
        dateRange,
        includeInternal: validated.includeInternal,
        limit: validated.limit || 20,
        orderBy,
        order: validated.order || "desc"
    });

    return { channels };
}

export async function getDeviceTypes(request: TableRequest): Promise<{
    deviceTypes: { deviceType: string; visitors: number; views: number }[];
}> {
    const validated = TableRequestSchema.parse(request);
    const dateRange = validated.dateRange || DEFAULT_DATE_RANGE;

    const handler = getHandler(validated.docsUrl, dateRange, validated.selectedDomain);
    const supabaseCache = await handler.getSupabaseCache();

    if (supabaseCache) {
        console.log(`Using Supabase cache for device types`);
        return {
            deviceTypes: supabaseCache.topDeviceTypes.slice(0, validated.limit || 10)
        };
    }

    const live = await getLiveAnalytics(validated.docsUrl);
    const analytics = live.getAnalytics();
    const orderBy = validated.orderBy === "visitors" || validated.orderBy === "views" ? validated.orderBy : "visitors";
    const deviceTypes = await analytics.getDeviceTypes({
        dateRange,
        includeInternal: validated.includeInternal,
        limit: validated.limit || 10,
        orderBy,
        order: validated.order || "desc"
    });

    return { deviceTypes };
}

export async function getReferringDomains(request: TableRequest): Promise<{
    referringDomains: { domain: string; visitors: number; views: number }[];
}> {
    const validated = TableRequestSchema.parse(request);
    const dateRange = validated.dateRange || DEFAULT_DATE_RANGE;

    const handler = getHandler(validated.docsUrl, dateRange, validated.selectedDomain);
    const supabaseCache = await handler.getSupabaseCache();

    if (supabaseCache) {
        console.log(`Using Supabase cache for referring domains`);
        return {
            referringDomains: supabaseCache.topReferringDomains.slice(0, validated.limit || 10)
        };
    }

    const live = await getLiveAnalytics(validated.docsUrl);
    const analytics = live.getAnalytics();
    const orderBy = validated.orderBy === "visitors" || validated.orderBy === "views" ? validated.orderBy : "visitors";
    const referringDomains = await analytics.getReferringDomains({
        dateRange,
        includeInternal: validated.includeInternal,
        limit: validated.limit || 10,
        orderBy,
        order: validated.order || "desc"
    });

    return { referringDomains };
}

export async function get404Pages(request: TableRequest): Promise<{ pages404: { path: string; count: number }[] }> {
    const validated = TableRequestSchema.parse(request);
    const dateRange = validated.dateRange || DEFAULT_DATE_RANGE;

    // 404 pages not cached in Supabase, always fetch live
    const live = await getLiveAnalytics(validated.docsUrl);
    const analytics = live.getAnalytics();
    const pages404 = await analytics.get404Pages({
        dateRange,
        includeInternal: validated.includeInternal,
        limit: validated.limit || 20,
        order: validated.order || "desc"
    });

    return { pages404 };
}

export async function getAPIExplorerRequests(request: TableRequest): Promise<{
    apiExplorerRequests: {
        host: string;
        method: string;
        endpoint: string;
        name: string;
        count: number;
        numSuccesses: number;
        numFailures: number;
    }[];
}> {
    const validated = TableRequestSchema.parse(request);
    const dateRange = validated.dateRange || DEFAULT_DATE_RANGE;

    const handler = getHandler(validated.docsUrl, dateRange, validated.selectedDomain);
    const supabaseCache = await handler.getSupabaseCache();

    if (supabaseCache) {
        console.log(`Using Supabase cache for API Explorer requests`);
        return {
            apiExplorerRequests: supabaseCache.topApiExplorer.map((a) => ({
                host: "",
                method: a.method,
                endpoint: a.endpoint,
                name: a.name,
                count: a.count,
                numSuccesses: a.numSuccesses || 0,
                numFailures: a.numFailures || 0
            }))
        };
    }

    const live = await getLiveAnalytics(validated.docsUrl);
    const analytics = live.getAnalytics();
    const apiExplorerRequests = await analytics.getAPIExplorerRequests({
        dateRange,
        limit: validated.limit || 20,
        order: validated.order || "desc",
        orderBy:
            validated.orderBy === "count" || validated.orderBy === "numSuccesses" || validated.orderBy === "numFailures"
                ? validated.orderBy
                : "count"
    });

    return { apiExplorerRequests };
}

export async function getLLMBotTrafficByProvider(request: TableRequest): Promise<{
    providers: { provider: string; count: number }[];
}> {
    const validated = TableRequestSchema.parse(request);
    const dateRange = validated.dateRange || DEFAULT_DATE_RANGE;

    const handler = getHandler(validated.docsUrl, dateRange, validated.selectedDomain);
    const supabaseCache = await handler.getSupabaseCache();

    if (supabaseCache) {
        console.log(`Using Supabase cache for LLM bot traffic`);
        return {
            providers: supabaseCache.topLlmBotTraffic.slice(0, validated.limit || 20)
        };
    }

    const live = await getLiveAnalytics(validated.docsUrl);
    const analytics = live.getAnalytics();
    const providers = await analytics.getLLMBotTrafficByProvider({
        dateRange,
        includeInternal: validated.includeInternal,
        limit: validated.limit || 20,
        order: validated.order || "desc"
    });

    return { providers };
}

/**
 * Server action to refresh analytics by re-computing and storing in Supabase
 * This will insert/update the analytics record for the period the user is viewing
 */
export async function refreshWebAnalytics(
    docsUrl: string,
    dateRange: DateRangeOptions
): Promise<{ success: boolean; error?: string }> {
    try {
        const docsSiteKey = getDocsSiteKey(docsUrl);

        // Only refresh if this is a standard cacheable period
        const period = getSupabaseCachePeriod(dateRange);
        if (!period) {
            return {
                success: false,
                error: "Cannot refresh analytics for custom date ranges. Only standard periods (7, 14, 30, 90, 180 days) are supported."
            };
        }

        console.log(
            `[refreshWebAnalytics] Starting HARD REFRESH from Redshift for ${docsSiteKey}, period: ${period} days`
        );

        // Use Redshift to re-fetch analytics (same as cron job)
        // This is faster and more reliable than PostHog API which times out
        const result = await insertAnalyticsForSite(docsSiteKey, period);

        if (!result.success) {
            console.error(`[refreshWebAnalytics] Failed:`, result.error);
            return { success: false, error: result.error };
        }

        console.log(`[refreshWebAnalytics] Successfully refreshed from Redshift for ${docsSiteKey}`);

        // Invalidate the handler cache so next request gets fresh data
        handlerCache.clear();

        return { success: true };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[refreshWebAnalytics] Error:`, error);
        return { success: false, error: errorMessage };
    }
}
