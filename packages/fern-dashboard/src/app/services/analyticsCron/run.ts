import pLimit from "p-limit";

import { getAllProductionDomains } from "./getAllProductionDomains";
import { insertAnalyticsForSite } from "./insert";
import type { AnalyticsCronConfig, AnalyticsCronRunResult, DateRangePeriod, InsertAnalyticsResult } from "./types";

/**
 * Analytics Cron - Run
 *
 * Orchestrates the analytics cron job by processing production domains directly,
 * collecting analytics from PostHog, and storing them in Supabase.
 *
 * Uses domain-first parallelization with global PostHog rate limiting to respect
 * API concurrency limits while maximizing throughput.
 */
// Only enforce server-only in non-test environments
if (process.env.NODE_ENV !== "test") {
    require("server-only");
}

// Default concurrency limit for domain processing
// With 2-minute timeouts and pool=50, we can handle more concurrency
const DEFAULT_DOMAIN_CONCURRENCY = 10;

// Cache for production domains to avoid refetching
let cachedProductionDomains: string[] | null = null;

/**
 * Fetch all production domain names (cached)
 * Uses KV store (fast) with fallback to FDR if needed
 */
async function fetchAllProductionDomainsCached(): Promise<string[]> {
    if (cachedProductionDomains !== null) {
        return cachedProductionDomains;
    }

    const domains = await getAllProductionDomains();
    cachedProductionDomains = domains.map((d) => d.domain);
    return cachedProductionDomains;
}

/**
 * Process analytics for a single domain and period
 * @param overrideEndDate - Optional end date to use instead of "now" (for historical data processing)
 */
async function processDomain(
    domain: string,
    period: DateRangePeriod,
    overrideEndDate?: Date
): Promise<InsertAnalyticsResult> {
    const startTime = Date.now();
    console.info(`[processDomain] Processing ${domain} - ${period} days`);

    try {
        const result = await insertAnalyticsForSite(domain, period, overrideEndDate);
        const duration = Date.now() - startTime;
        const status = result.success ? "✓" : "✗";
        console.info(`[processDomain] ${status} Completed ${domain} - ${period} days - ${duration}ms`);
        return result;
    } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`[processDomain] ✗ Error processing ${domain} - ${period} days - ${duration}ms:`, error);
        return {
            success: false,
            docsSite: domain,
            docsOrg: null,
            error: error instanceof Error ? error.message : String(error)
        };
    }
}

/**
 * Process analytics for a single domain across all periods sequentially
 * Sequential processing allows PostHog to leverage caching for the same domain
 */
async function processDomainAllPeriods(
    domain: string,
    periods: DateRangePeriod[],
    overrideEndDate?: Date
): Promise<Map<DateRangePeriod, InsertAnalyticsResult>> {
    const results = new Map<DateRangePeriod, InsertAnalyticsResult>();
    const domainAllPeriodsStart = Date.now();

    console.info(`[processDomainAllPeriods] Starting ${domain} for ${periods.length} periods`);

    // Process periods sequentially to leverage PostHog caching
    for (const period of periods) {
        const result = await processDomain(domain, period, overrideEndDate);
        results.set(period, result);
    }

    const totalDuration = Date.now() - domainAllPeriodsStart;
    const successCount = Array.from(results.values()).filter((r) => r.success).length;
    console.info(
        `[processDomainAllPeriods] Finished ${domain} - ${successCount}/${periods.length} periods succeeded in ${totalDuration}ms (${(totalDuration / 1000).toFixed(1)}s)`
    );

    return results;
}

// Track progress across all domains
let globalCompletedCount = 0;
let globalTotalCount = 0;

export interface AnalyticsCronOptions {
    /** Maximum number of domains to process concurrently (default: 10) */
    domainConcurrency?: number;
    /** Filter by specific domains (can be provided multiple times) */
    domains?: string | string[];
}

/**
 * Run analytics cron job for all production domains
 *
 * @param config - Configuration for the cron run
 * @param options - Additional options for filtering and concurrency
 * @returns Results of the cron run
 */
