"use server";

import { fernToken_admin } from "@fern-api/docs-server";
import { z } from "zod";

import { getDocsUrlMetadata } from "../api/utils/getDocsUrlMetadata";
import { getCurrentSessionOrThrow } from "../services/auth0/getCurrentSession";
import getDocsSitesForOrg from "../services/dal/fdr/getDocsSitesForOrg";
import { getAnalyticsService } from "../services/posthog";
import type { DateRangeOptions } from "../services/posthog/types";
import { AsyncRedisCache } from "../services/redis/AsyncRedisCache";
import { RedisCacheKey, RedisCacheKeyType } from "../services/redis/cacheKey";
import { redisDelPattern } from "../services/redis/redis";

const DEFAULT_DATE_RANGE: DateRangeOptions = {
    type: "last_n_days",
    days: 7
};

const FEEDBACK_CACHE = new AsyncRedisCache(RedisCacheKeyType.WEB_ANALYTICS, { ttlInSeconds: 3600 });

const VERIFY_ACCESS_CACHE = new AsyncRedisCache(RedisCacheKeyType.WEB_ANALYTICS, {
    ttlInSeconds: 600
});

const GetFeedbackSchema = z.object({
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
    page: z.number().int().min(1).optional(),
    pageSize: z.number().int().min(1).max(1000).optional()
});

export type GetFeedbackRequest = z.infer<typeof GetFeedbackSchema>;

export interface FeedbackEntry {
    date: string;
    location: string;
    wasHelpful: boolean;
    selection: string;
    currentUrl: string;
    device: string;
    browser: string;
    operatingSystem: string;
    userFeedback: string;
    feedbackType?: string;
    language?: string;
    code?: string;
}

export interface GetFeedbackResponse {
    feedback: FeedbackEntry[];
    baseSiteUrl: string;
    dateRange: DateRangeOptions;
    pagination: {
        page: number;
        pageSize: number;
        hasMore: boolean;
    };
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

async function verifyDomainAccess(params: {
    url: string;
    token: string;
    userId: string;
    orgName?: string;
}): Promise<boolean> {
    const { url, token, userId, orgName } = params;
    const decodedUrl = decodeURIComponent(url);
    const baseDomain = getBaseDomain(decodedUrl);

    const cacheKeyParams = JSON.stringify({
        userId,
        orgName: orgName ?? "unknown"
    });
    const cacheKey = RedisCacheKey.webAnalytics("verify-access", baseDomain, cacheKeyParams);

    const cachedResult = await VERIFY_ACCESS_CACHE.get(cacheKey, async () => {
        let resolvedOrgName = orgName;

        if (!resolvedOrgName) {
            const docsMetadata = await getDocsUrlMetadata({
                url: decodedUrl,
                token: fernToken_admin() ?? token
            });

            if (!docsMetadata.ok || !docsMetadata.body.org) {
                throw new Error(`Invalid docs URL`);
            }
            resolvedOrgName = docsMetadata.body.org;
        }

        const orgSites = await getDocsSitesForOrg({
            token,
            // @ts-expect-error - OrgId vs Auth0OrgName type mismatch
            orgName: resolvedOrgName
        });

        if (!orgSites.ok) {
            throw new Error("Failed to fetch organization sites");
        }

        const hasAccess = orgSites.docsSites.some((site) => site.mainUrl.domain === baseDomain);
        return { metrics: { visitors: hasAccess ? 1 : 0, pageViews: 0, sessions: 0 } };
    });

    return (cachedResult.metrics?.visitors ?? 0) > 0;
}

function getCacheKey(
    domain: string,
    params: { dateRange?: DateRangeOptions; includeInternal?: boolean; page?: number; pageSize?: number }
) {
    const flatParams: Record<string, unknown> = {
        includeInternal: params.includeInternal,
        page: params.page,
        pageSize: params.pageSize
    };

    const dateRange = params.dateRange;
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
    return RedisCacheKey.webAnalytics("feedback", domain, sortedParams);
}

export async function getFeedback(request: GetFeedbackRequest): Promise<GetFeedbackResponse> {
    const validated = GetFeedbackSchema.parse(request);

    const session = await getCurrentSessionOrThrow();
    const userId = session.user.sub;
    const token = session.accessToken;

    const hasAccess = await verifyDomainAccess({
        url: validated.docsUrl,
        token,
        userId
    });
    if (!hasAccess) {
        throw new Error("You don't have access to analytics for this docs site");
    }

    const dateRange = validated.dateRange || DEFAULT_DATE_RANGE;
    const baseDomain = getBaseDomain(validated.docsUrl);
    const page = validated.page || 1;
    const pageSize = validated.pageSize || 100;

    const cacheKey = getCacheKey(baseDomain, {
        dateRange,
        includeInternal: validated.includeInternal,
        page,
        pageSize
    });

    const cachedData = await FEEDBACK_CACHE.get(cacheKey, async () => {
        const analytics = getAnalyticsService({
            userId,
            baseSiteUrl: baseDomain
        });

        const offset = (page - 1) * pageSize;
        const limit = pageSize + 1;

        const feedback = await analytics.getFeedback({
            dateRange,
            includeInternal: validated.includeInternal,
            limit,
            offset
        });

        const hasMore = feedback.length > pageSize;
        const feedbackPage = hasMore ? feedback.slice(0, pageSize) : feedback;

        return { feedback: feedbackPage, hasMore };
    });

    return {
        feedback: cachedData.feedback!,
        baseSiteUrl: baseDomain,
        dateRange,
        pagination: {
            page,
            pageSize,
            hasMore: cachedData.hasMore!
        }
    };
}

export async function clearFeedbackCache(docsUrl: string): Promise<void> {
    const baseDomain = getBaseDomain(docsUrl);
    const pattern = RedisCacheKey.webAnalytics("feedback", baseDomain, "*");
    await redisDelPattern(pattern);
}
