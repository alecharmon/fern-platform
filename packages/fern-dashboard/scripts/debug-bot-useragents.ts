import { config } from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { getRedshiftPool } from "../src/app/services/analytics/redshift-client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, "../.env.local") });

async function debug() {
    const pool = getRedshiftPool();
    const domain = "elevenlabs.io";

    const dayjs = (await import("dayjs")).default;
    const utc = (await import("dayjs/plugin/utc")).default;
    dayjs.extend(utc);

    const endDateDay = dayjs().utc();
    const startDateDay = endDateDay.subtract(28, "days");

    // Get sample user agents from events
    const result = await pool.query(
        `
    SELECT properties
    FROM posthog.events
    WHERE event = 'static_content_served'
    AND properties."domain"::VARCHAR = $1
    AND timestamp >= $2
    AND timestamp < $3
    LIMIT 100
  `,
        [domain, startDateDay.startOf("day").toDate().toISOString(), endDateDay.endOf("day").toDate().toISOString()]
    );

    console.log(`Got ${result.rows.length} events`);
    console.log("\nSample user agents:");

    const userAgents = new Set<string>();
    const botEvents: any[] = [];

    for (const row of result.rows) {
        const props = typeof row.properties === "string" ? JSON.parse(row.properties) : row.properties;
        const ua = props.userAgent || "NO_UA";
        userAgents.add(ua);

        if (props.possibleBot === true) {
            botEvents.push(props);
        }
    }

    Array.from(userAgents)
        .slice(0, 10)
        .forEach((ua, i) => {
            console.log(`${i + 1}. ${ua.substring(0, 100)}`);
        });

    console.log(`\n\nTotal bot events (possibleBot=true): ${botEvents.length}`);
    if (botEvents.length > 0) {
        console.log("\nSample bot event:");
        console.log("  User Agent:", botEvents[0].userAgent?.substring(0, 100));
        console.log("  Path:", botEvents[0].path);
        console.log("  staticContentType:", botEvents[0].staticContentType);
    }

    process.exit(0);
}

debug().catch(console.error);
