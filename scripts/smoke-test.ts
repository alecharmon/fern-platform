// biome-ignore-all lint/suspicious/noConsole: CLI tool requires console output
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { type Browser, type BrowserContext, chromium, type Page } from "playwright";

interface CrawlResults {
    totalPages: number;
    successfulPages: number;
    failedPages: number;
    consoleErrors: Array<{ url: string; error: string }>;
    networkErrors: Array<{ url: string; failedUrl: string; error: string }>;
    pageErrors: Array<{ url: string; error: string }>;
}

interface UrlExpectation {
    url: string;
    expectedStatus: number;
    headers?: Record<string, string>;
    expectedContentType?: string;
}

interface PageResult {
    url: string;
    success: boolean;
    consoleErrors: Array<{ url: string; error: string }>;
    networkErrors: Array<{ url: string; failedUrl: string; error: string }>;
    pageErrors: Array<{ url: string; error: string }>;
}

// List of errors to ignore (common false positives)
const ignoredPatterns = [/_vercel\/insights/, /vercel\.com/, /google-analytics/, /googletagmanager/, /analytics\.js/];

const ignoredErrorMessages = [
    "Failed to load resource: the server responded with a status of 404 ()",
    "Failed to load resource: the server responded with a status of 415 ()",
    "Refused to execute script from",
    "Minified React error #418"
];

function shouldIgnoreError(url: string, message: string): boolean {
    const fullText = `${url} ${message}`;

    if (ignoredPatterns.some((pattern) => pattern.test(fullText))) {
        return true;
    }

    if (ignoredErrorMessages.some((msg) => message.includes(msg))) {
        return true;
    }

    // Expected error for external-dependency-test page (tests error boundary)
    if (url.includes("external-dependency-test") && message.includes("[error-boundary-fallback]")) {
        return true;
    }

    return false;
}

async function fetchSitemap(baseUrl: string, page: Page): Promise<string[]> {
    try {
        const sitemapUrl = `${baseUrl}/sitemap.xml`;
        console.log(`Fetching sitemap from ${sitemapUrl}`);

        const response = await page.goto(sitemapUrl, { waitUntil: "networkidle", timeout: 30000 });

        if (!response || response.status() !== 200) {
            console.warn(`Failed to fetch sitemap: ${response ? response.status() : "no response"}`);
            return [];
        }

        const xml = await page.content();
        const urlMatches = xml.matchAll(/<loc>(.*?)<\/loc>/g);
        const urls = Array.from(urlMatches).map((match) => match[1]);

        console.log(`Found ${urls.length} URLs in sitemap`);
        return urls;
    } catch (error) {
        console.error(`Error fetching sitemap: ${error instanceof Error ? error.message : error}`);
        return [];
    }
}