export async function runAnalyticsCron(
    config: AnalyticsCronConfig,
    options: AnalyticsCronOptions & { endDate?: Date } = {}
): Promise<AnalyticsCronRunResult> {
    const startedAt = new Date().toISOString();
    const { period } = config;
    const { domainConcurrency = DEFAULT_DOMAIN_CONCURRENCY, domains: domainFilter, endDate: overrideEndDate } = options;

    // Normalize domain filters to array
    const domainFilters = domainFilter ? (Array.isArray(domainFilter) ? domainFilter : [domainFilter]) : [];
    const hasFilter = domainFilters.length > 0;

    console.info(`[runAnalyticsCron] Starting analytics cron for period: ${period} days`);
    if (hasFilter) {
        console.info(`[runAnalyticsCron] Filtering by domains: [${domainFilters.join(", ")}]`);
    }

    // Fetch all production domains (cached)
    let allDomains = await fetchAllProductionDomainsCached();

    // Filter domains if specified
    if (hasFilter) {
        allDomains = allDomains.filter((domain) => domainFilters.includes(domain));
    }

    console.info(`[runAnalyticsCron] Found ${allDomains.length} production domains to process`);

    // Create p-limit instance for concurrency control
    const domainLimit = pLimit(domainConcurrency);

    // Process all domains in parallel with p-limit concurrency control
    const results = await Promise.all(
        allDomains.map((domain) =>
            domainLimit(async () => {
                return processDomain(domain, period, overrideEndDate);
            })
        )
    );

    const completedAt = new Date().toISOString();

    // Calculate totals
    const totalSuccesses = results.filter((r) => r.success).length;
    const totalErrors = results.filter((r) => !r.success).length;
    const totalDuration = new Date(completedAt).getTime() - new Date(startedAt).getTime();

    console.info(
        `[runAnalyticsCron] Completed. Total: ${allDomains.length} domains, ${totalSuccesses} successes, ${totalErrors} errors - ${totalDuration}ms (${(totalDuration / 1000).toFixed(1)}s)`
    );

    return {
        startedAt,
        completedAt,
        period,
        orgResults: [], // Legacy field, kept for compatibility
        totalOrgs: 0, // Legacy field
        totalSites: allDomains.length,
        totalSuccesses,
        totalErrors
    };
}

// Org-based functions removed - we now process domains directly
// This simplifies the architecture since PostHog queries are domain-based, not org-based

/**
 * Run analytics cron for a single docs site
 *
 * @param docsSite - The docs site domain (e.g., "buildwithfern.com/learn" or "docs.example.com")
 * @param period - Date range period in days
 * @returns Results of the cron run for this site
 */
