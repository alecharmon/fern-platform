import { config } from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, "../.env.local") });

import { getAnalyticsService } from "../src/app/services/posthog";

async function testPostHog() {
    const domain = "docs-sai.gov.nominal.io";

    console.log("=".repeat(80));
    console.log(`Testing PostHog API data for ${domain}`);
    console.log("=".repeat(80));
    console.log("");

    // All nominal domains
    const nominalDomains = [
        "docs-sai.gov.nominal.io",
        "docs-staging.azure.nominal.io",
        "docs-staging.gov.nominal.io",
        "docs-thernfrst.eu.nominal.io",
        "docs.euw2.nominal.io",
        "docs.nominal.io"
    ];

    const analytics = getAnalyticsService({
        userId: "test-user",
        baseSiteUrl: domain,
        additionalDomains: nominalDomains.filter((d) => d !== domain) // All except base
    });

    // Test Dec 1-8 (7 days)
    console.log("Querying PostHog for Dec 1-8 (7 days)...");
    const metrics = await analytics.getMetrics({
        dateRange: {
            type: "last_n_days",
            days: 7
        }
    });

    console.log("PostHog Result:", {
        visitors: metrics.visitors,
        pageViews: metrics.pageViews,
        sessions: metrics.sessions
    });
    console.log("");

    // Also get top pages to see if there's data
    console.log("Top pages from PostHog:");
    const topPages = await analytics.getTopPages({
        dateRange: {
            type: "last_n_days",
            days: 7
        },
        limit: 5,
        orderBy: "views",
        order: "desc"
    });

    console.log("Top pages:", topPages);
}

testPostHog().catch(console.error);
