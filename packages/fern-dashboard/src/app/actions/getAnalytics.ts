"use server";

import type { FernAI } from "@fern-api/fai-sdk";

import { getRequestParams, type TimeRange } from "@/components/analytics/utils/get-request-params";

import { getCurrentSession } from "../services/auth0/getCurrentSession";
import { getFaiClient } from "../services/fai/getFaiClient";

type GetDomainAnalyticsResponse =
    | {
          success: true;
          data: FernAI.GetHistogramAnalyticsResponse;
      }
    | {
          success: false;
          error: string;
      };

export async function getDomainAnalytics({
    docsUrl,
    timeRange
}: {
    docsUrl: string;
    timeRange: TimeRange;
}): Promise<GetDomainAnalyticsResponse> {
    const session = await getCurrentSession();
    if (!session) {
        return {
            success: false,
            error: "Not authenticated"
        };
    }
    const faiClient = getFaiClient({ token: session.accessToken });
    const requestParams = getRequestParams(timeRange);
    if (requestParams.start_date === undefined) {
        return {
            success: false,
            error: "All data is not supported for analytics"
        };
    }
    try {
        const response = await faiClient.analytics.getAnalyticsHistogram(docsUrl, requestParams);
        return {
            success: true,
            data: response
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
        };
    }
}
