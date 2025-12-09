import { config } from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { getAnalyticsService } from "../src/app/services/posthog";
import { getCachedAnalytics } from "../src/app/services/posthog/cache";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, "../.env.local") });

async function compare() {
    const domain = "launchdarkly.com";
    const _period = 7;

    console.log("=".repeat(80));
    console.log(`Comparing Analytics Sources for ${domain} (Last 7 days)`);
    console.log("=".repeat(80));
    console.log("");

    // 1. Get from PostHog API (what production shows)
    console.log("1. Querying PostHog API...");
    const analytics = getAnalyticsService({
        userId: "test-user",
        baseSiteUrl: domain
    });

    const posthogMetrics = await analytics.getMetrics({
        dateRange: { type: "last_n_days", days: 7 }
    });

    const posthogTopPages = await analytics.getTopPages({
        dateRange: { type: "last_n_days", days: 7 },
        limit: 5,
        orderBy: "views",
        order: "desc"
    });

    console.log("PostHog API Results:");
    console.log("  Metrics:", posthogMetrics);
    console.log("  Top 5 pages:", posthogTopPages);
    console.log("");

    // 2. Get from Supabase cache (what our cron populated)
    console.log("2. Querying Supabase cache...");
    const cachedData = await getCachedAnalytics({
        docsSite: domain,
        period: 7
    });

    if (cachedData) {
        console.log("Supabase Cache Results:");
        console.log("  Metrics:", {
            visitors: cachedData.totalVisitors,
            pageViews: cachedData.totalViews,
            sessions: 0
        });
        console.log("  Top 5 pages:", cachedData.topPaths.slice(0, 5));
        console.log("  Cache created:", cachedData.createdAt);
    } else {
        console.log("Supabase Cache: NOT FOUND");
    }
    console.log("");

    // 3. Compare
    if (cachedData) {
        console.log("=".repeat(80));
        console.log("COMPARISON:");
        console.log("=".repeat(80));
        const visitorDelta = posthogMetrics.visitors - cachedData.totalVisitors;
        const viewsDelta = posthogMetrics.pageViews - cachedData.totalViews;

        console.log(
            `Visitors:   PostHog=${posthogMetrics.visitors}  vs  Cache=${cachedData.totalVisitors}  (delta: ${visitorDelta})`
        );
        console.log(
            `Page views: PostHog=${posthogMetrics.pageViews}  vs  Cache=${cachedData.totalViews}  (delta: ${viewsDelta})`
        );
        console.log(`Sessions:   PostHog=${posthogMetrics.sessions}  vs  Cache=0`);

        const percentDiff = {
            visitors: ((visitorDelta / posthogMetrics.visitors) * 100).toFixed(1),
            pageViews: ((viewsDelta / posthogMetrics.pageViews) * 100).toFixed(1)
        };

        console.log("");
        console.log(`Percentage difference:`);
        console.log(`  Visitors: ${percentDiff.visitors}%`);
        console.log(`  Page views: ${percentDiff.pageViews}%`);

        if (Math.abs(visitorDelta) < 5 && Math.abs(viewsDelta) < 10) {
            console.log("");
            console.log("✅ MATCH: Data is consistent between sources!");
        } else if (Math.abs(parseFloat(percentDiff.visitors)) < 5 && Math.abs(parseFloat(percentDiff.pageViews)) < 5) {
            console.log("");
            console.log("✅ CLOSE MATCH: Difference is within acceptable range (< 5%)");
        } else {
            console.log("");
            console.log("⚠️  MISMATCH: Significant difference detected!");
        }
    }
}

compare().catch(console.error);
