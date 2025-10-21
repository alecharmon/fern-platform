"use server";

import type { FernAI } from "@fern-api/fai-sdk";

import { getRequestParams, type TimeRange } from "@/components/analytics/utils/get-request-params";

import { getCurrentSessionOrThrow } from "../services/auth0/getCurrentSession";
import { getFaiClient } from "../services/fai/getFaiClient";

export async function getConversationResolution({
    docsUrl,
    timeRange
}: {
    docsUrl: string;
    timeRange: TimeRange;
}): Promise<FernAI.GetConversationResolutionResponse> {
    const session = await getCurrentSessionOrThrow();
    const faiClient = getFaiClient({ token: session.accessToken });
    const requestParams = getRequestParams(timeRange);
    if (requestParams.start_date === undefined) {
        throw new Error("All data is not supported for conversation resolution");
    }
    return await faiClient.analytics.getConversationResolution(docsUrl, requestParams);
}