export async function runAnalyticsCronForSite(
    docsSite: string,
    period: DateRangePeriod,
    overrideEndDate?: Date
): Promise<InsertAnalyticsResult> {
    // Normalize the docs site URL (remove protocol, decode URL encoding)
    const normalizedSite = decodeURIComponent(docsSite)
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "");

    console.info(
        `[runAnalyticsCronForSite] Starting analytics cron for site: ${normalizedSite}, period: ${period} days`
    );

    try {
        const result = await insertAnalyticsForSite(normalizedSite, period, overrideEndDate);
        console.info(
            `[runAnalyticsCronForSite] Completed for ${normalizedSite}: ${result.success ? "success" : `error - ${result.error}`}`
        );
        return result;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[runAnalyticsCronForSite] Error processing ${normalizedSite}:`, error);
        return {
            success: false,
            docsSite: normalizedSite,
            docsOrg: null,
            error: errorMessage
        };
    }
}

/**
 * Run analytics cron for all supported date range periods
 * This is useful for initial data population or catch-up jobs
 *
 * Uses domain-first parallelization: processes domains in parallel (pLimit 10) but
 * runs all periods sequentially for each domain to leverage PostHog caching
 *
 * @param options - Additional options (supports domain filtering)
 */
export async function runAnalyticsCronForAllPeriods(
    options: AnalyticsCronOptions & { endDate?: Date; periods?: DateRangePeriod[] } = {}
): Promise<Map<DateRangePeriod, AnalyticsCronRunResult>> {
    const periods: DateRangePeriod[] = options.periods || [7, 14, 30];
    const startedAt = new Date().toISOString();
    const runStart = Date.now();

    const { domainConcurrency = DEFAULT_DOMAIN_CONCURRENCY, domains: domainFilter, endDate: overrideEndDate } = options;

    // Normalize domain filters to array
    const domainFilters = domainFilter ? (Array.isArray(domainFilter) ? domainFilter : [domainFilter]) : [];
    const hasFilter = domainFilters.length > 0;

    console.info(`[runAnalyticsCronForAllPeriods] Starting analytics cron for periods: ${periods.join(", ")} days`);
    if (hasFilter) {
        console.info(`[runAnalyticsCronForAllPeriods] Filtering by domains: [${domainFilters.join(", ")}]`);
    }

    // Fetch all production domains (cached)
    let allDomains = await fetchAllProductionDomainsCached();

    // Filter domains if specified
    if (hasFilter) {
        allDomains = allDomains.filter((domain) => domainFilters.includes(domain));
    }

    console.info(`[runAnalyticsCronForAllPeriods] Found ${allDomains.length} production domains to process`);

    // Initialize global progress tracking
    globalCompletedCount = 0;
    globalTotalCount = allDomains.length;

    // Create p-limit instance for concurrency control
    const domainLimit = pLimit(domainConcurrency);

    // Process all domains in parallel, but each domain's periods sequentially to leverage PostHog caching
    const domainResultsByPeriod = await Promise.all(
        allDomains.map((domain, index) =>
            domainLimit(async () => {
                console.info(
                    `[runAnalyticsCronForAllPeriods] Processing domain ${index + 1}/${allDomains.length}: ${domain} for ${periods.length} periods`
                );
                const result = await processDomainAllPeriods(domain, periods, overrideEndDate);
                globalCompletedCount++;
                console.info(
                    `\n${"=".repeat(60)}\n✅ Progress: ${globalCompletedCount}/${globalTotalCount} domains completed (${((globalCompletedCount / globalTotalCount) * 100).toFixed(1)}%)\n${"=".repeat(60)}\n`
                );
                return result;
            })
        )
    );

    const completedAt = new Date().toISOString();
    const totalDuration = Date.now() - runStart;

    // Transform results into Map<DateRangePeriod, AnalyticsCronRunResult>
    const resultsByPeriod = new Map<DateRangePeriod, AnalyticsCronRunResult>();

    for (const period of periods) {
        const allResults: InsertAnalyticsResult[] = [];

        // Collect all results for this period across all domains
        for (const domainPeriodResults of domainResultsByPeriod) {
            const result = domainPeriodResults.get(period);
            if (result) {
                allResults.push(result);
            }
        }

        const totalSuccesses = allResults.filter((r) => r.success).length;
        const totalErrors = allResults.filter((r) => !r.success).length;

        resultsByPeriod.set(period, {
            startedAt,
            completedAt,
            period,
            orgResults: [], // Legacy field, kept for compatibility
            totalOrgs: 0, // Legacy field
            totalSites: allDomains.length,
            totalSuccesses,
            totalErrors
        });

        console.info(
            `[runAnalyticsCronForAllPeriods] Completed period ${period} days. Total: ${allDomains.length} domains, ${totalSuccesses} successes, ${totalErrors} errors`
        );
    }

    console.info(
        `[runAnalyticsCronForAllPeriods] All periods completed in ${totalDuration}ms (${(totalDuration / 1000).toFixed(1)}s)`
    );

    return resultsByPeriod;
}

// CLI Support - Only run if executed directly
if (process.argv[1]?.includes("analyticsCron/run.ts")) {
    // Load environment variables and run CLI
    (async () => {
        try {
            const dotenv = await import("dotenv");
            const path = await import("path");
            const { fileURLToPath } = await import("url");
            const { parseArgs } = await import("util");

            const __filename = fileURLToPath(import.meta.url);
            const __dirname = path.dirname(__filename);
            dotenv.config({
                path: path.resolve(__dirname, "../../../../.env.local")
            });

            const { values } = parseArgs({
                options: {
                    site: { type: "string" },
                    domain: { type: "string", multiple: true },
                    period: { type: "string", default: "7,14,30" },
                    endDate: { type: "string" },
                    help: { type: "boolean", short: "h" }
                },
                allowPositionals: false
            });

            if (values.help) {
                console.log(`
Analytics Cron Runner

Usage:
  NODE_ENV=test npx tsx src/app/services/analyticsCron/run.ts [options]

Options:
  --site <domain>     Specific docs site domain (e.g., "docs.vapi.ai")
  --domain <domain>   Filter by specific domain(s) (can be specified multiple times)
  --period <days>     Date range period(s): 7, 14, 30, 90, or 180 (default: "7,14,30,90")
                      Supports comma-separated values
                      By default, processes all periods sequentially per domain
  --endDate <date>    End date for historical processing (YYYY-MM-DD format, e.g., "2025-11-10")
                      If specified, period will end on this date instead of today
  -h, --help          Show this help message

Examples:
  # All domains with all periods (default behavior)
  NODE_ENV=test npx tsx src/app/services/analyticsCron/run.ts

  # Specific site with all periods
  NODE_ENV=test npx tsx src/app/services/analyticsCron/run.ts --site=docs.vapi.ai

  # Multiple domains with single period
  NODE_ENV=test npx tsx src/app/services/analyticsCron/run.ts --domain=docs.vapi.ai --domain=openrouter.ai --period=7

Note: When processing multiple periods, domains are processed in batches of 3 with all
      periods completed sequentially per domain to maximize PostHog cache efficiency.
                `);
                process.exit(0);
            }

            // Parse end date if provided
            let endDate: Date | undefined;
            if (values.endDate) {
                endDate = new Date(values.endDate + "T00:00:00Z");
                if (isNaN(endDate.getTime())) {
                    console.error(`Invalid endDate format: ${values.endDate}. Use YYYY-MM-DD format.`);
                    process.exit(1);
                }
                console.log(`Using end date override: ${endDate.toISOString().split("T")[0]}`);
            }

            // Parse periods (supports comma-separated)
            const periodStrings = (values.period || "7,14,30,90").split(",").map((s) => s.trim());
            const validPeriods = [7, 14, 30, 90, 180];
            const periods: DateRangePeriod[] = [];

            for (const periodStr of periodStrings) {
                const periodNum = parseInt(periodStr, 10);
                if (!validPeriods.includes(periodNum)) {
                    console.error(`Invalid period: ${periodNum}. Must be one of: ${validPeriods.join(", ")}`);
                    process.exit(1);
                }
                periods.push(periodNum as DateRangePeriod);
            }

            // Handle different execution modes
            if (values.site) {
                // For single site, run each period sequentially
                for (const period of periods) {
                    if (periods.length > 1) {
                        console.log(`\n${"=".repeat(60)}`);
                        console.log(`Running for period: ${period} days`);
                        console.log("=".repeat(60));
                    }

                    console.log(`Running analytics cron for site: ${values.site}, period: ${period} days`);
                    const result = await runAnalyticsCronForSite(values.site, period, endDate);
                    console.log("\nResults:");
                    console.log(JSON.stringify(result, null, 2));
                }
            } else {
                // For all domains (or filtered domains), use domain-first parallelization with sequential periods
                const domains = values.domain;
                const hasFilter = domains && domains.length > 0;

                if (periods.length === 1) {
                    // Single period
                    const period = periods[0]!; // Safe: length check ensures this exists
                    if (hasFilter) {
                        console.log(`Running analytics cron for ${domains.length} domain(s), period: ${period} days`);
                    } else {
                        console.log(`Running analytics cron for all domains, period: ${period} days`);
                    }

                    const result = await runAnalyticsCron({ period }, { domains: domains, endDate });

                    console.log("\nResults Summary:");
                    console.log(`  Total domains: ${result.totalSites}`);
                    console.log(`  Successes: ${result.totalSuccesses}`);
                    console.log(`  Errors: ${result.totalErrors}`);
                    console.log(
                        `  Duration: ${new Date(result.completedAt).getTime() - new Date(result.startedAt).getTime()}ms`
                    );
                } else {
                    // Multiple periods
                    if (hasFilter) {
                        console.log(
                            `Running analytics cron for ${domains.length} domain(s), periods: ${periods.join(", ")} days (domain-first parallelization)`
                        );
                    } else {
                        console.log(
                            `Running analytics cron for all domains, periods: ${periods.join(", ")} days (domain-first parallelization)`
                        );
                    }

                    const resultsByPeriod = await runAnalyticsCronForAllPeriods({
                        domains: domains,
                        endDate,
                        periods // Pass the parsed periods from CLI
                    });

                    for (const [period, result] of resultsByPeriod.entries()) {
                        console.log(`\n${"=".repeat(60)}`);
                        console.log(`Period: ${period} days`);
                        console.log("=".repeat(60));
                        console.log(`  Total domains: ${result.totalSites}`);
                        console.log(`  Successes: ${result.totalSuccesses}`);
                        console.log(`  Errors: ${result.totalErrors}`);
                        console.log(
                            `  Duration: ${new Date(result.completedAt).getTime() - new Date(result.startedAt).getTime()}ms`
                        );
                    }
                }
            }
        } catch (error) {
            console.error("Error running analytics cron:", error);
            process.exit(1);
        }
    })();
}
