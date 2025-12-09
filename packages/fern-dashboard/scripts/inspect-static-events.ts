import { config } from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { getRedshiftPool } from "../src/app/services/analytics/redshift-client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, "../.env.local") });

async function check() {
    const pool = getRedshiftPool();

    // Get sample events WITHOUT filtering by specific properties
    const query = `
        SELECT
            properties
        FROM posthog.events
        WHERE
            event = 'static_content_served'
            AND timestamp >= '2025-12-01'
            AND timestamp < '2025-12-08'
        LIMIT 3
    `;

    const result = await pool.query(query);
    console.log("Sample static_content_served events (raw properties):");
    for (const row of result.rows) {
        console.log("\nEvent:", JSON.stringify(row.properties, null, 2));
    }

    await pool.end();
}

check().catch(console.error);
