import { config } from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { getRedshiftPool } from "../src/app/services/analytics/redshift-client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, "../.env.local") });

async function check() {
    const pool = getRedshiftPool();

    // Check if ANY static_content_served events exist for elevenlabs.io
    const query = `
        SELECT COUNT(*) as count
        FROM posthog.events
        WHERE
            event = 'static_content_served'
            AND timestamp >= '2025-12-01'
            AND timestamp < '2025-12-08'
            AND (
                properties."domain"::VARCHAR LIKE '%elevenlabs%'
                OR properties."host"::VARCHAR LIKE '%elevenlabs%'
                OR properties::VARCHAR LIKE '%elevenlabs%'
            )
    `;

    const result = await pool.query(query);
    console.log("Total static_content_served events for elevenlabs.io:", result.rows[0]);

    // Sample a few to see structure
    const sampleQuery = `
        SELECT
            properties."domain"::VARCHAR as domain,
            properties."host"::VARCHAR as host,
            properties."staticContentType"::VARCHAR as content_type,
            properties."possibleBot"::VARCHAR as possible_bot
        FROM posthog.events
        WHERE
            event = 'static_content_served'
            AND timestamp >= '2025-12-01'
            AND timestamp < '2025-12-08'
            AND properties::VARCHAR LIKE '%elevenlabs%'
        LIMIT 5
    `;

    const sampleResult = await pool.query(sampleQuery);
    console.log("\nSample events:", JSON.stringify(sampleResult.rows, null, 2));

    await pool.end();
}

check().catch(console.error);
