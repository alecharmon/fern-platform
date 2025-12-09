import { config } from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, "../.env.local") });

import { getRedshiftPool } from "../src/app/services/analytics/redshift-client";

async function testQuery() {
    const pool = getRedshiftPool();
    const domain = "docs-sai.gov.nominal.io";

    console.log("=".repeat(80));
    console.log(`Testing Redshift Data Completeness for ${domain}`);
    console.log("=".repeat(80));
    console.log("");
    console.log("Checking data availability by week...");
    console.log("");

    // Test 1: Check total pageview count
    // Check data by week going back in time
    const weeks = [
        { name: "Dec 1-8 (current)", start: "2025-12-01", end: "2025-12-08" },
        { name: "Nov 24-Dec 1", start: "2025-11-24", end: "2025-12-01" },
        { name: "Nov 17-24", start: "2025-11-17", end: "2025-11-24" },
        { name: "Nov 10-17", start: "2025-11-10", end: "2025-11-17" },
        { name: "Nov 3-10", start: "2025-11-03", end: "2025-11-10" },
        { name: "Oct 27-Nov 3", start: "2025-10-27", end: "2025-11-03" },
        { name: "Oct 20-27", start: "2025-10-20", end: "2025-10-27" }
    ];

    console.log("Week-by-week event counts:");
    console.log("-".repeat(60));

    for (const week of weeks) {
        const query = `
            SELECT COUNT(*) as total_events
            FROM posthog.events
            WHERE
                event = '$pageview'
                AND timestamp >= $3
                AND timestamp < $4
                AND (
                    properties."$host"::VARCHAR = $1
                    OR properties."$host"::VARCHAR = $2
                )
        `;

        const result = await pool.query(query, [domain, `www.${domain}`, week.start, week.end]);
        const count = parseInt(result.rows[0]?.total_events) || 0;
        const icon = count > 0 ? "✓" : "✗";
        console.log(`${icon} ${week.name.padEnd(20)} ${count.toString().padStart(6)} events`);
    }
    console.log("-".repeat(60));
    console.log("");

    // Check total events across all domains (to see overall Redshift health)
    console.log("");
    console.log("Overall Redshift Health Check:");
    console.log("-".repeat(60));

    for (const week of weeks) {
        const query = `
            SELECT COUNT(*) as total_events
            FROM posthog.events
            WHERE
                event = '$pageview'
                AND timestamp >= $1
                AND timestamp < $2
        `;

        const result = await pool.query(query, [week.start, week.end]);
        const count = parseInt(result.rows[0]?.total_events) || 0;
        const icon = count > 1000 ? "✓" : count > 0 ? "⚠" : "✗";
        console.log(
            `${icon} ${week.name.padEnd(20)} ${count.toLocaleString().padStart(10)} total $pageview events (all domains)`
        );
    }
    console.log("-".repeat(60));
    console.log("");

    await pool.end();
}

testQuery().catch(console.error);
