import { config } from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { RedshiftAnalytics } from "../src/app/services/analytics/redshift-analytics";
import { getAnalyticsService } from "../src/app/services/posthog";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, "../.env.local") });

async function testDomain(domain: string) {
    console.log(`\nTesting ${domain}:`);

    // PostHog
    const posthog = getAnalyticsService({ userId: "test", baseSiteUrl: domain });
    const ph = await posthog.getMetrics({
        dateRange: { type: "last_n_days", days: 7 }
    });

    // Redshift
    const redshift = new RedshiftAnalytics(domain);
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    const rs = await redshift.getMetrics({ dateRange: { startDate, endDate } });

    const diff = {
        visitors: ph.visitors - rs.visitors,
        views: ph.pageViews - rs.pageviews
    };
    const pct = {
        visitors: ((diff.visitors / ph.visitors) * 100).toFixed(1),
        views: ((diff.views / ph.pageViews) * 100).toFixed(1)
    };

    console.log(`  PostHog:  ${ph.visitors} visitors, ${ph.pageViews} views`);
    console.log(`  Redshift: ${rs.visitors} visitors, ${rs.pageviews} views`);
    console.log(`  Missing:  ${diff.visitors} visitors (${pct.visitors}%), ${diff.views} views (${pct.views}%)`);
}

async function main() {
    const domains = ["launchdarkly.com", "buildwithfern.com", "docs.vapi.ai"];
    for (const domain of domains) {
        await testDomain(domain);
    }
}

main().catch(console.error);
