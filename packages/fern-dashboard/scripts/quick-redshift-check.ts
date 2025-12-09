import { config } from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { RedshiftAnalytics } from "../src/app/services/analytics/redshift-analytics";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, "../.env.local") });

async function check() {
    const redshift = new RedshiftAnalytics("launchdarkly.com");

    console.log("Redshift data for launchdarkly.com (Nov 30 - Dec 7):");
    const metrics = await redshift.getMetrics({
        dateRange: {
            startDate: new Date("2025-11-30T00:00:00Z"),
            endDate: new Date("2025-12-07T00:00:00Z")
        }
    });

    console.log(metrics);
}

check().catch(console.error);
