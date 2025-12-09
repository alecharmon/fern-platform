import { config } from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { getRedshiftPool } from "../src/app/services/analytics/redshift-client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, "../.env.local") });

async function monitorImport() {
    const pool = getRedshiftPool();

    console.log("=".repeat(80));
    console.log("Monitoring Redshift Import Progress");
    console.log("=".repeat(80));
    console.log("");

    // Check event counts by date
    const query = `
        SELECT
            DATE(timestamp) as date,
            COUNT(*) as events,
            COUNT(DISTINCT distinct_id) as unique_users
        FROM posthog.events
        WHERE
            event = '$pageview'
            AND timestamp >= '2025-11-20'
            AND timestamp < '2025-12-09'
        GROUP BY DATE(timestamp)
        ORDER BY date DESC
    `;

    const result = await pool.query(query);

    console.log("Daily $pageview event counts (all domains):");
    console.log("-".repeat(80));
    console.log("Date         Events      Unique Users    Status");
    console.log("-".repeat(80));

    let previousCount = 0;
    for (const row of result.rows) {
        const date = row.date;
        const events = parseInt(row.events);
        const users = parseInt(row.unique_users);

        let status = "";
        if (events === 0) {
            status = "✗ NO DATA";
        } else if (events < 50000) {
            status = "⚠️  INCOMPLETE";
        } else if (previousCount > 0 && Math.abs(events - previousCount) / previousCount > 0.5) {
            status = "⚠️  ANOMALY";
        } else {
            status = "✓ OK";
        }

        console.log(
            `${date}  ${events.toLocaleString().padStart(10)}  ${users.toLocaleString().padStart(12)}    ${status}`
        );
        previousCount = events;
    }

    console.log("-".repeat(80));
    console.log("");

    // Check most recent event
    const latestQuery = `
        SELECT
            MAX(timestamp) as latest_event
        FROM posthog.events
        WHERE event = '$pageview'
    `;

    const latestResult = await pool.query(latestQuery);
    const latestEvent = latestResult.rows[0]?.latest_event;

    console.log(`Latest event timestamp: ${latestEvent}`);
    console.log(`Current time: ${new Date().toISOString()}`);

    if (latestEvent) {
        const lag = Date.now() - new Date(latestEvent).getTime();
        const lagHours = (lag / (1000 * 60 * 60)).toFixed(1);
        console.log(`Data lag: ${lagHours} hours behind real-time`);

        if (lag < 3600000) {
            console.log("✅ Import is current (< 1 hour lag)");
        } else if (lag < 86400000) {
            console.log(`⚠️  Import is ${lagHours} hours behind`);
        } else {
            console.log(`⚠️  Import is ${(lag / 86400000).toFixed(1)} days behind`);
        }
    }

    await pool.end();
}

monitorImport().catch(console.error);
