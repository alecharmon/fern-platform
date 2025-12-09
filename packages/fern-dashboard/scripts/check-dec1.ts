import { config } from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { getRedshiftPool } from "../src/app/services/analytics/redshift-client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, "../.env.local") });

async function check() {
    const pool = getRedshiftPool();

    // Check Dec 1 data for elevenlabs.io
    const query = `
        SELECT
            DATE(timestamp) as date,
            COUNT(*) as pageviews,
            COUNT(DISTINCT distinct_id) as visitors
        FROM posthog.events
        WHERE
            event = '$pageview'
            AND (
                properties."$host"::VARCHAR = 'elevenlabs.io'
                OR properties."$host"::VARCHAR = 'www.elevenlabs.io'
            )
            AND timestamp >= '2025-12-01'
            AND timestamp < '2025-12-02'
        GROUP BY DATE(timestamp)
    `;

    const result = await pool.query(query);
    console.log("Redshift data for elevenlabs.io on Dec 1:");
    console.log(result.rows[0]);

    await pool.end();
}

check().catch(console.error);
