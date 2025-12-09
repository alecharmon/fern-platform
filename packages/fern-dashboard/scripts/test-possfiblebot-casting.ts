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

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoISO = sevenDaysAgo.toISOString();

    console.log("Testing different ways to access possibleBot...\n");

    // Test 1: Direct comparison without cast
    const test1 = await pool.query(
        `
    SELECT COUNT(*) as count
    FROM posthog.events
    WHERE event = 'static_content_served'
    AND properties."domain"::VARCHAR = $1
    AND timestamp >= $2
    AND properties."possibleBot" = true
  `,
        [domain, sevenDaysAgoISO]
    );
    console.log("1. Direct = true (no cast):", test1.rows[0]?.count || 0);

    // Test 2: Cast to VARCHAR and compare to string
    const test2 = await pool.query(
        `
    SELECT COUNT(*) as count
    FROM posthog.events
    WHERE event = 'static_content_served'
    AND properties."domain"::VARCHAR = $1
    AND timestamp >= $2
    AND properties."possibleBot"::VARCHAR = 'true'
  `,
        [domain, sevenDaysAgoISO]
    );
    console.log("2. ::VARCHAR = 'true':", test2.rows[0]?.count || 0);

    // Test 3: Cast to BOOLEAN
    const test3 = await pool.query(
        `
    SELECT COUNT(*) as count
    FROM posthog.events
    WHERE event = 'static_content_served'
    AND properties."domain"::VARCHAR = $1
    AND timestamp >= $2
    AND properties."possibleBot"::BOOLEAN = true
  `,
        [domain, sevenDaysAgoISO]
    );
    console.log("3. ::BOOLEAN = true:", test3.rows[0]?.count || 0);

    // Test 4: Sample values - check what we actually get
    const test4 = await pool.query(
        `
    SELECT
      properties."possibleBot" as bot1,
      properties."domain" as domain1
    FROM posthog.events
    WHERE event = 'static_content_served'
    AND properties."domain"::VARCHAR = $1
    AND timestamp >= $2
    LIMIT 10
  `,
        [domain, sevenDaysAgoISO]
    );
    console.log("\n4. Sample raw values from Redshift:");
    test4.rows.slice(0, 5).forEach((row, i) => {
        console.log(`   Row ${i + 1}:`, {
            possibleBot: row.bot1,
            possibleBotType: typeof row.bot1,
            domain: row.domain1,
            domainType: typeof row.domain1
        });
    });

    process.exit(0);
}

test().catch(console.error);
