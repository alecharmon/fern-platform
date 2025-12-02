#!/usr/bin/env bun
import readline from "readline/promises";
import { parseArgs } from "util";
import { getAlgoliaAnalyticsService } from ".";

// ANSI color codes for pretty output
const colors = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    dim: "\x1b[2m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    cyan: "\x1b[36m",
    red: "\x1b[31m",
    magenta: "\x1b[35m"
};

function formatNumber(num: number): string {
    return new Intl.NumberFormat("en-US").format(num);
}

function formatPercentage(num: number): string {
    return num.toFixed(2) + "%";
}

function printHelp() {
    console.log(`
${colors.bright}Algolia Analytics CLI Test Tool${colors.reset}

${colors.yellow}Usage:${colors.reset}
  bun run algolia_sdk_test.ts --index <name> [data options] [time options]
  bun run algolia_sdk_test.ts --interactive
  bun run algolia_sdk_test.ts --help

${colors.yellow}Required Arguments:${colors.reset}
  Either --index <name> OR --interactive must be provided

${colors.yellow}Data Options (at least one required with --index):${colors.reset}
  --metrics            Show search metrics (count, no results rate, CTR)
  --top-searches       Show top searches by volume
  --no-results         Show searches with no results
  --time-series        Show search count over time
  --by-tag             Show searches filtered by tag (requires --tag)

${colors.yellow}Time Options (optional):${colors.reset}
  --days <number>      Number of days to analyze (default: 7)
  --weeks <number>     Number of weeks to analyze
  --months <number>    Number of months to analyze

${colors.yellow}Filter Options:${colors.reset}
  --tag <value>        Filter by analytics tag (e.g., "endpoint:openrouter.ai")
  --limit <number>     Limit results for tables (default: 50)

${colors.yellow}Other Options:${colors.reset}
  --help, -h           Show this help message
  --interactive, -i    Run in interactive mode (menu-driven)

${colors.yellow}Examples:${colors.reset}
  # Interactive mode (menu-driven)
  bun run algolia_sdk_test.ts --interactive

  # Get metrics for last 30 days
  bun run algolia_sdk_test.ts --index fern_docs_search --metrics --days 30

  # Get top searches
  bun run algolia_sdk_test.ts --index fern_docs_search --top-searches

  # Get searches with no results
  bun run algolia_sdk_test.ts --index fern_docs_search --no-results --limit 100

  # Get multiple analytics types
  bun run algolia_sdk_test.ts --index fern_docs_search --metrics --top-searches --no-results

  # Get searches by specific endpoint tag
  bun run algolia_sdk_test.ts --index fern_docs_search --by-tag --tag "endpoint:openrouter.ai"

  # Get time series for last 2 weeks
  bun run algolia_sdk_test.ts --index fern_docs_search --time-series --weeks 2
`);
}

async function displayMetrics(analytics: any, dateRange: any, tag?: string) {
    console.log(colors.dim + "\n⏳ Fetching search metrics..." + colors.reset);

    const metrics = await analytics.getSearchMetrics({ dateRange, tags: tag });

    console.log("\n" + colors.bright + colors.green + "━".repeat(50) + colors.reset);
    console.log(colors.bright + "🔍 Search Metrics Summary" + colors.reset);
    if (tag) {
        console.log(colors.dim + `   Filtered by tag: ${tag}` + colors.reset);
    }
    console.log(colors.bright + colors.green + "━".repeat(50) + colors.reset);
    console.log(`${colors.yellow}🔎 Total Searches:${colors.reset}      ${formatNumber(metrics.searchCount)}`);
    console.log(`${colors.red}❌ No Results Rate:${colors.reset}     ${formatPercentage(metrics.noResultsRate * 100)}`);
    if (metrics.clickThroughRate !== undefined) {
        console.log(
            `${colors.blue}👆 Click-Through Rate:${colors.reset}  ${formatPercentage(metrics.clickThroughRate * 100)}`
        );
    }
    if (metrics.conversionRate !== undefined) {
        console.log(
            `${colors.cyan}✅ Conversion Rate:${colors.reset}     ${formatPercentage(metrics.conversionRate * 100)}`
        );
    }
    console.log(colors.bright + colors.green + "━".repeat(50) + colors.reset);
}