async function processPage(
    context: BrowserContext,
    currentUrl: string,
    expectations: UrlExpectation,
    pageIndex: number
): Promise<PageResult> {
    const result: PageResult = {
        url: currentUrl,
        success: false,
        consoleErrors: [],
        networkErrors: [],
        pageErrors: []
    };

    console.log(`\nCrawling (${pageIndex}): ${currentUrl}`);

    if (expectations.headers) {
        console.log(`  Custom headers: ${JSON.stringify(expectations.headers)}`);
    }

    const page = await context.newPage();
    const pageErrors: string[] = [];

    // Listen for console errors
    page.on("console", (msg) => {
        if (msg.type() === "error") {
            const errorText = msg.text();
            const expectedStatus = expectations.expectedStatus;

            const isExpectedStatusError = expectedStatus !== 200 && errorText.includes(`status of ${expectedStatus}`);

            if (!shouldIgnoreError(currentUrl, errorText) && !isExpectedStatusError) {
                const error = `Console error on ${currentUrl}: ${errorText}`;
                console.error(`  [x] ${error}`);
                pageErrors.push(error);
                result.consoleErrors.push({ url: currentUrl, error: errorText });
            }
        }
    });

    // Listen for page errors
    page.on("pageerror", (error) => {
        const errorMessage = error.message;
        if (!shouldIgnoreError(currentUrl, errorMessage)) {
            const errorMsg = `Page error on ${currentUrl}: ${errorMessage}`;
            console.error(`  [x] ${errorMsg}`);
            pageErrors.push(errorMsg);
            result.pageErrors.push({ url: currentUrl, error: errorMessage });
        }
    });

    // Listen for failed requests
    page.on("requestfailed", (request) => {
        const failedUrl = request.url();
        const errorText = request.failure()?.errorText || "Unknown error";
        if (!shouldIgnoreError(failedUrl, errorText)) {
            const errorMsg = `Failed request on ${currentUrl}: ${failedUrl} - ${errorText}`;
            console.error(`  [x] ${errorMsg}`);
            pageErrors.push(errorMsg);
            result.networkErrors.push({ url: currentUrl, failedUrl: failedUrl, error: errorText });
        }
    });

    const expectedStatus = expectations.expectedStatus;
    const expectedContentType = expectations.expectedContentType;

    try {
        // Set custom headers if specified
        if (expectations.headers) {
            await page.setExtraHTTPHeaders({
                ...expectations.headers,
                "Cache-Control": "no-cache"
            });
        }

        const response = await page.goto(currentUrl, {
            waitUntil: "networkidle",
            timeout: 30000
        });

        const actualStatus = response ? response.status() : 0;

        if (response) {
            const responseHeaders = response.headers();
            console.log(`  Response: ${actualStatus} ${response.statusText()}`);
            console.log(`  Content-Type: ${responseHeaders["content-type"] || "none"}`);
        }

        // 304 Not Modified is treated as success
        const isSuccess = actualStatus === expectedStatus || (expectedStatus === 200 && actualStatus === 304);

        if (!response || !isSuccess) {
            const errorMsg = `HTTP ${actualStatus} for ${currentUrl} (expected ${expectedStatus})`;
            console.error(`  [x] ${errorMsg}`);
            pageErrors.push(errorMsg);
            result.success = false;
        } else {
            if (expectedContentType) {
                const actualContentType = response.headers()["content-type"] || "";
                if (!actualContentType.includes(expectedContentType)) {
                    const errorMsg = `Wrong Content-Type for ${currentUrl}: got "${actualContentType}", expected "${expectedContentType}"`;
                    console.error(`  [x] ${errorMsg}`);
                    pageErrors.push(errorMsg);
                    result.success = false;
                } else {
                    console.log(`  [ok] Success (status ${actualStatus}, content-type: ${actualContentType})`);
                    result.success = pageErrors.length === 0;
                }
            } else {
                console.log(`  [ok] Success (status ${actualStatus})`);
                result.success = pageErrors.length === 0;
            }
        }
    } catch (error) {
        const errorMsg = `Error loading ${currentUrl}: ${error instanceof Error ? error.message : error}`;
        console.error(`  [x] ${errorMsg}`);
        pageErrors.push(errorMsg);
        result.success = false;
        result.pageErrors.push({ url: currentUrl, error: error instanceof Error ? error.message : String(error) });
    }

    await page.close();
    return result;
}

