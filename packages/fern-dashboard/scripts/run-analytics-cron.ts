#!/usr/bin/env npx tsx
/**
 * Run analytics cron job
 *
 * This script runs the analytics cron job to collect and store analytics
 * for all production docs sites. It's designed to be run from GitHub Actions
 * but can also be run manually.
 *
 * Usage:
 *   npx tsx packages/fern-dashboard/scripts/run-analytics-cron.ts
 *   npx tsx packages/fern-dashboard/scripts/run-analytics-cron.ts --periods 7,14,30
 */
import { config } from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { parseArgs } from "util";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env.local for local testing
config({ path: resolve(__dirname, "../.env.local") });

// Set NODE_ENV to test to allow server-only imports
process.env.NODE_ENV = "test";

async function main() {
    const { values } = parseArgs({
        options: {
            periods: { type: "string", default: "7,14,30" },
            help: { type: "boolean", short: "h" }
        },
        allowPositionals: false
    });

    if (values.help) {
        console.log(`
Run Analytics Cron Job

Usage:
  npx tsx scripts/run-analytics-cron.ts [options]

Options:
  --periods <days>  Comma-separated list of periods in days (default: 7,14,30)
  -h, --help        Show this help message

Environment Variables Required:
  - DATABASE_URL (PostgreSQL connection URL)
  - SUPABASE_SERVICE_ROLE_KEY
  - POSTHOG_REDSHIFT_DB_HOST
  - POSTHOG_REDSHIFT_DB_NAME (defaults to "dev")
  - POSTHOG_REDSHIFT_DB_USER
  - POSTHOG_REDSHIFT_DB_PASSWORD

For domain fetching (tries Docs KV first, falls back to FDR):
  - DOCS_KV_REST_API_URL (Docs KV - preferred, fast!)
  - DOCS_KV_REST_API_TOKEN (Docs KV - preferred, fast!)
  - NEXT_PUBLIC_CDN_URI (required for KV)
  - FDR_SERVER_URL (fallback if KV unavailable)
  - FERN_TOKEN (fallback if KV unavailable)
        `);
        process.exit(0);
    }

    // Parse periods
    const periods = values.periods!.split(",").map((p) => parseInt(p.trim(), 10));

    console.log("[run-analytics-cron] Starting analytics cron job");
    console.log(`[run-analytics-cron] Periods: ${periods.join(", ")} days`);

    try {
        // Import the analytics cron runner
        const { runAnalyticsCronForAllPeriods } = await import("../src/app/services/analyticsCron/run");

        const resultsByPeriod = await runAnalyticsCronForAllPeriods({ periods });

        // Aggregate results
        const allResults = Array.from(resultsByPeriod.values());
        const totalDuration = allResults.reduce(
            (sum, r) => sum + (new Date(r.completedAt).getTime() - new Date(r.startedAt).getTime()),
            0
        );

        console.log("[run-analytics-cron] Analytics cron job completed successfully", {
            periods: periods.join(", "),
            totalDuration: `${(totalDuration / 1000).toFixed(2)}s`
        });

        // Print summary
        for (const result of allResults) {
            const duration = new Date(result.completedAt).getTime() - new Date(result.startedAt).getTime();
            console.log(
                `[run-analytics-cron] Period ${result.period}d: ${result.totalSuccesses}/${result.totalSites} sites succeeded (${(duration / 1000).toFixed(2)}s)`
            );
        }

        process.exit(0);
    } catch (error) {
        console.error("[run-analytics-cron] Error running analytics cron job:", error);
        process.exit(1);
    }
}

main();
