"use server";

import type { FernAI } from "@fern-api/fai-sdk";

import { type TimeRange, getRequestParams } from "@/components/analytics/utils/get-request-params";

import { getCurrentSessionOrThrow } from "../services/auth0/getCurrentSession";
import { getFaiClient } from "../services/fai/getFaiClient";

export async function getQueries({
    domain,
    page,
    limit = 10,
    cutoffTime,
    timeRange
}: {
    domain: string;
    page: number;
    limit: number;
    cutoffTime: string;
    timeRange: TimeRange;
}): Promise<FernAI.GetQueriesResponse> {
    const session = await getCurrentSessionOrThrow();
    const faiClient = getFaiClient({ token: session.accessToken });
    return await faiClient.query.getRecentQueries(domain, {
        page,
        limit,
        cutoff_time: cutoffTime,
        ...getRequestParams(timeRange)
    });
}