async function crawlSite(vercelUrl: string, smokeTestHost: string, concurrency: number): Promise<CrawlResults> {
    const browser: Browser = await chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const context: BrowserContext = await browser.newContext();

    const visitedUrls = new Set<string>();
    const results: CrawlResults = {
        totalPages: 0,
        successfulPages: 0,
        failedPages: 0,
        consoleErrors: [],
        networkErrors: [],
        pageErrors: []
    };

    // Build the preview API URL
    const previewApiUrl = `${vercelUrl}/api/fern-docs/preview?host=${smokeTestHost}`;
    console.log(`Setting up preview connection: ${previewApiUrl}`);

    // Create a page to set up cookies by visiting the preview API URL
    const setupPage = await context.newPage();

    try {
        await setupPage.goto(previewApiUrl, { waitUntil: "networkidle", timeout: 30000 });
        console.log("Preview cookie established");
    } catch (error) {
        console.warn(`Warning: Failed to set up preview connection: ${error instanceof Error ? error.message : error}`);
    }

    // Fetch URLs from sitemap (using the same context so it has the cookie)
    const sitemapUrls = await fetchSitemap(vercelUrl, setupPage);

    await setupPage.close();

    // Add specific URLs to test with expected status codes
    const specificUrls: UrlExpectation[] = [
        // API explorers (under home product)
        { url: `${vercelUrl}/home/rest-api/rest-api/plant/updates-web-socket?explorer=true`, expectedStatus: 200 },
        { url: `${vercelUrl}/home/events-api/events-api/inventory/inventory?explorer=true`, expectedStatus: 200 },
        // LLMs.txt files (under home product)
        { url: `${vercelUrl}/home/rest-api/rest-api/plant/add-plant/llms.txt`, expectedStatus: 200 },
        { url: `${vercelUrl}/llms.txt`, expectedStatus: 200 },
        { url: `${vercelUrl}/llms-full.txt`, expectedStatus: 200 },
        // API endpoints (some require auth)
        { url: `${vercelUrl}/api/fern-docs/search/v2/key`, expectedStatus: 200 },
        { url: `${vercelUrl}/api/fern-docs/get-jwt`, expectedStatus: 401 },
        { url: `${vercelUrl}/_mcp/server`, expectedStatus: 200 },
        // SEO and discovery endpoints
        { url: `${vercelUrl}/sitemap.xml`, expectedStatus: 200, expectedContentType: "xml" },
        { url: `${vercelUrl}/robots.txt`, expectedStatus: 200, expectedContentType: "text/plain" },
        // MCP API endpoint (direct access)
        { url: `${vercelUrl}/api/fern-docs/mcp`, expectedStatus: 200, expectedContentType: "text/plain" },
        // Markdown endpoints (.md and .mdx extensions for LLM consumption)
        { url: `${vercelUrl}/home/welcome.mdx`, expectedStatus: 200, expectedContentType: "text/plain" },
        // API endpoint markdown format (for LLM consumption of API docs)
        {
            url: `${vercelUrl}/home/rest-api/rest-api/plant/add-plant.mdx`,
            expectedStatus: 200,
            expectedContentType: "text/plain"
        },
        // Nested llms.txt for product sections
        { url: `${vercelUrl}/home/llms.txt`, expectedStatus: 200 },
        { url: `${vercelUrl}/second-product/llms.txt`, expectedStatus: 200 }
    ];

    // URL expectations map for easy lookup
    const urlExpectations = new Map<string, UrlExpectation>();
    specificUrls.forEach((spec) => {
        urlExpectations.set(spec.url, spec);
    });

    // Combine sitemap URLs with specific URLs and deduplicate
    const allUrls = [...sitemapUrls, ...specificUrls.map((s) => s.url)];
    const urlsToVisit: string[] = [];
    for (const url of allUrls) {
        if (!visitedUrls.has(url)) {
            visitedUrls.add(url);
            urlsToVisit.push(url);
        }
    }

    console.log(`Total URLs to crawl: ${urlsToVisit.length}`);
    console.log(`- From sitemap: ${sitemapUrls.length}`);
    console.log(`- Specific URLs: ${specificUrls.length}`);
    console.log(`- Concurrency: ${concurrency}`);

    console.log(`\nStarting parallel crawl with ${concurrency} concurrent pages...`);

    // Process pages in batches
    let pageIndex = 0;
    for (let i = 0; i < urlsToVisit.length; i += concurrency) {
        const batch = urlsToVisit.slice(i, i + concurrency);
        const batchPromises = batch.map((url) => {
            pageIndex++;
            const expectations = urlExpectations.get(url) || { url, expectedStatus: 200 };
            return processPage(context, url, expectations, pageIndex);
        });

        const batchResults = await Promise.all(batchPromises);

        // Aggregate results from batch
        for (const pageResult of batchResults) {
            results.totalPages++;
            if (pageResult.success) {
                results.successfulPages++;
            } else {
                results.failedPages++;
            }
            results.consoleErrors.push(...pageResult.consoleErrors);
            results.networkErrors.push(...pageResult.networkErrors);
            results.pageErrors.push(...pageResult.pageErrors);
        }
    }

    await context.close();
    await browser.close();

    console.log("\n" + "=".repeat(60));
    console.log("CRAWL SUMMARY");
    console.log("=".repeat(60));
    console.log(`Total pages crawled: ${results.totalPages}`);
    console.log(`Successful pages: ${results.successfulPages}`);
    console.log(`Pages with errors: ${results.failedPages}`);
    console.log(`Console errors: ${results.consoleErrors.length}`);
    console.log(`Network errors: ${results.networkErrors.length}`);
    console.log(`Page errors: ${results.pageErrors.length}`);

    return results;
}

