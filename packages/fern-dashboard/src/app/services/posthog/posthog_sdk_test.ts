#!/usr/bin/env bun
import { parseArgs } from "util";
import readline from "readline/promises";

import { getAnalyticsService } from ".";
import { COUNTRY_DATA } from "../../../components/web-analytics/constants/countries";

// ANSI color codes for pretty output
const colors = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    dim: "\x1b[2m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    cyan: "\x1b[36m",
    red: "\x1b[31m"
};

function formatNumber(num: number): string {
    return new Intl.NumberFormat("en-US").format(num);
}

function getCountryFlag(country: string): string | null {
    // Map common country names to their flag emojis
    const countryFlags: Record<string, string> = {
        "United States": "🇺🇸",
        USA: "🇺🇸",
        "United Kingdom": "🇬🇧",
        UK: "🇬🇧",
        England: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
        Canada: "🇨🇦",
        Germany: "🇩🇪",
        France: "🇫🇷",
        Spain: "🇪🇸",
        Italy: "🇮🇹",
        Netherlands: "🇳🇱",
        Poland: "🇵🇱",
        Brazil: "🇧🇷",
        Mexico: "🇲🇽",
        Argentina: "🇦🇷",
        Japan: "🇯🇵",
        China: "🇨🇳",
        "South Korea": "🇰🇷",
        India: "🇮🇳",
        Australia: "🇦🇺",
        "New Zealand": "🇳🇿",
        Turkey: "🇹🇷",
        Russia: "🇷🇺",
        Ukraine: "🇺🇦",
        Switzerland: "🇨🇭",
        Sweden: "🇸🇪",
        Norway: "🇳🇴",
        Denmark: "🇩🇰",
        Finland: "🇫🇮",
        Belgium: "🇧🇪",
        Austria: "🇦🇹",
        Portugal: "🇵🇹",
        Greece: "🇬🇷",
        Ireland: "🇮🇪",
        Scotland: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
        Wales: "🏴󠁧󠁢󠁷󠁬󠁳󠁿",
        "Czech Republic": "🇨🇿",
        Romania: "🇷🇴",
        Hungary: "🇭🇺",
        Bulgaria: "🇧🇬",
        Croatia: "🇭🇷",
        Serbia: "🇷🇸",
        Slovakia: "🇸🇰",
        Slovenia: "🇸🇮",
        Estonia: "🇪🇪",
        Latvia: "🇱🇻",
        Lithuania: "🇱🇹",
        "South Africa": "🇿🇦",
        Egypt: "🇪🇬",
        Morocco: "🇲🇦",
        Nigeria: "🇳🇬",
        Kenya: "🇰🇪",
        Singapore: "🇸🇬",
        Malaysia: "🇲🇾",
        Thailand: "🇹🇭",
        Vietnam: "🇻🇳",
        Philippines: "🇵🇭",
        Indonesia: "🇮🇩",
        Taiwan: "🇹🇼",
        "Hong Kong": "🇭🇰",
        Israel: "🇮🇱",
        "United Arab Emirates": "🇦🇪",
        "Saudi Arabia": "🇸🇦",
        Pakistan: "🇵🇰",
        Bangladesh: "🇧🇩",
        Chile: "🇨🇱",
        Colombia: "🇨🇴",
        Peru: "🇵🇪",
        Venezuela: "🇻🇪",
        Uruguay: "🇺🇾",
        "Costa Rica": "🇨🇷",
        Panama: "🇵🇦",
        Jamaica: "🇯🇲"
    };
    return countryFlags[country] || null;
}

