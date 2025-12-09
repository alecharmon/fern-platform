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

    console.log("Testing SUPER column accessors for booleans...\n");

    // According to Redshift docs, for SUPER columns we might need different syntax
    // Let's test various approaches

    // Test 1: Check what possibleBot looks like when selected
    const test1 = await pool.query(
        `
    SELECT
      properties."possibleBot",
      properties."staticContentType"
    FROM posthog.events
    WHERE event = 'static_content_served'
    AND properties."domain"::VARCHAR = $1
    AND timestamp >= $2
    LIMIT 1
  `,
        [domain, sevenDaysAgoISO]
    );

    console.log("1. Raw SUPER values:");
    console.log("   possibleBot:", test1.rows[0]?.possibleBot);
    console.log("   staticContentType:", test1.rows[0]?.staticContentType);

    //  Test 2: Try with SUPER accessor
    try {
        const test2 = await pool.query(
            `
      SELECT COUNT(*) as count
      FROM posthog.events
      WHERE event = 'static_content_served'
      AND properties."domain"::VARCHAR = $1
      AND timestamp >= $2
      AND properties.possibleBot = true
    `,
            [domain, sevenDaysAgoISO]
        );
        console.log("\n2. properties.possibleBot = true (no quotes):", test2.rows[0]?.count || 0);
    } catch (e: any) {
        console.log("\n2. properties.possibleBot = true (no quotes): ERROR -", e.message.split("\n")[0]);
    }

    process.exit(0);
}

test().catch(console.error);
