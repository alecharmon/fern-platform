"use server";

import { FernAI } from "@fern-api/fai-sdk";

import { getCurrentSessionOrThrow } from "../services/auth0/getCurrentSession";
import { getFaiClient } from "../services/fai/getFaiClient";

export async function getQueryInsights({ docsUrl }: { docsUrl: string }): Promise<FernAI.GetInsightsResponse> {
    const session = await getCurrentSessionOrThrow();
    const faiClient = getFaiClient({ token: session.accessToken });
    return await faiClient.analytics.getAnalyticsInsights(docsUrl);
}
