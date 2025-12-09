import { config } from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { getRedshiftPool } from "../src/app/services/analytics/redshift-client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, "../.env.local") });

async function test() {
    const pool = getRedshiftPool();

    console.log("Testing LLM bot traffic query for elevenlabs.io...");

    // Test query - simplified
    const query = `
        SELECT
            COUNT(*) as total_bot_events,
            SUM(CASE WHEN properties."possibleBot"::VARCHAR = 'true' THEN 1 ELSE 0 END) as bot_true_count
        FROM posthog.events
        WHERE
            event = 'static_content_served'
            AND properties."domain"::VARCHAR = 'elevenlabs.io'
            AND timestamp >= '2025-12-01'
            AND timestamp < '2025-12-08'
    `;

    const result = await pool.query(query);
    console.log("Result:", result.rows[0]);

    await pool.end();
}

test().catch(console.error);