function printHelp() {
    console.log(`
${colors.bright}PostHog Analytics CLI Test Tool${colors.reset}

${colors.yellow}Usage:${colors.reset}
  bun run posthog_sdk_test.ts --site <url> [data options] [time options]
  bun run posthog_sdk_test.ts --interactive
  bun run posthog_sdk_test.ts --help

${colors.yellow}Required Arguments:${colors.reset}
  Either --site <url> OR --interactive must be provided

${colors.yellow}Data Options (at least one required with --site):${colors.reset}
  --metrics            Show key metrics (visitors, page views, sessions)
  --time-series        Show time series data (daily views and visitors)
  --pages              Show top pages by views/visitors
  --countries          Show top countries by views/visitors
  --llm-table          Show LLM file views (agent vs human breakdown)
  --channels           Show traffic by channel type (Direct, Referral, etc.)
  --device-types       Show traffic by device type (Desktop, Mobile, etc.)
  --referring-domains  Show top referring domains

${colors.yellow}Time Options (optional):${colors.reset}
  --days <number>      Number of days to analyze (default: 7)
  --weeks <number>     Number of weeks to analyze
  --months <number>    Number of months to analyze

${colors.yellow}Other Options:${colors.reset}
  --help, -h           Show this help message
  --interactive, -i    Run in interactive mode (menu-driven)
  --limit <number>     Limit results for tables (default: 10)

${colors.yellow}Examples:${colors.reset}
  # Interactive mode (menu-driven)
  bun run posthog_sdk_test.ts --interactive

  # Get metrics for last 30 days
  bun run posthog_sdk_test.ts --site docs.buildwithfern.com --metrics --days 30

  # Get LLM file analytics
  bun run posthog_sdk_test.ts --site docs.buildwithfern.com --llm-table

  # Get multiple analytics types
  bun run posthog_sdk_test.ts --site docs.buildwithfern.com --metrics --pages --countries

  # Get channel breakdown
  bun run posthog_sdk_test.ts --site docs.buildwithfern.com --channels

  # Get device types
  bun run posthog_sdk_test.ts --site docs.buildwithfern.com --device-types

  # Get referring domains
  bun run posthog_sdk_test.ts --site docs.buildwithfern.com --referring-domains

  # Get time series for last 2 weeks
  bun run posthog_sdk_test.ts --site docs.buildwithfern.com --time-series --weeks 2

  # Get top 20 pages for last month
  bun run posthog_sdk_test.ts --site docs.buildwithfern.com --pages --limit 20 --months 1
`);
}

async function displayMetrics(analytics: any, dateRange: any) {
    console.log(colors.dim + "\n⏳ Fetching analytics data..." + colors.reset);

    const metrics = await analytics.getMetrics({ dateRange });

    console.log("\n" + colors.bright + colors.green + "━".repeat(50) + colors.reset);
    console.log(colors.bright + "📊 Analytics Summary" + colors.reset);
    console.log(colors.bright + colors.green + "━".repeat(50) + colors.reset);
    console.log(`${colors.yellow}👥 Unique Visitors:${colors.reset}  ${formatNumber(metrics.visitors)}`);
    console.log(`${colors.blue}📄 Page Views:${colors.reset}       ${formatNumber(metrics.pageViews)}`);
    console.log(`${colors.cyan}💬 Sessions:${colors.reset}         ${formatNumber(metrics.sessions)}`);
    console.log(colors.bright + colors.green + "━".repeat(50) + colors.reset);
}

async function displayTimeSeries(analytics: any, dateRange: any) {
    console.log(colors.dim + "\n⏳ Fetching time series data..." + colors.reset);

    const [pageViewsTimeSeries, visitorsTimeSeries] = await Promise.all([
        analytics.getPageViewsTimeSeries({ dateRange }),
        analytics.getVisitorsTimeSeries({ dateRange })
    ]);

    console.log("\n" + colors.bright + colors.green + "📊 Daily Page Views:" + colors.reset);
    console.log("   " + colors.dim + "Date".padEnd(15) + "Views" + colors.reset);
    console.log("   " + colors.dim + "─".repeat(40) + colors.reset);

    pageViewsTimeSeries.forEach(({ date, value }) => {
        const barLength = Math.round((value / Math.max(...pageViewsTimeSeries.map((d) => d.value))) * 20);
        const bar = colors.green + "█".repeat(barLength) + colors.reset;
        console.log(`   ${new Date(date).toISOString().slice(0, 10)}  ${bar} ${formatNumber(value)}`);
    });

    console.log("\n" + colors.bright + colors.cyan + "👥 Daily Unique Visitors:" + colors.reset);
    console.log("   " + colors.dim + "Date".padEnd(15) + "Visitors" + colors.reset);
    console.log("   " + colors.dim + "─".repeat(44) + colors.reset);

    visitorsTimeSeries.forEach(({ date, value }) => {
        const barLength = Math.round((value / Math.max(...visitorsTimeSeries.map((d) => d.value))) * 20);
        const bar = colors.cyan + "█".repeat(barLength) + colors.reset;
        console.log(`   ${new Date(date).toISOString().slice(0, 10)}  ${bar} ${formatNumber(value)}`);
    });
}

