import { config } from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { RedshiftAnalytics } from "../src/app/services/analytics/redshift-analytics";
import { getAnalyticsService } from "../src/app/services/posthog";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, "../.env.local") });

async function compare() {
    const domain = "launchdarkly.com";

    console.log("=".repeat(80));
    console.log(`Comparing PostHog vs Redshift for ${domain}`);
    console.log(`Date Range: Nov 22-29, 2025`);
    console.log("=".repeat(80));
    console.log("");

    // 1. PostHog API
    console.log("1. Querying PostHog API (Nov 22-29)...");
    const posthog = getAnalyticsService({
        userId: "test-user",
        baseSiteUrl: domain
    });

    const phMetrics = await posthog.getMetrics({
        dateRange: {
            type: "custom_range",
            startDate: "2025-11-22",
            endDate: "2025-11-29"
        }
    });

    console.log("PostHog Results:", phMetrics);
    console.log("");

    // 2. Redshift
    console.log("2. Querying Redshift (Nov 22-29)...");
    const redshift = new RedshiftAnalytics(domain);
    const rsMetrics = await redshift.getMetrics({
        dateRange: {
            startDate: new Date("2025-11-22T00:00:00Z"),
            endDate: new Date("2025-11-29T00:00:00Z")
        }
    });

    console.log("Redshift Results:", rsMetrics);
    console.log("");

    // 3. Compare
    console.log("=".repeat(80));
    console.log("COMPARISON:");
    console.log("=".repeat(80));

    const diff = {
        visitors: phMetrics.visitors - rsMetrics.visitors,
        pageviews: phMetrics.pageViews - rsMetrics.pageviews,
        sessions: phMetrics.sessions - rsMetrics.sessions
    };

    const pct = {
        visitors: ((diff.visitors / phMetrics.visitors) * 100).toFixed(1),
        pageviews: ((diff.pageviews / phMetrics.pageViews) * 100).toFixed(1),
        sessions: ((diff.sessions / phMetrics.sessions) * 100).toFixed(1)
    };

    console.log(
        `Visitors:   PostHog=${phMetrics.visitors}  vs  Redshift=${rsMetrics.visitors}  (delta: ${diff.visitors}, ${pct.visitors}%)`
    );
    console.log(
        `Page views: PostHog=${phMetrics.pageViews}  vs  Redshift=${rsMetrics.pageviews}  (delta: ${diff.pageviews}, ${pct.pageviews}%)`
    );
    console.log(
        `Sessions:   PostHog=${phMetrics.sessions}  vs  Redshift=${rsMetrics.sessions}  (delta: ${diff.sessions}, ${pct.sessions}%)`
    );
    console.log("");

    if (Math.abs(parseFloat(pct.visitors)) < 5 && Math.abs(parseFloat(pct.pageviews)) < 5) {
        console.log("✅ MATCH: Data is consistent (< 5% difference)!");
    } else if (Math.abs(parseFloat(pct.visitors)) < 10 && Math.abs(parseFloat(pct.pageviews)) < 10) {
        console.log("✅ CLOSE: Acceptable difference (< 10%)");
    } else {
        console.log("⚠️  MISMATCH: Significant difference detected!");
        console.log("");
        console.log("Possible causes:");
        console.log("  - Redshift export not fully caught up for this period");
        console.log("  - Event sampling or filtering in export");
        console.log("  - Different event counting logic");
    }
}

compare().catch(console.error);
