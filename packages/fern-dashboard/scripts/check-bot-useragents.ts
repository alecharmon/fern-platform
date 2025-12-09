import { config } from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { getRedshiftPool } from "../src/app/services/analytics/redshift-client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, "../.env.local") });

async function check() {
    const pool = getRedshiftPool();

    // Check for bot user agents
    const query = `
        SELECT
            COUNT(*) as count
        FROM posthog.events
        WHERE
            event = 'static_content_served'
            AND properties."domain"::VARCHAR = 'elevenlabs.io'
            AND timestamp >= '2025-12-01'
            AND timestamp < '2025-12-08'
            AND (
                properties."userAgent"::VARCHAR ILIKE '%bot%'
                OR properties."userAgent"::VARCHAR ILIKE '%crawler%'
                OR properties."userAgent"::VARCHAR ILIKE '%spider%'
            )
    `;

    const result = await pool.query(query);
    console.log("Events with bot/crawler/spider in userAgent:", result.rows[0]);

    // Sample some user agents
    const sampleQuery = `
        SELECT DISTINCT
            properties."userAgent"::VARCHAR as user_agent
        FROM posthog.events
        WHERE
            event = 'static_content_served'
            AND properties."domain"::VARCHAR = 'elevenlabs.io'
            AND timestamp >= '2025-12-01'
            AND timestamp < '2025-12-08'
        LIMIT 10
    `;

    const sampleResult = await pool.query(sampleQuery);
    console.log("\nSample user agents:");
    for (const row of sampleResult.rows) {
        console.log(`  ${row.user_agent}`);
    }

    await pool.end();
}

check().catch(console.error);
