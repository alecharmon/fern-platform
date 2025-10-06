#!/usr/bin/env bun
import readline from "readline/promises";

import { getAnalyticsService } from ".";

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
        Ireland: "🇮🇪",
        Portugal: "🇵🇹",
        Greece: "🇬🇷",
        Israel: "🇮🇱",
        Singapore: "🇸🇬",
        Malaysia: "🇲🇾",
        Thailand: "🇹🇭",
        Indonesia: "🇮🇩",
        Philippines: "🇵🇭",
        Vietnam: "🇻🇳",
        "South Africa": "🇿🇦",
        Egypt: "🇪🇬",
        "Saudi Arabia": "🇸🇦",
        "United Arab Emirates": "🇦🇪",
        UAE: "🇦🇪"
    };

    return countryFlags[country] || null;
}

function printMetrics(metrics: any, unitCount: number, unitLabel: string, url: string) {
    console.log("\n" + colors.bright + colors.blue + "━".repeat(50) + colors.reset);
    console.log(colors.bright + `📊 Analytics for ${colors.cyan}${url}${colors.reset}`);
    console.log(colors.dim + `   Last ${unitCount} ${unitLabel}` + colors.reset);
    console.log(colors.bright + colors.blue + "━".repeat(50) + colors.reset + "\n");

    const metricsDisplay = [
        {
            label: "👥 Unique Visitors",
            value: formatNumber(metrics.visitors),
            color: colors.green
        },
        {
            label: "📄 Page Views",
            value: formatNumber(metrics.pageViews),
            color: colors.yellow
        },
        {
            label: "🔄 Sessions",
            value: formatNumber(metrics.sessions),
            color: colors.cyan
        }
    ];

    metricsDisplay.forEach(({ label, value, color }) => {
        console.log(`   ${label}: ${color}${colors.bright}${value}${colors.reset}`);
    });

    console.log("\n" + colors.bright + colors.blue + "━".repeat(50) + colors.reset + "\n");
}

