import dayjs from "dayjs";
import { config } from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { RedshiftAnalytics } from "../src/app/services/analytics/redshift-analytics";
import { getAnalyticsService } from "../src/app/services/posthog";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, "../.env.local") });

const endDate = "2025-12-09";
const startDate = dayjs(endDate).subtract(7, "days").format("YYYY-MM-DD");

async function compare() {
    const domain = "elevenlabs.io";

    console.log("=".repeat(80));
    console.log(`Comparing ${domain}: ${startDate} to ${endDate}`);
    console.log("=".repeat(80));
    console.log("");

    // 1. PostHog API - overall metrics
    console.log("1. PostHog API - Overall Metrics");
    const posthog = getAnalyticsService({ userId: "test", baseSiteUrl: domain });
    const phMetrics = await posthog.getMetrics({
        dateRange: {
            type: "custom_range",
            startDate,
            endDate
        }
    });
    console.log("   Result:", phMetrics);
    console.log("");

    // PostHog API - daily breakdown
    console.log("   PostHog - Daily Breakdown:");
    const phDaily = await posthog.getVisitorsTimeSeries({
        dateRange: {
            type: "custom_range",
            startDate,
            endDate
        }
    });
    console.log("   " + "-".repeat(60));
    console.log("   Date         Visitors");
    console.log("   " + "-".repeat(60));
    for (const day of phDaily) {
        console.log(`   ${day.date}  ${day.value.toString().padStart(10)}`);
    }
    console.log("   " + "-".repeat(60));
    console.log("");

    // 2. Redshift - overall metrics
    console.log("2. Redshift - Overall Metrics");
    const redshift = new RedshiftAnalytics(domain);
    const rsMetrics = await redshift.getMetrics({
        dateRange: {
            startDate: new Date(startDate),
            endDate: new Date(endDate)
        }
    });
    console.log("   Result:", rsMetrics);
    console.log("");

    // Redshift - daily breakdown
    console.log("   Redshift - Daily Breakdown:");
    const rsDaily = await redshift.getVisitorsTimeSeries({
        dateRange: {
            startDate: new Date(startDate),
            endDate: new Date(endDate)
        }
    });
    console.log("   " + "-".repeat(60));
    console.log("   Date         Visitors");
    console.log("   " + "-".repeat(60));
    for (const day of rsDaily) {
        console.log(`   ${day.date}  ${day.count.toString().padStart(10)}`);
    }
    console.log("   " + "-".repeat(60));
    console.log("");

    // 3. Supabase cache (if exists)
    console.log("3. Supabase cache (checking for Dec 1-8 period)...");

    // Compare
    console.log("=".repeat(80));
    console.log("COMPARISON:");
    console.log("=".repeat(80));
    const diff = {
        visitors: phMetrics.visitors - rsMetrics.visitors,
        pageviews: phMetrics.pageViews - rsMetrics.pageviews
    };
    const pct = {
        visitors: ((diff.visitors / phMetrics.visitors) * 100).toFixed(1),
        pageviews: ((diff.pageviews / phMetrics.pageViews) * 100).toFixed(1)
    };

    console.log(
        `Visitors:   PostHog=${phMetrics.visitors}  vs  Redshift=${rsMetrics.visitors}  (delta: ${diff.visitors}, ${pct.visitors}%)`
    );
    console.log(
        `Page views: PostHog=${phMetrics.pageViews}  vs  Redshift=${rsMetrics.pageviews}  (delta: ${diff.pageviews}, ${pct.pageviews}%)`
    );

    if (Math.abs(parseFloat(pct.visitors)) < 5) {
        console.log("\n✅ MATCH: Data is consistent!");
    } else {
        console.log(`\n⚠️  ${Math.abs(parseFloat(pct.visitors))}% difference - import may still be catching up`);
    }
}

compare().catch(console.error);
