import { config } from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { RedshiftAnalytics } from "../src/app/services/analytics/redshift-analytics";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, "../.env.local") });

async function test() {
    const redshift = new RedshiftAnalytics("elevenlabs.io");

    const dayjs = (await import("dayjs")).default;
    const utc = (await import("dayjs/plugin/utc")).default;
    dayjs.extend(utc);

    const endDateDay = dayjs().utc();
    const startDateDay = endDateDay.subtract(28, "days");

    const result = await redshift.getLLMBotTrafficByProvider({
        dateRange: {
            startDate: startDateDay.startOf("day").toDate(),
            endDate: endDateDay.endOf("day").toDate()
        },
        limit: 10
    });

    console.log("LLM Bot Traffic from Redshift for elevenlabs.io:");
    console.log(JSON.stringify(result, null, 2));

    if (result.length === 0) {
        console.log("\n⚠️  No bot traffic data found in Redshift");
        console.log("This could mean:");
        console.log("  1. elevenlabs.io has no LLM bot traffic");
        console.log("  2. The query conditions are too restrictive");
        console.log("  3. Events aren't being tracked");
    }
}

test().catch(console.error);