async function displayTopSearches(analytics: any, dateRange: any, limit: number, tag?: string) {
    console.log(colors.dim + "\n⏳ Fetching top searches..." + colors.reset);

    const result = await analytics.getTopSearches({
        dateRange,
        limit,
        tags: tag
    });

    console.log("\n" + colors.bright + colors.blue + "━".repeat(80) + colors.reset);
    console.log(colors.bright + "🏆 Top Searches" + colors.reset);
    if (tag) {
        console.log(colors.dim + `   Filtered by tag: ${tag}` + colors.reset);
    }
    console.log(colors.dim + `   Total searches: ${formatNumber(result.totalSearches)}` + colors.reset);
    console.log(colors.bright + colors.blue + "━".repeat(80) + colors.reset);

    console.log(
        colors.dim +
            "   RANK".padEnd(8) +
            "SEARCH QUERY".padEnd(50) +
            "COUNT".padStart(12) +
            "%".padStart(10) +
            colors.reset
    );
    console.log(colors.dim + "   " + "─".repeat(76) + colors.reset);

    result.searches.forEach((search: any, index: number) => {
        const rank = `#${index + 1}`.padStart(5);
        const truncatedQuery = search.search.length > 47 ? search.search.slice(0, 44) + "..." : search.search;
        const percentage = search.percentage ? formatPercentage(search.percentage) : "0.00%";

        // Visual bar for percentage

        console.log(
            `   ${colors.cyan}${rank}${colors.reset}  ` +
                `${truncatedQuery.padEnd(47)} ` +
                `${colors.yellow}${formatNumber(search.count).padStart(10)}${colors.reset}  ` +
                `${colors.green}${percentage.padStart(8)}${colors.reset}`
        );
    });

    console.log(colors.bright + colors.blue + "━".repeat(80) + colors.reset);
}

async function displaySearchesWithNoResults(analytics: any, dateRange: any, limit: number, tag?: string) {
    console.log(colors.dim + "\n⏳ Fetching searches with no results..." + colors.reset);

    const result = await analytics.getSearchesWithNoResults({
        dateRange,
        limit,
        tags: tag
    });

    console.log("\n" + colors.bright + colors.red + "━".repeat(80) + colors.reset);
    console.log(colors.bright + "❌ Searches with No Results" + colors.reset);
    if (tag) {
        console.log(colors.dim + `   Filtered by tag: ${tag}` + colors.reset);
    }
    console.log(
        colors.dim + `   Total no-result searches: ${formatNumber(result.totalSearchesWithNoResults)}` + colors.reset
    );
    console.log(colors.bright + colors.red + "━".repeat(80) + colors.reset);

    console.log(
        colors.dim +
            "   RANK".padEnd(8) +
            "SEARCH QUERY".padEnd(50) +
            "COUNT".padStart(12) +
            "%".padStart(10) +
            colors.reset
    );
    console.log(colors.dim + "   " + "─".repeat(76) + colors.reset);

    result.searches.forEach((search: any, index: number) => {
        const rank = `#${index + 1}`.padStart(5);
        const truncatedQuery = search.search.length > 47 ? search.search.slice(0, 44) + "..." : search.search;
        const percentage = search.percentage ? formatPercentage(search.percentage) : "0.00%";

        console.log(
            `   ${colors.red}${rank}${colors.reset}  ` +
                `${truncatedQuery.padEnd(47)} ` +
                `${colors.yellow}${formatNumber(search.count).padStart(10)}${colors.reset}  ` +
                `${colors.red}${percentage.padStart(8)}${colors.reset}`
        );
    });

    console.log(colors.bright + colors.red + "━".repeat(80) + colors.reset);

    if (result.searches.length > 0) {
        console.log(
            colors.dim +
                "\n💡 Tip: Consider adding content for these popular queries to improve user experience" +
                colors.reset
        );
    }
}

async function displayTimeSeries(analytics: any, dateRange: any, tag?: string) {
    console.log(colors.dim + "\n⏳ Fetching search count time series..." + colors.reset);

    const timeSeries = await analytics.getSearchCountTimeSeries({
        dateRange,
        tags: tag,
        groupBy: "day"
    });

    console.log("\n" + colors.bright + colors.green + "📊 Daily Search Volume:" + colors.reset);
    if (tag) {
        console.log(colors.dim + `   Filtered by tag: ${tag}` + colors.reset);
    }
    console.log("   " + colors.dim + "Date".padEnd(15) + "Searches" + colors.reset);
    console.log("   " + colors.dim + "─".repeat(50) + colors.reset);

    const maxValue = Math.max(...timeSeries.map((d: { value: number }) => d.value));

    timeSeries.forEach(({ date, value }: { date: string; value: number }) => {
        const barLength = maxValue > 0 ? Math.round((value / maxValue) * 30) : 0;
        const bar = colors.cyan + "█".repeat(barLength) + colors.reset;
        console.log(`   ${date.padEnd(12)}  ${bar} ${colors.yellow}${formatNumber(value)}${colors.reset}`);
    });

    console.log("   " + colors.dim + "─".repeat(50) + colors.reset);

    // Calculate total and average
    const total = timeSeries.reduce((sum: number, d: { value: number }) => sum + d.value, 0);
    const average = timeSeries.length > 0 ? total / timeSeries.length : 0;

    console.log(`   ${colors.bright}Total:${colors.reset}   ${formatNumber(total)}`);
    console.log(`   ${colors.bright}Average:${colors.reset} ${formatNumber(Math.round(average))} per day`);
}

