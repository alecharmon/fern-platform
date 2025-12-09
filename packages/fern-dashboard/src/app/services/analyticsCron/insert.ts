import { RedshiftAnalytics } from "../analytics/redshift-analytics";
import { getSupabaseClient } from "../supabase";
import type { AnalyticsRecordInsert } from "../supabase/types";
import type { DateRangePeriod, InsertAnalyticsResult } from "./types";

/**
 * Analytics Cron - Insert
 *
 * Inserts analytics records for a single docs site by querying PostHog
 * and storing the results in Supabase.
 */
// Only enforce server-only in non-test environments
if (process.env.NODE_ENV !== "test") {
    require("server-only");
}

/**
 * Calculate start and end dates for a given period (UTC start of day)
 * End date is start of today (exclusive), so data is for complete days only
 * @param overrideEndDate - Optional end date to use instead of "now" (for historical data processing)
 */
function _calculateDateRange(period: DateRangePeriod, overrideEndDate?: Date): { startDate: string; endDate: string } {
    const now = overrideEndDate || new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    const startDate = new Date(todayStart);
    startDate.setUTCDate(startDate.getUTCDate() - period);

    const startDateStr = startDate.toISOString().split("T")[0];
    const endDateStr = todayStart.toISOString().split("T")[0];

    if (!startDateStr || !endDateStr) {
        throw new Error("Failed to format date strings");
    }

    return {
        startDate: startDateStr,
        endDate: endDateStr
    };
}

/**
 * Insert analytics record for a single docs site
 *
 * @param docsSite - The domain of the docs site (e.g., "docs.example.com")
 * @param period - The date range period in days
 * @param additionalDomains - Additional domains associated with this docs site
 * @param overrideEndDate - Optional end date to use instead of "now" (for historical data processing)
 */
export async function insertAnalyticsForSite(
    docsSite: string,
    period: DateRangePeriod,
    overrideEndDate?: Date
): Promise<InsertAnalyticsResult> {
    // Use dayjs for proper UTC date handling
    const dayjs = (await import("dayjs")).default;
    const utc = (await import("dayjs/plugin/utc")).default;
    dayjs.extend(utc);

    // Calculate UTC date range
    const endDateDay = overrideEndDate ? dayjs(overrideEndDate).utc() : dayjs().utc();
    const startDateDay = endDateDay.subtract(period, "days");

    // Format dates for Supabase storage (YYYY-MM-DD in UTC)
    const endDate = endDateDay.format("YYYY-MM-DD");
    const startDate = startDateDay.format("YYYY-MM-DD");

    // For Redshift queries, use start/end of UTC day
    const redshiftStartDate = startDateDay.startOf("day").toDate();
    const redshiftEndDate = endDateDay.endOf("day").toDate();
    const dateRange = { startDate: redshiftStartDate, endDate: redshiftEndDate };

    try {
        // Use Redshift analytics client (queries PostHog events from Redshift database)
        // No rate limits since we're querying our own database!
        const analytics = new RedshiftAnalytics(docsSite);

        // Fetch all analytics data in parallel - no rate limiting needed!
        const [
            topPages,
            topCountries,
            channels,
            deviceTypes,
            referringDomains,
            llmFileViews,
            apiExplorerRequests,
            llmBotTraffic,
            metrics,
            pageviewsTimeSeries,
            visitorsTimeSeries
        ] = await Promise.all([
            analytics.getTopPages({ dateRange, limit: 10 }),
            analytics.getTopCountries({ dateRange, limit: 10 }),
            analytics.getChannels({ dateRange, limit: 10 }),
            analytics.getDeviceTypes({ dateRange, limit: 10 }),
            analytics.getReferringDomains({ dateRange, limit: 10 }),
            analytics.getLLMFileViews({ dateRange, limit: 10 }),
            analytics.getAPIExplorerRequests({ dateRange, limit: 20 }),
            analytics.getLLMBotTrafficByProvider({ dateRange, limit: 10 }),
            analytics.getMetrics({ dateRange }),
            analytics.getPageViewsTimeSeries({ dateRange }),
            analytics.getVisitorsTimeSeries({ dateRange })
        ]);

        // Prepare the record for insertion
        const record: AnalyticsRecordInsert = {
            start_date: startDate,
            end_date: endDate,
            docs_site: docsSite,
            docs_org: null,
            top_paths: topPages.map((p) => ({
                path: p.path,
                visitors: p.visitors,
                views: p.views
            })),
            top_countries: topCountries.map((c) => ({
                country: c.country,
                visitors: c.visitors,
                views: c.views
            })),
            top_channels: channels.map((c) => ({
                channel: c.channel,
                visitors: c.visitors,
                views: c.views
            })),
            top_device_types: deviceTypes.map((d) => ({
                deviceType: d.device,
                visitors: d.visitors,
                views: d.views
            })),
            top_referring_domains: referringDomains.map((r) => ({
                domain: r.domain,
                visitors: r.visitors,
                views: r.views
            })),
            top_llm_txts: llmFileViews.map((l) => ({
                path: l.file,
                agentViews: l.agentViews,
                humanViews: l.humanViews
            })),
            top_api_explorer: apiExplorerRequests.map((a) => ({
                method: a.endpoint,
                endpoint: a.endpoint,
                name: a.endpoint,
                count: a.requests
            })),
            top_llm_bot_traffic: llmBotTraffic.map((b) => ({
                provider: b.provider,
                count: b.requests
            })),
            total_visitors: metrics.visitors,
            total_views: metrics.pageviews,
            visitor_chart: visitorsTimeSeries.map((d) => ({
                date: d.date,
                value: d.count
            })),
            view_chart: pageviewsTimeSeries.map((d) => ({
                date: d.date,
                value: d.count
            }))
        };

        // Upsert into Supabase (insert or update if record exists)
        // NOTE: Requires unique constraint on (docs_site, start_date, end_date) in Supabase
        const supabase = getSupabaseClient();

        console.log(`[insertAnalyticsForSite] Upserting record for ${docsSite}:`, {
            start_date: startDate,
            end_date: endDate,
            total_visitors: record.total_visitors,
            total_views: record.total_views,
            viewChartDec1: record.view_chart?.find((d: any) => d.date === "2025-12-01")
        });

        const { data, error } = await supabase
            .from("AnalyticsRecord")
            .upsert(record as any, {
                onConflict: "docs_site,start_date,end_date"
            })
            .select();

        if (error) {
            console.error(`[insertAnalyticsForSite] Failed to upsert record for ${docsSite}:`, error);
            return {
                success: false,
                docsSite,
                docsOrg: null,
                error: error.message
            };
        }

        const upsertedRecord = data?.[0] as any;
        console.info(`[insertAnalyticsForSite] Successfully upserted analytics for ${docsSite}`, {
            recordId: upsertedRecord?.id,
            createdAt: upsertedRecord?.created_at
        });
        return {
            success: true,
            docsSite,
            docsOrg: null
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[insertAnalyticsForSite] Error processing ${docsSite}:`, error);
        return {
            success: false,
            docsSite,
            docsOrg: null,
            error: errorMessage
        };
    }
}