function generateSummary(results: CrawlResults): string {
    const urlsWithErrors = new Set<string>();
    results.consoleErrors.forEach((err) => urlsWithErrors.add(err.url));
    results.networkErrors.forEach((err) => urlsWithErrors.add(err.url));
    results.pageErrors.forEach((err) => urlsWithErrors.add(err.url));

    let summary = `## Smoke Test Crawler Results\n\n`;
    summary += `**Pages crawled:** ${results.totalPages}\n`;
    summary += `**Successful:** ${results.successfulPages}${results.failedPages === 0 ? " [ok]" : ""}\n`;
    summary += `**With errors:** ${results.failedPages}${results.failedPages > 0 ? " [x]" : ""}\n\n`;

    if (results.failedPages === 0) {
        summary += `All pages loaded successfully with no errors!\n`;
    } else {
        summary += `### Pages with Errors\n\n`;

        Array.from(urlsWithErrors).forEach((url) => {
            summary += `**${url}**\n`;

            const consoleErrs = results.consoleErrors.filter((e) => e.url === url);
            if (consoleErrs.length > 0) {
                summary += `- Console errors (${consoleErrs.length}):\n`;
                consoleErrs.slice(0, 3).forEach((err) => {
                    summary += `  - ${err.error}\n`;
                });
                if (consoleErrs.length > 3) {
                    summary += `  - ... and ${consoleErrs.length - 3} more\n`;
                }
            }

            const netErrs = results.networkErrors.filter((e) => e.url === url);
            if (netErrs.length > 0) {
                summary += `- Network errors (${netErrs.length}):\n`;
                netErrs.slice(0, 3).forEach((err) => {
                    summary += `  - Failed to load \`${err.failedUrl}\`: ${err.error}\n`;
                });
                if (netErrs.length > 3) {
                    summary += `  - ... and ${netErrs.length - 3} more\n`;
                }
            }

            const pageErrs = results.pageErrors.filter((e) => e.url === url);
            if (pageErrs.length > 0) {
                summary += `- Page errors (${pageErrs.length}):\n`;
                pageErrs.slice(0, 3).forEach((err) => {
                    summary += `  - ${err.error}\n`;
                });
                if (pageErrs.length > 3) {
                    summary += `  - ... and ${pageErrs.length - 3} more\n`;
                }
            }

            summary += `\n`;
        });

        summary += `\n<details>\n<summary>Full error breakdown</summary>\n\n`;
        summary += `- **Console errors:** ${results.consoleErrors.length}\n`;
        summary += `- **Network errors:** ${results.networkErrors.length}\n`;
        summary += `- **Page errors:** ${results.pageErrors.length}\n`;
        summary += `\nSee full details in the workflow logs.\n`;
        summary += `</details>\n`;
    }

    return summary;
}

function printUsage(): void {
    console.log(`
Usage: pnpm smoke-test <vercel-url> <smoke-test-host> [options]

Arguments:
  vercel-url       The Vercel deployment URL
  smoke-test-host  The smoke test host domain

Options:
  --output, -o       Output directory for results (default: ./smoke-test-output)
  --concurrency, -c  Number of pages to process in parallel (default: 3, "auto" for CPU cores, "auto2x" for 2x CPU cores)
  --help, -h         Show this help message

Examples:
  pnpm smoke-test https://prodferndocscom-git-xxx.vercel.app smoke-test-preview-xxx.docs.buildwithfern.com
  pnpm smoke-test https://preview.vercel.app host.docs.buildwithfern.com --concurrency auto2x
`);
}

async function main() {
    const args = process.argv.slice(2);

    // Check for help flag
    if (args.includes("--help") || args.includes("-h")) {
        printUsage();
        process.exit(0);
    }

    // Parse arguments
    let vercelUrl = "";
    let smokeTestHost = "";
    let outputDir = "./smoke-test-output";
    let concurrency = 3;

    const nonFlagArgs: string[] = [];
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        const nextArg = args[i + 1];

        if ((arg === "--output" || arg === "-o") && nextArg) {
            outputDir = nextArg;
            i++;
        } else if ((arg === "--concurrency" || arg === "-c") && nextArg) {
            if (nextArg === "auto") {
                concurrency = os.cpus().length;
                console.log(`Using auto concurrency: ${concurrency} CPU cores`);
            } else if (nextArg === "auto2x") {
                concurrency = os.cpus().length * 2;
                console.log(`Using auto2x concurrency: ${concurrency} (2x CPU cores)`);
            } else {
                concurrency = parseInt(nextArg, 10);
            }
            i++;
        } else if (!arg.startsWith("-")) {
            nonFlagArgs.push(arg);
        }
    }

    if (nonFlagArgs.length < 2) {
        console.error("Error: Missing required arguments");
        printUsage();
        process.exit(1);
    }

    vercelUrl = nonFlagArgs[0];
    smokeTestHost = nonFlagArgs[1];

    console.log(`Vercel URL: ${vercelUrl}`);
    console.log(`Smoke Test Host: ${smokeTestHost}`);
    console.log(`Output Directory: ${outputDir}`);
    console.log(`Concurrency: ${concurrency}`);

    // Create output directory
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // Run the crawler
    const results = await crawlSite(vercelUrl, smokeTestHost, concurrency);

    // Write detailed results to file
    fs.writeFileSync(path.join(outputDir, "crawler-results.json"), JSON.stringify(results, null, 2));

    // Generate and write summary
    const summary = generateSummary(results);
    fs.writeFileSync(path.join(outputDir, "crawler-summary.txt"), summary);

    console.log(`\nResults saved to ${outputDir}/`);

    // Exit with error code if there were failures
    if (results.failedPages > 0) {
        process.exit(1);
    }

    process.exit(0);
}

main().catch((error) => {
    console.error("Smoke test failed:", error);
    process.exit(1);
});