async function displayTopPages(analytics: any, dateRange: any, limit: number) {
    console.log(colors.dim + "\n⏳ Fetching top pages data..." + colors.reset);

    const topPages = await analytics.getTopPages({
        dateRange,
        limit
    });

    console.log("\n" + colors.bright + colors.blue + "━".repeat(80) + colors.reset);
    console.log(colors.bright + "🏆 Top Pages" + colors.reset);
    console.log(colors.bright + colors.blue + "━".repeat(80) + colors.reset);

    console.log(colors.dim + "   PATH".padEnd(50) + "VISITORS".padStart(12) + "VIEWS".padStart(12) + colors.reset);
    console.log(colors.dim + "   " + "─".repeat(76) + colors.reset);

    topPages.forEach(({ path, visitors, views }: any) => {
        const truncatedPath = path.length > 47 ? path.slice(0, 44) + "..." : path;
        console.log(
            `   ${truncatedPath.padEnd(47)} ` +
                `${colors.green}${formatNumber(visitors).padStart(10)}${colors.reset}  ` +
                `${colors.yellow}${formatNumber(views).padStart(10)}${colors.reset}`
        );
    });

    console.log(colors.bright + colors.blue + "━".repeat(80) + colors.reset);
}

async function displayTopCountries(analytics: any, dateRange: any, limit: number) {
    console.log(colors.dim + "\n⏳ Fetching top countries data..." + colors.reset);

    const topCountries = await analytics.getTopCountries({
        dateRange,
        limit
    });

    console.log("\n" + colors.bright + colors.blue + "━".repeat(80) + colors.reset);
    console.log(colors.bright + "🌍 Top Countries" + colors.reset);
    console.log(colors.bright + colors.blue + "━".repeat(80) + colors.reset);

    console.log(colors.dim + "   COUNTRY".padEnd(40) + "VISITORS".padStart(12) + "VIEWS".padStart(12) + colors.reset);
    console.log(colors.dim + "   " + "─".repeat(76) + colors.reset);

    topCountries.forEach(({ country, visitors, views }: any) => {
        const countryInfo = COUNTRY_DATA[country];
        const flag = countryInfo?.flag || getCountryFlag(country);
        const countryName = countryInfo?.name || country;
        const countryDisplay = flag ? `${flag}  ${countryName}` : countryName;
        const truncatedCountry = countryDisplay.length > 37 ? countryDisplay.slice(0, 34) + "..." : countryDisplay;

        console.log(
            `   ${truncatedCountry.padEnd(37)} ` +
                `${colors.green}${formatNumber(visitors).padStart(10)}${colors.reset}  ` +
                `${colors.yellow}${formatNumber(views).padStart(10)}${colors.reset}`
        );
    });

    console.log(colors.bright + colors.blue + "━".repeat(80) + colors.reset);
}

async function displayLLMTable(analytics: any, dateRange: any) {
    console.log(colors.dim + "\n⏳ Fetching LLM file views data..." + colors.reset);
    console.log(colors.dim + "Date range: " + JSON.stringify(dateRange) + colors.reset);

    const llmFileViews = await analytics.getLLMFileViews({
        dateRange,
        limit: 20
    });

    console.log("\n" + colors.bright + colors.blue + "━".repeat(80) + colors.reset);
    console.log(colors.bright + "🤖 LLM File Views (Agent vs Human)" + colors.reset);
    console.log(colors.bright + colors.blue + "━".repeat(80) + colors.reset);

    console.log(
        colors.dim + "   FILE PATH".padEnd(50) + "AGENT VIEWS".padStart(12) + "HUMAN VIEWS".padStart(12) + colors.reset
    );
    console.log(colors.dim + "   " + "─".repeat(76) + colors.reset);

    llmFileViews.forEach(({ path, agentViews, humanViews }: any) => {
        const truncatedPath = path.length > 47 ? path.slice(0, 44) + "..." : path;
        console.log(
            `   ${truncatedPath.padEnd(47)} ` +
                `${colors.cyan}${formatNumber(agentViews).padStart(10)}${colors.reset}  ` +
                `${colors.green}${formatNumber(humanViews).padStart(10)}${colors.reset}`
        );
    });

    console.log(colors.bright + colors.blue + "━".repeat(80) + colors.reset);
}

