"use server";

import type { FernAI } from "@fern-api/fai-sdk";

import { getFaiClient } from "@/app/services/fai/getFaiClient";
import { getRequestParams, type TimeRange } from "@/components/analytics/utils/get-request-params";

import { getCurrentSessionOrThrow } from "../services/auth0/getCurrentSession";

export async function getAllQueries({
    domain,
    cutoffTime,
    timeRange
}: {
    domain: string;
    cutoffTime: string;
    timeRange: TimeRange;
}): Promise<{ queries: FernAI.Query[]; total: number }> {
    const session = await getCurrentSessionOrThrow();
    const client = getFaiClient({ token: session.accessToken });
    const params = getRequestParams(timeRange);

    let allQueries: FernAI.Query[] = [];
    let page = 1;
    const limit = 500;
    let hasMore = true;

    while (hasMore) {
        const response = await client.query.getRecentQueries(domain, {
            page,
            limit,
            include_assistant: true,
            cutoff_time: cutoffTime,
            ...params
        });

        allQueries = [...allQueries, ...response.queries];
        hasMore = response.queries.length === limit;
        page += 1;
    }

    return {
        queries: allQueries,
        total: allQueries.length
    };
}