async function main() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    try {
        // Prompt for base URL
        const baseUrl = await rl.question(
            colors.bright + "🌐 Enter the base URL to analyze (e.g., buildwithfern.com): " + colors.reset
        );

        if (!baseUrl) {
            console.error(colors.red + "❌ Base URL is required" + colors.reset);
            process.exit(1);
        }

        // Prompt for date range type
        console.log(colors.bright + "\n📅 Choose date range type:" + colors.reset);
        console.log(`   ${colors.dim}1)${colors.reset} Days`);
        console.log(`   ${colors.dim}2)${colors.reset} Weeks`);
        console.log(`   ${colors.dim}3)${colors.reset} Months`);

        const dateTypeChoice = await rl.question(colors.bright + "Select option (1-3, default: 1): " + colors.reset);

        let dateRangeType: "days" | "weeks" | "months";
        let unitLabel: string;
        let maxValue: number;

        switch (dateTypeChoice) {
            case "2":
                dateRangeType = "weeks";
                unitLabel = "weeks";
                maxValue = 52;
                break;
            case "3":
                dateRangeType = "months";
                unitLabel = "months";
                maxValue = 24;
                break;
            default:
                dateRangeType = "days";
                unitLabel = "days";
                maxValue = 365;
        }

        // Prompt for number of units
        const unitInput = await rl.question(
            colors.bright +
                `📊 How many ${unitLabel} of data? (default: ${dateRangeType === "days" ? 7 : dateRangeType === "weeks" ? 4 : 6}): ` +
                colors.reset
        );

        const defaultValue = dateRangeType === "days" ? 7 : dateRangeType === "weeks" ? 4 : 6;
        const unitCount = parseInt(unitInput) || defaultValue;

        if (unitCount < 1 || unitCount > maxValue) {
            console.error(
                colors.red +
                    `❌ ${unitLabel.charAt(0).toUpperCase() + unitLabel.slice(1)} must be between 1 and ${maxValue}` +
                    colors.reset
            );
            process.exit(1);
        }

        console.log(colors.dim + "\n⏳ Fetching analytics data..." + colors.reset);

        // Build date range based on user selection
        let dateRange;
        if (dateRangeType === "days") {
            dateRange = { type: "last_n_days" as const, days: unitCount };
        } else if (dateRangeType === "weeks") {
            dateRange = { type: "last_n_weeks" as const, weeks: unitCount };
        } else {
            dateRange = { type: "last_n_months" as const, months: unitCount };
        }

        // Initialize analytics service
        const analytics = getAnalyticsService({
            userId: "cli-test-user",
            baseSiteUrl: baseUrl
        });

        // Fetch metrics
        const metrics = await analytics.getMetrics({
            dateRange
        });

        // Display results
        printMetrics(metrics, unitCount, unitLabel, baseUrl);

        // Ask if they want to see time series data
        const showTimeSeries = await rl.question(
            colors.bright + "📈 Show time series breakdown? (y/N): " + colors.reset
        );

        if (showTimeSeries.toLowerCase() === "y") {
            let groupBy: number = 1;
            let groupByLabel = "Daily";

            // For days, offer groupBy options if more than 7 days
            // For weeks/months, use natural grouping
            if (dateRangeType === "days" && unitCount > 7) {
                console.log(colors.bright + "\n⚙️  Choose aggregation period:" + colors.reset);
                console.log(`   ${colors.dim}1)${colors.reset} Daily`);
                console.log(`   ${colors.dim}2)${colors.reset} Weekly (7 days)`);
                console.log(`   ${colors.dim}3)${colors.reset} Monthly (30 days)`);

                const groupByChoice = await rl.question(
                    colors.bright + "📊 Select option (1-3, default: 1): " + colors.reset
                );

                switch (groupByChoice) {
                    case "2":
                        groupBy = 7;
                        groupByLabel = "Weekly";
                        break;
                    case "3":
                        groupBy = 30;
                        groupByLabel = "Monthly";
                        break;
                    default:
                        groupBy = 1;
                        groupByLabel = "Daily";
                }
            } else if (dateRangeType === "weeks") {
                groupBy = 7;
                groupByLabel = "Weekly";
            } else if (dateRangeType === "months") {
                groupBy = 30;
                groupByLabel = "Monthly";
            }

            console.log(colors.dim + "\n⏳ Fetching time series data..." + colors.reset);

            // Fetch both page views and visitors time series
            const [pageViewsTimeSeries, visitorsTimeSeries] = await Promise.all([
                analytics.getPageViewsTimeSeries({
                    dateRange,
                    groupBy
                }),
                analytics.getVisitorsTimeSeries({
                    dateRange,
                    groupBy
                })
            ]);

            // Display page views
            console.log("\n" + colors.bright + `📊 ${groupByLabel} Page Views:` + colors.reset);
            console.log(colors.dim + "   Date         Views" + colors.reset);
            console.log(colors.dim + "   " + "─".repeat(25) + colors.reset);

            pageViewsTimeSeries.forEach(({ date, value }) => {
                const barLength = Math.floor((value / Math.max(...pageViewsTimeSeries.map((d) => d.value))) * 20);
                const bar = "█".repeat(barLength);
                console.log(
                    `   ${colors.dim}${date}${colors.reset}  ${colors.green}${bar}${colors.reset} ${formatNumber(value)}`
                );
            });

            // Display visitors
            console.log("\n" + colors.bright + `👥 ${groupByLabel} Unique Visitors:` + colors.reset);
            console.log(colors.dim + "   Date         Visitors" + colors.reset);
            console.log(colors.dim + "   " + "─".repeat(28) + colors.reset);

            visitorsTimeSeries.forEach(({ date, value }) => {
                const barLength = Math.floor((value / Math.max(...visitorsTimeSeries.map((d) => d.value))) * 20);
                const bar = "█".repeat(barLength);
                console.log(
                    `   ${colors.dim}${date}${colors.reset}  ${colors.cyan}${bar}${colors.reset} ${formatNumber(value)}`
                );
            });
        }

        // Ask if they want to see top pages
        const showTopPages = await rl.question(colors.bright + "\n📄 Show top pages? (y/N): " + colors.reset);

        if (showTopPages.toLowerCase() === "y") {
            console.log(colors.dim + "\n⏳ Fetching top pages data..." + colors.reset);

            const topPages = await analytics.getTopPages({
                dateRange,
                limit: 10
            });

            console.log("\n" + colors.bright + colors.blue + "━".repeat(80) + colors.reset);
            console.log(colors.bright + "🏆 Top Pages" + colors.reset);
            console.log(colors.bright + colors.blue + "━".repeat(80) + colors.reset);

            // Header
            console.log(
                colors.dim + "   PATH".padEnd(50) + "VISITORS".padStart(12) + "VIEWS".padStart(12) + colors.reset
            );
            console.log(colors.dim + "   " + "─".repeat(76) + colors.reset);

            // Rows
            topPages.forEach(({ path, visitors, views }) => {
                const truncatedPath = path.length > 47 ? path.slice(0, 44) + "..." : path;
                console.log(
                    `   ${truncatedPath.padEnd(47)} ` +
                        `${colors.green}${formatNumber(visitors).padStart(10)}${colors.reset}  ` +
                        `${colors.yellow}${formatNumber(views).padStart(10)}${colors.reset}`
                );
            });

            console.log(colors.bright + colors.blue + "━".repeat(80) + colors.reset);
        }

        // Ask if they want to see top countries
        const showTopCountries = await rl.question(colors.bright + "\n🌍 Show top countries? (y/N): " + colors.reset);

        if (showTopCountries.toLowerCase() === "y") {
            console.log(colors.dim + "\n⏳ Fetching top countries data..." + colors.reset);

            const topCountries = await analytics.getTopCountries({
                dateRange,
                limit: 10
            });

            console.log("\n" + colors.bright + colors.blue + "━".repeat(80) + colors.reset);
            console.log(colors.bright + "🌍 Top Countries" + colors.reset);
            console.log(colors.bright + colors.blue + "━".repeat(80) + colors.reset);

            // Header
            console.log(
                colors.dim + "   COUNTRY".padEnd(40) + "VISITORS".padStart(12) + "VIEWS".padStart(12) + colors.reset
            );
            console.log(colors.dim + "   " + "─".repeat(76) + colors.reset);

            // Rows
            topCountries.forEach(({ country, visitors, views }) => {
                // Get country flag emoji
                const flag = getCountryFlag(country);
                const countryDisplay = flag ? `${flag}  ${country}` : country;
                const truncatedCountry =
                    countryDisplay.length > 37 ? countryDisplay.slice(0, 34) + "..." : countryDisplay;

                console.log(
                    `   ${truncatedCountry.padEnd(37)} ` +
                        `${colors.green}${formatNumber(visitors).padStart(10)}${colors.reset}  ` +
                        `${colors.yellow}${formatNumber(views).padStart(10)}${colors.reset}`
                );
            });

            console.log(colors.bright + colors.blue + "━".repeat(80) + colors.reset);
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

// Run the CLI
main().catch(console.error);