async function displayChannels(analytics: any, dateRange: any) {
    console.log(colors.dim + "\n⏳ Fetching channel data..." + colors.reset);

    const channels = await analytics.getChannels({
        dateRange,
        limit: 20 // Increased to see all channels including small ones
    });

    console.log("\n" + colors.bright + colors.blue + "━".repeat(80) + colors.reset);
    console.log(colors.bright + "📊 Traffic by Channel Type" + colors.reset);
    console.log(colors.bright + colors.blue + "━".repeat(80) + colors.reset);

    console.log(
        colors.dim + "   CHANNEL TYPE".padEnd(40) + "VISITORS".padStart(12) + "VIEWS".padStart(12) + colors.reset
    );
    console.log(colors.dim + "   " + "─".repeat(76) + colors.reset);

    // Filter out Unknown if it has 0 visitors (PostHog might do this)
    const filteredChannels = channels.filter(({ channel, visitors }: any) => channel !== "Unknown" || visitors > 0);

    filteredChannels.forEach(({ channel, visitors, views }: any) => {
        const channelDisplay = channel.padEnd(37);
        console.log(
            `   ${channelDisplay} ` +
                `${colors.green}${formatNumber(visitors).padStart(10)}${colors.reset}  ` +
                `${colors.yellow}${formatNumber(views).padStart(10)}${colors.reset}`
        );
    });

    console.log(colors.bright + colors.blue + "━".repeat(80) + colors.reset);

    // Show debug info if there are Unknown visitors
    const unknownChannel = channels.find((c: any) => c.channel === "Unknown");
    if (unknownChannel && unknownChannel.visitors > 0) {
        console.log(
            colors.dim +
                "\nNote: " +
                unknownChannel.visitors +
                " visitors classified as 'Unknown' - PostHog UI may hide or reclassify these" +
                colors.reset
        );
    }
}

async function displayDeviceTypes(analytics: any, dateRange: any) {
    console.log(colors.dim + "\n⏳ Fetching device type data..." + colors.reset);

    const deviceTypes = await analytics.getDeviceTypes({
        dateRange,
        limit: 10
    });

    console.log("\n" + colors.bright + colors.blue + "━".repeat(80) + colors.reset);
    console.log(colors.bright + "📱 Traffic by Device Type" + colors.reset);
    console.log(colors.bright + colors.blue + "━".repeat(80) + colors.reset);

    console.log(
        colors.dim + "   DEVICE TYPE".padEnd(40) + "VISITORS".padStart(12) + "VIEWS".padStart(12) + colors.reset
    );
    console.log(colors.dim + "   " + "─".repeat(76) + colors.reset);

    deviceTypes.forEach(({ deviceType, visitors, views }: any) => {
        // Add emoji for device types
        const deviceEmoji =
            {
                Desktop: "🖥️ ",
                Mobile: "📱",
                Tablet: "📟",
                Console: "🎮",
                TV: "📺"
            }[deviceType] || "📱";

        const deviceDisplay = `${deviceEmoji}  ${deviceType}`.padEnd(37);
        console.log(
            `   ${deviceDisplay} ` +
                `${colors.green}${formatNumber(visitors).padStart(10)}${colors.reset}  ` +
                `${colors.yellow}${formatNumber(views).padStart(10)}${colors.reset}`
        );
    });

    console.log(colors.bright + colors.blue + "━".repeat(80) + colors.reset);
}

async function displayReferringDomains(analytics: any, dateRange: any, limit: number = 10) {
    console.log(colors.dim + "\n⏳ Fetching referring domains data..." + colors.reset);

    const referringDomains = await analytics.getReferringDomains({
        dateRange,
        limit
    });

    console.log("\n" + colors.bright + colors.blue + "━".repeat(80) + colors.reset);
    console.log(colors.bright + "🔗 Top Referring Domains" + colors.reset);
    console.log(colors.bright + colors.blue + "━".repeat(80) + colors.reset);

    console.log(colors.dim + "   DOMAIN".padEnd(50) + "VISITORS".padStart(12) + "VIEWS".padStart(12) + colors.reset);
    console.log(colors.dim + "   " + "─".repeat(76) + colors.reset);

    referringDomains.forEach(({ domain, visitors, views }: any) => {
        const truncatedDomain = domain.length > 47 ? domain.slice(0, 44) + "..." : domain;
        console.log(
            `   ${truncatedDomain.padEnd(47)} ` +
                `${colors.green}${formatNumber(visitors).padStart(10)}${colors.reset}  ` +
                `${colors.yellow}${formatNumber(views).padStart(10)}${colors.reset}`
        );
    });

    console.log(colors.bright + colors.blue + "━".repeat(80) + colors.reset);
}

