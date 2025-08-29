"use server";

import { FernAI } from "@fern-api/fai-sdk";

import {
  TimeRange,
  getRequestParams,
} from "@/components/analytics/utils/get-request-params";

import { getCurrentSessionOrThrow } from "../services/auth0/getCurrentSession";
import { getFaiClient } from "../services/fai/getFaiClient";

export async function getDomainAnalytics({
  docsUrl,
  timeRange,
}: {
  docsUrl: string;
  timeRange: TimeRange;
}): Promise<FernAI.GetHistogramAnalyticsResponse> {
  const session = await getCurrentSessionOrThrow();
  const faiClient = getFaiClient({ token: session.accessToken });
  const requestParams = getRequestParams(timeRange);
  if (requestParams.start_date === undefined) {
    throw new Error("All data is not supported for analytics");
  }
  return await faiClient.analytics.getAnalyticsHistogram(
    docsUrl,
    requestParams
  );
}
