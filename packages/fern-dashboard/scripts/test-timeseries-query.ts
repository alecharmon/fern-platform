import { config } from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { getRedshiftPool } from "../src/app/services/analytics/redshift-client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, "../.env.local") });

async function test() {
    const pool = getRedshiftPool();
    const domain = "elevenlabs.io";

    // Query time series data
    const query = `
        SELECT
            DATE(timestamp) as date,
            COUNT(*) as count
        FROM posthog.events
        WHERE
            event = '$pageview'
            AND (
                properties."$host"::VARCHAR = $1
                OR properties."$host"::VARCHAR = $2
            )
            AND timestamp >= $3
            AND timestamp < $4
        GROUP BY DATE(timestamp)
        ORDER BY date
    `;

    const result = await pool.query(query, [
        domain,
        `www.${domain}`,
        new Date("2025-12-01T00:00:00Z").toISOString(),
        new Date("2025-12-08T00:00:00Z").toISOString()
    ]);

    console.log("Time series query results for elevenlabs.io:");
    console.log("-".repeat(60));
    for (const row of result.rows) {
        const dateStr = row.date.toISOString().split("T")[0];
        console.log(`${dateStr}: ${row.count} pageviews`);
    }
    console.log("-".repeat(60));

    await pool.end();
}

test().catch(console.error);