async function displaySearchesByTag(analytics: any, dateRange: any, tag: string, limit: number) {
    console.log(colors.dim + `\n⏳ Fetching searches for tag: ${tag}...` + colors.reset);

    const result = await analytics.getTopSearchesByTag({
        tag,
        dateRange,
        limit
    });

    console.log("\n" + colors.bright + colors.magenta + "━".repeat(80) + colors.reset);
    console.log(colors.bright + `🏷️  Top Searches by Tag: ${tag}` + colors.reset);
    console.log(colors.dim + `   Total searches: ${formatNumber(result.totalSearches)}` + colors.reset);
    console.log(colors.bright + colors.magenta + "━".repeat(80) + colors.reset);

    console.log(
        colors.dim +
            "   RANK".padEnd(8) +
            "SEARCH QUERY".padEnd(50) +
            "COUNT".padStart(12) +
            "%".padStart(10) +
            colors.reset
    );
    console.log(colors.dim + "   " + "─".repeat(76) + colors.reset);

    result.searches.forEach((search: any, index: number) => {
        const rank = `#${index + 1}`.padStart(5);
        const truncatedQuery = search.search.length > 47 ? search.search.slice(0, 44) + "..." : search.search;
        const percentage = search.percentage ? formatPercentage(search.percentage) : "0.00%";

        console.log(
            `   ${colors.magenta}${rank}${colors.reset}  ` +
                `${truncatedQuery.padEnd(47)} ` +
                `${colors.yellow}${formatNumber(search.count).padStart(10)}${colors.reset}  ` +
                `${colors.cyan}${percentage.padStart(8)}${colors.reset}`
        );
    });

    console.log(colors.bright + colors.magenta + "━".repeat(80) + colors.reset);
}

async function runInteractive() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    try {
        console.log(colors.bright + colors.green + "\n🔍 Algolia Analytics Test CLI" + colors.reset);
        console.log(colors.dim + "━".repeat(50) + colors.reset);

        // Get index name
        const indexName = await rl.question(
            colors.yellow + "📚 Enter index name (e.g., fern_docs_search) [fern_docs_search]: " + colors.reset
        );

        const finalIndexName = indexName || "fern_docs_search";

        // Get time range
        console.log(colors.dim + "\n📅 Select time range:" + colors.reset);
        console.log("  1) Last 7 days");
        console.log("  2) Last 30 days");
        console.log("  3) Last 3 months");
        const timeChoice = await rl.question(colors.yellow + "Enter choice (1-3) [1]: " + colors.reset);

        let dateRange;
        switch (timeChoice) {
            case "2":
                dateRange = { type: "last_n_days", days: 30 };
                break;
            case "3":
                dateRange = { type: "last_n_months", months: 3 };
                break;
            default:
                dateRange = { type: "last_n_days", days: 7 };
        }

        // Ask for optional tag filter
        const tag = await rl.question(
            colors.yellow + "🏷️  Filter by tag (optional, e.g., 'endpoint:openrouter.ai'): " + colors.reset
        );

        const analytics = getAlgoliaAnalyticsService({
            userId: "cli-test-user",
            indexName: finalIndexName
        });

        // Interactive menu
        let continueLoop = true;
        while (continueLoop) {
            console.log(colors.dim + "\n📊 What would you like to see?" + colors.reset);
            console.log("  1) Search metrics");
            console.log("  2) Top searches");
            console.log("  3) Searches with no results");
            console.log("  4) Search count time series");
            console.log("  5) Change tag filter");
            console.log("  0) Exit");

            const choice = await rl.question(colors.yellow + "Enter choice (0-5): " + colors.reset);

            switch (choice) {
                case "1":
                    await displayMetrics(analytics, dateRange, tag || undefined);
                    break;
                case "2":
                    await displayTopSearches(analytics, dateRange, 50, tag || undefined);
                    break;
                case "3":
                    await displaySearchesWithNoResults(analytics, dateRange, 50, tag || undefined);
                    break;
                case "4":
                    await displayTimeSeries(analytics, dateRange, tag || undefined);
                    break;
                case "5": {
                    await rl.question(
                        colors.yellow + "🏷️  Enter new tag filter (leave empty to clear): " + colors.reset
                    );
                    // Update tag variable
                    break;
                }
                case "0":
                    continueLoop = false;
                    break;
                default:
                    console.log(colors.red + "Invalid choice!" + colors.reset);
            }
        }
    } catch (error) {
        console.error(
            colors.red + "\n❌ Error:",
            error instanceof Error ? error.message : String(error) + colors.reset
        );
        process.exit(1);
    } finally {
        rl.close();
    }
}