async function runInteractive() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    try {
        console.log(colors.bright + colors.green + "\n🚀 PostHog Analytics Test CLI" + colors.reset);
        console.log(colors.dim + "━".repeat(50) + colors.reset);

        // Get site URL
        const siteUrl = await rl.question(
            colors.yellow + "🌐 Enter site URL (e.g., docs.buildwithfern.com): " + colors.reset
        );

        if (!siteUrl) {
            console.error(colors.red + "❌ Site URL is required!" + colors.reset);
            process.exit(1);
        }

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

        const analytics = getAnalyticsService({
            userId: "cli-test-user",
            baseSiteUrl: siteUrl
        });

        // Interactive menu
        let continueLoop = true;
        while (continueLoop) {
            console.log(colors.dim + "\n📊 What would you like to see?" + colors.reset);
            console.log("  1) Key metrics");
            console.log("  2) Time series data");
            console.log("  3) Top pages");
            console.log("  4) Top countries");
            console.log("  5) LLM file views");
            console.log("  6) Channels");
            console.log("  7) Device types");
            console.log("  8) Referring domains");
            console.log("  9) Exit");

            const choice = await rl.question(colors.yellow + "Enter choice (1-9): " + colors.reset);

            switch (choice) {
                case "1":
                    await displayMetrics(analytics, dateRange);
                    break;
                case "2":
                    await displayTimeSeries(analytics, dateRange);
                    break;
                case "3":
                    await displayTopPages(analytics, dateRange, 10);
                    break;
                case "4":
                    await displayTopCountries(analytics, dateRange, 10);
                    break;
                case "5":
                    await displayLLMTable(analytics, dateRange);
                    break;
                case "6":
                    await displayChannels(analytics, dateRange);
                    break;
                case "7":
                    await displayDeviceTypes(analytics, dateRange);
                    break;
                case "8":
                    await displayReferringDomains(analytics, dateRange);
                    break;
                case "9":
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
    const { values, positionals } = parseArgs({
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
            "time-series": {
                type: "boolean"
            },
            pages: {
                type: "boolean"
            },
            countries: {
                type: "boolean"
            },
            "llm-table": {
                type: "boolean"
            },
            channels: {
                type: "boolean"
            },
            "device-types": {
                type: "boolean"
            },
            "referring-domains": {
                type: "boolean"
            },
            site: {
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
    if (process.argv.length === 2 || (!values.interactive && !values.site && !values.help)) {
        console.error(colors.red + "\n❌ Error: Missing required arguments!" + colors.reset);
        console.error(colors.yellow + "\nYou must provide either --site or use --interactive mode." + colors.reset);
        printHelp();
        process.exit(1);
    }

    // Run interactive mode if explicitly requested
    if (values.interactive) {
        await runInteractive();
        return;
    }

    // Non-interactive mode requires --site
    if (!values.site) {
        console.error(colors.red + "\n❌ Error: --site is required when not using interactive mode!" + colors.reset);
        console.error(
            colors.yellow +
                "\nExample: bun run posthog_sdk_test.ts --site docs.buildwithfern.com --metrics" +
                colors.reset
        );
        printHelp();
        process.exit(1);
    }

    // Check if at least one data option is specified
    if (
        !values.metrics &&
        !values["time-series"] &&
        !values.pages &&
        !values.countries &&
        !values["llm-table"] &&
        !values.channels &&
        !values["device-types"] &&
        !values["referring-domains"]
    ) {
        console.error(colors.red + "\n❌ Error: You must specify at least one data option!" + colors.reset);
        console.error(
            colors.yellow +
                "\nAvailable options: --metrics, --time-series, --pages, --countries, --llm-table, --channels, --device-types, --referring-domains" +
                colors.reset
        );
        console.error(
            colors.yellow +
                "\nExample: bun run posthog_sdk_test.ts --site docs.buildwithfern.com --metrics --pages" +
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

    const limit = values.limit ? parseInt(values.limit) : 10;
    const analytics = getAnalyticsService({
        userId: "cli-test-user",
        baseSiteUrl: values.site
    });

    console.log(colors.bright + colors.green + "\n🚀 PostHog Analytics for " + values.site + colors.reset);
    console.log(colors.dim + "━".repeat(50) + colors.reset);

    try {
        // Execute requested operations
        if (values.metrics) {
            await displayMetrics(analytics, dateRange);
        }
        if (values["time-series"]) {
            await displayTimeSeries(analytics, dateRange);
        }
        if (values.pages) {
            await displayTopPages(analytics, dateRange, limit);
        }
        if (values.countries) {
            await displayTopCountries(analytics, dateRange, limit);
        }
        if (values["llm-table"]) {
            await displayLLMTable(analytics, dateRange);
        }
        if (values.channels) {
            await displayChannels(analytics, dateRange);
        }
        if (values["device-types"]) {
            await displayDeviceTypes(analytics, dateRange);
        }
        if (values["referring-domains"]) {
            await displayReferringDomains(analytics, dateRange, limit);
        }
    } catch (error) {
        console.error(
            colors.red + "\n❌ Error:",
            error instanceof Error ? error.message : String(error) + colors.reset
        );
        process.exit(1);
    }
}

// Run the CLI
main().catch(console.error);
