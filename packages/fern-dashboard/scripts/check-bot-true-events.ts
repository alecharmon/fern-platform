import { config } from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { getRedshiftPool } from "../src/app/services/analytics/redshift-client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, "../.env.local") });

async function check() {
    const pool = getRedshiftPool();

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const result = await pool.query(
        `
    SELECT properties
    FROM posthog.events
    WHERE event = 'static_content_served'
    AND properties."domain"::VARCHAR = 'elevenlabs.io'
    AND timestamp >= $1
    LIMIT 200
  `,
        [sevenDaysAgo.toISOString()]
    );

    const botTrue = result.rows.filter((r: any) => {
        try {
            const props = typeof r.properties === "string" ? JSON.parse(r.properties) : r.properties;
            return props.possibleBot === true;
        } catch (_e) {
            return false;
        }
    });

    console.log("Total events checked:", result.rows.length);
    console.log("Events with possibleBot=true:", botTrue.length);
    console.log("Events with possibleBot=false:", result.rows.length - botTrue.length);

    if (botTrue.length > 0) {
        console.log("\nSample bot=true event:");
        const props =
            typeof botTrue[0].properties === "string" ? JSON.parse(botTrue[0].properties) : botTrue[0].properties;
        console.log(JSON.stringify(props, null, 2).substring(0, 800));
    }

    process.exit(0);
}

check().catch(console.error);