async function main() {
    const { values } = parseArgs({
        args: process.argv.slice(2),
        options: {
            help: {
                type: "boolean",
                short: "h"
            },
            interactive: {
                type: "boolean",
                short: "i"
            },
            metrics: {
                type: "boolean"
            },
            "top-searches": {
                type: "boolean"
            },
            "no-results": {
                type: "boolean"
            },
            "time-series": {
                type: "boolean"
            },
            "by-tag": {
                type: "boolean"
            },
            index: {
                type: "string"
            },
            tag: {
                type: "string"
            },
            days: {
                type: "string"
            },
            weeks: {
                type: "string"
            },
            months: {
                type: "string"
            },
            limit: {
                type: "string"
            }
        },
        allowPositionals: true
    });

    if (values.help) {
        printHelp();
        process.exit(0);
    }

    // Check if no arguments provided at all
    if (process.argv.length === 2 || (!values.interactive && !values.index && !values.help)) {
        console.error(colors.red + "\n❌ Error: Missing required arguments!" + colors.reset);
        console.error(colors.yellow + "\nYou must provide either --index or use --interactive mode." + colors.reset);
        printHelp();
        process.exit(1);
    }

    // Run interactive mode if explicitly requested
    if (values.interactive) {
        await runInteractive();
        return;
    }

    // Non-interactive mode requires --index
    if (!values.index) {
        console.error(colors.red + "\n❌ Error: --index is required when not using interactive mode!" + colors.reset);
        console.error(
            colors.yellow + "\nExample: bun run algolia_sdk_test.ts --index fern_docs_search --metrics" + colors.reset
        );
        printHelp();
        process.exit(1);
    }

    // Check if at least one data option is specified
    if (
        !values.metrics &&
        !values["top-searches"] &&
        !values["no-results"] &&
        !values["time-series"] &&
        !values["by-tag"]
    ) {
        console.error(colors.red + "\n❌ Error: You must specify at least one data option!" + colors.reset);
        console.error(
            colors.yellow +
                "\nAvailable options: --metrics, --top-searches, --no-results, --time-series, --by-tag" +
                colors.reset
        );
        console.error(
            colors.yellow +
                "\nExample: bun run algolia_sdk_test.ts --index fern_docs_search --metrics --top-searches" +
                colors.reset
        );
        process.exit(1);
    }

    // Validate --by-tag requires --tag
    if (values["by-tag"] && !values.tag) {
        console.error(colors.red + "\n❌ Error: --by-tag requires --tag to be specified!" + colors.reset);
        console.error(
            colors.yellow +
                "\nExample: bun run algolia_sdk_test.ts --index fern_docs_search --by-tag --tag 'endpoint:openrouter.ai'" +
                colors.reset
        );
        process.exit(1);
    }

    // Determine date range
    let dateRange;
    if (values.weeks) {
        dateRange = { type: "last_n_weeks", weeks: parseInt(values.weeks) };
    } else if (values.months) {
        dateRange = { type: "last_n_months", months: parseInt(values.months) };
    } else {
        dateRange = { type: "last_n_days", days: values.days ? parseInt(values.days) : 7 };
    }

    const limit = values.limit ? parseInt(values.limit) : 50;
    const analytics = getAlgoliaAnalyticsService({
        userId: "cli-test-user",
        indexName: values.index
    });

    console.log(colors.bright + colors.green + `\n🔍 Algolia Analytics for Index: ${values.index}` + colors.reset);
    console.log(colors.dim + "━".repeat(60) + colors.reset);

    try {
        // Execute requested operations
        if (values.metrics) {
            await displayMetrics(analytics, dateRange, values.tag);
        }
        if (values["top-searches"]) {
            await displayTopSearches(analytics, dateRange, limit, values.tag);
        }
        if (values["no-results"]) {
            await displaySearchesWithNoResults(analytics, dateRange, limit, values.tag);
        }
        if (values["time-series"]) {
            await displayTimeSeries(analytics, dateRange, values.tag);
        }
        if (values["by-tag"] && values.tag) {
            await displaySearchesByTag(analytics, dateRange, values.tag, limit);
        }
    } catch (error) {
        console.error(
            colors.red + "\n❌ Error:",
            error instanceof Error ? error.message : String(error) + colors.reset
        );
        if (error instanceof Error && error.stack) {
            console.error(colors.dim + error.stack + colors.reset);
        }
        process.exit(1);
    }
}

// Run the CLI
main().catch(console.error);
