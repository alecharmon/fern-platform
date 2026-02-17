import { getDomainAnalytics } from "@/app/actions/getAnalytics";
import { getConversationResolution } from "@/app/actions/getConversationResolution";
import { getFaiClient } from "@/app/services/fai/getFaiClient";

import { AnalyticsPageClient } from "./AnalyticsPageClient";
import { getBaseDocsUrl } from "./utils/get-base-docs-url";
import { TimeRange } from "./utils/get-request-params";

export const ITEMS_PER_PAGE = 25;

export default async function AnalyticsPage({
    docsUrl,
    analyticsBillingEnabled
}: {
    docsUrl: string;
    analyticsBillingEnabled: boolean;
}) {
    const client = getFaiClient({ token: process.env.FERN_TOKEN ?? "" });
    const baseDocsUrl = getBaseDocsUrl(docsUrl);
    const cutoffTime = new Date(Date.now()).toISOString();

    const analyticsDataResponse = await getDomainAnalytics({
        docsUrl: baseDocsUrl,
        timeRange: TimeRange.LAST_WEEK
    });

    if (!analyticsDataResponse.success) {
        console.error("Failed to fetch analytics data:", analyticsDataResponse.error);
        return null;
    }

    let resolutionData;
    try {
        resolutionData = await getConversationResolution({
            docsUrl: baseDocsUrl,
            timeRange: TimeRange.LAST_WEEK
        });
    } catch (error) {
        console.error("Failed to fetch resolution data:", error);
        resolutionData = {
            total_conversations: 0,
            resolved_conversations: 0,
            unresolved_conversations: 0,
            resolution_rate: 0
        };
    }

    const queriesData = await client.query.getRecentQueries(baseDocsUrl, {
        cutoff_time: cutoffTime,
        limit: ITEMS_PER_PAGE
    });

    return (
        <AnalyticsPageClient
            baseDocsUrl={baseDocsUrl}
            initialQueriesData={queriesData.queries}
            initialHistogramData={analyticsDataResponse.data}
            initialResolutionData={resolutionData}
            initialTotalQueries={queriesData.pagination.total}
            cutoffTime={cutoffTime}
            analyticsBillingEnabled={analyticsBillingEnabled}
        />
    );
}
