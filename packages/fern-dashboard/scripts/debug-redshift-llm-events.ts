import { config } from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { getRedshiftPool } from "../src/app/services/analytics/redshift-client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, "../.env.local") });

async function debug() {
    const pool = getRedshiftPool();
    const domain = "elevenlabs.io";

    console.log("🔍 Debugging Redshift LLM bot events for", domain);
    console.log("─".repeat(80));

    // Use date calculations in JavaScript instead of Redshift
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoISO = sevenDaysAgo.toISOString();

    // 1. Check total static_content_served events
    const totalEventsQuery = `
    SELECT COUNT(*) as count
    FROM posthog.events
    WHERE event = 'static_content_served'
    AND (
      properties."domain"::VARCHAR = $1
      OR properties."domain"::VARCHAR = $2
    )
    AND timestamp >= $3
  `;

    const totalResult = await pool.query(totalEventsQuery, [domain, `www.${domain}`, sevenDaysAgoISO]);
    console.log("\n1. Total static_content_served events (last 7 days):", totalResult.rows[0]?.count || 0);

    // 2. Check events with staticContentType filter
    const staticTypeQuery = `
    SELECT
      properties."staticContentType"::VARCHAR as type,
      COUNT(*) as count
    FROM posthog.events
    WHERE event = 'static_content_served'
    AND (
      properties."domain"::VARCHAR = $1
      OR properties."domain"::VARCHAR = $2
    )
    AND timestamp >= $3
    GROUP BY properties."staticContentType"::VARCHAR
    ORDER BY count DESC
  `;

    const typeResult = await pool.query(staticTypeQuery, [domain, `www.${domain}`, sevenDaysAgoISO]);
    console.log("\n2. Events by staticContentType:");
    for (const row of typeResult.rows) {
        console.log(`   ${row.type || "null"}: ${row.count}`);
    }

    // 3. Check possibleBot property values
    const botQuery = `
    SELECT
      properties."possibleBot"::VARCHAR as bot_value,
      COUNT(*) as count
    FROM posthog.events
    WHERE event = 'static_content_served'
    AND (
      properties."domain"::VARCHAR = $1
      OR properties."domain"::VARCHAR = $2
    )
    AND timestamp >= $3
    GROUP BY properties."possibleBot"::VARCHAR
    ORDER BY count DESC
  `;

    const botResult = await pool.query(botQuery, [domain, `www.${domain}`, sevenDaysAgoISO]);
    console.log("\n3. possibleBot values:");
    for (const row of botResult.rows) {
        console.log(`   ${row.bot_value}: ${row.count}`);
    }

    // 4. Sample raw events - get entire properties JSON
    const sampleQuery = `
    SELECT properties
    FROM posthog.events
    WHERE event = 'static_content_served'
    AND (
      properties."domain"::VARCHAR = $1
      OR properties."domain"::VARCHAR = $2
    )
    AND timestamp >= $3
    LIMIT 5
  `;

    const sampleResult = await pool.query(sampleQuery, [domain, `www.${domain}`, sevenDaysAgoISO]);
    console.log("\n4. Sample event properties (first 3):");
    for (let i = 0; i < Math.min(3, sampleResult.rows.length); i++) {
        const row = sampleResult.rows[i];
        console.log(`\n   Event ${i + 1}:`, JSON.stringify(row.properties, null, 2).substring(0, 500));
    }

    // 5. Check if our WHERE conditions match anything
    const matchQuery = `
    SELECT COUNT(*) as count
    FROM posthog.events
    WHERE event = 'static_content_served'
    AND (
      properties."domain"::VARCHAR = $1
      OR properties."domain"::VARCHAR = $2
    )
    AND timestamp >= $3
    AND (
      properties."possibleBot"::BOOLEAN = true
      OR properties."userAgent"::VARCHAR ILIKE '%bot%'
      OR properties."userAgent"::VARCHAR ILIKE '%crawler%'
      OR properties."userAgent"::VARCHAR ILIKE '%spider%'
    )
    AND properties."staticContentType"::VARCHAR IN ('llms.txt', 'llms-full.txt', 'markdown')
  `;

    const matchResult = await pool.query(matchQuery, [domain, `www.${domain}`, sevenDaysAgoISO]);
    console.log("\n5. Events matching our full WHERE clause:", matchResult.rows[0]?.count || 0);

    console.log("\n" + "─".repeat(80));
    process.exit(0);
}

debug().catch(console.error);
