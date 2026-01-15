import { type BrokenLink, getBrokenLinksPerPage } from "./scoring/brokenLinksScore";
import { checkPageSeo } from "./scoring/seoScore";
import type { DocsScoreData, DocsScoreIssue, IssueCounts, IssueSeverity, PageData } from "./scoring/types";
import { countWords } from "./scoring/utils";

export type { DocsScoreData, DocsScoreIssue, IssueCounts, IssueSeverity };

export interface PageHealthResult {
    url: string;
    issues: DocsScoreIssue[];
}

const DEFAULT_MAX_CONCURRENCY = 10;
const DEFAULT_PAGE_LENGTH_THRESHOLD = 5000;

/**
 * Collects health issues from HTML content.
 * Checks for SEO issues, page length, and broken links.
 * Severity levels:
 * - high: Broken links, Missing meta description
 * - medium: Missing og:image, Missing alt text
 * - low: Page length issues
 */
export function getHealthIssues(html: string, url: string, brokenLinks: BrokenLink[] = []): PageHealthResult {
    const issues: DocsScoreIssue[] = [];

    // Check SEO issues (severity assigned in checkPageSeo)
    const seoIssues = checkPageSeo(html, url);
    issues.push(...seoIssues);

    // Check page length (low severity)
    const wordCount = countWords(html);
    if (wordCount > DEFAULT_PAGE_LENGTH_THRESHOLD) {
        issues.push({
            page: url,
            issueType: `Page too long (${wordCount.toLocaleString()} words)`,
            suggestedFix: `Consider splitting this page into smaller sections (exceeds ${DEFAULT_PAGE_LENGTH_THRESHOLD.toLocaleString()} word limit)`,
            severity: "low"
        });
    }

    // Add broken link issues (high severity)
    for (const brokenLink of brokenLinks) {
        issues.push({
            page: url,
            issueType: `Broken link (${brokenLink.statusCode})`,
            suggestedFix: `Fix or remove broken link: ${brokenLink.url}`,
            severity: "high"
        });
    }

    return {
        url,
        issues
    };
}

/**
 * Fetches and parses the sitemap.xml for a given domain.
 * Returns an array of page URLs found in the sitemap.
 */
async function fetchSitemap(domain: string): Promise<string[]> {
    const sitemapUrl = `https://${domain}/sitemap.xml`;

    // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
    console.log(`[fetchSitemap] Fetching sitemap from: ${sitemapUrl}`);

    const response = await fetch(sitemapUrl);

    if (!response.ok) {
        throw new Error(`Failed to fetch sitemap: ${response.status} ${response.statusText}`);
    }

    const xml = await response.text();

    // Parse URLs from sitemap XML using regex
    // Sitemaps have <loc>URL</loc> tags
    const urlMatches = xml.matchAll(/<loc>([^<]+)<\/loc>/g);
    const urls: string[] = [];

    for (const match of urlMatches) {
        if (match[1]) {
            urls.push(match[1]);
        }
    }

    // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
    console.log(`[fetchSitemap] Found ${urls.length} URLs in sitemap`);

    return urls;
}

/**
 * Fetches the HTML content of a page.
 */
async function fetchPageHtml(url: string): Promise<string> {
    const response = await fetch(url, {
        headers: {
            "User-Agent": "FernDocsHealthScoreBot/1.0"
        }
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch page ${url}: ${response.status} ${response.statusText}`);
    }

    return response.text();
}

/**
 * Fetches a single URL and returns PageData with HTML content.
 */
async function fetchUrl(url: string): Promise<PageData> {
    try {
        const html = await fetchPageHtml(url);
        return { url, html };
    } catch (error) {
        // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
        console.error(`[fetchUrl] Error fetching ${url}:`, error);
        return { url, html: "" };
    }
}

/**
 * Fetches all URLs with a concurrent queue that maintains max concurrency.
 * Unlike batch processing, this starts a new request as soon as any completes.
 */
async function fetchUrlsWithConcurrency(
    urls: string[],
    maxConcurrency: number = DEFAULT_MAX_CONCURRENCY
): Promise<PageData[]> {
    const results: PageData[] = new Array(urls.length);
    let nextIndex = 0;
    let completed = 0;

    // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
    console.log(`[fetchUrlsWithConcurrency] Fetching ${urls.length} URLs with max concurrency ${maxConcurrency}`);

    async function worker(): Promise<void> {
        while (nextIndex < urls.length) {
            const index = nextIndex++;
            const url = urls[index];

            if (!url) {
                continue;
            }

            // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
            console.log(`[fetchUrlsWithConcurrency] [${++completed}/${urls.length}] Fetching: ${url}`);

            results[index] = await fetchUrl(url);
        }
    }

    // Start workers up to maxConcurrency
    const workers = Array.from({ length: Math.min(maxConcurrency, urls.length) }, () => worker());

    await Promise.all(workers);

    return results;
}

/**
 * Collects issues for all pages using the broken links mapping.
 */
function collectPageIssues(pages: PageData[], brokenLinksPerPage: Map<string, BrokenLink[]>): PageHealthResult[] {
    return pages.map((page) => {
        if (page.html.length === 0) {
            return {
                url: page.url,
                issues: [
                    {
                        page: page.url,
                        issueType: "Fetch Error",
                        suggestedFix: "Failed to fetch page content",
                        severity: "high" as const
                    }
                ]
            };
        }
        const brokenLinks = brokenLinksPerPage.get(page.url) || [];
        return getHealthIssues(page.html, page.url, brokenLinks);
    });
}

/**
 * Aggregates individual page results into issue counts by severity.
 */
function aggregateResults(pageResults: PageHealthResult[]): DocsScoreData {
    const issueCounts: IssueCounts = {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0
    };

    const allIssues: DocsScoreIssue[] = [];

    for (const pageResult of pageResults) {
        for (const issue of pageResult.issues) {
            issueCounts[issue.severity]++;
            allIssues.push(issue);
        }
    }

    return {
        issueCounts,
        issues: allIssues
    };
}

/**
 * Main function to generate docs health data by scraping the sitemap and processing pages.
 */
export async function generateDocsScore(
    domain: string,
    maxConcurrency: number = DEFAULT_MAX_CONCURRENCY
): Promise<DocsScoreData> {
    try {
        // Step 1: Fetch sitemap
        const urls = await fetchSitemap(domain);

        if (urls.length === 0) {
            // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
            console.log(`[generateDocsScore] No URLs found in sitemap for ${domain}`);
            return {
                issueCounts: { critical: 0, high: 1, medium: 0, low: 0 },
                issues: [
                    {
                        page: `https://${domain}/sitemap.xml`,
                        issueType: "Empty Sitemap",
                        suggestedFix: "Add pages to your sitemap.xml",
                        severity: "high"
                    }
                ]
            };
        }

        // Step 2: Fetch all pages
        const pages = await fetchUrlsWithConcurrency(urls, maxConcurrency);
        const validPages = pages.filter((p) => p.html.length > 0);

        // Step 3: Check broken links first to build page -> broken links mapping
        // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
        console.log(`[generateDocsScore] Checking broken links for ${domain}...`);
        const brokenLinksPerPage = await getBrokenLinksPerPage(validPages);

        // Step 4: Collect issues for all pages using the broken links mapping
        // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
        console.log(`[generateDocsScore] Analyzing ${validPages.length} pages...`);
        const pageResults = collectPageIssues(pages, brokenLinksPerPage);

        // Step 5: Aggregate results
        const result = aggregateResults(pageResults);

        // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
        console.log(
            `[generateDocsScore] Completed analysis for ${domain}: ${result.issueCounts.critical} critical, ${result.issueCounts.high} high, ${result.issueCounts.medium} medium, ${result.issueCounts.low} low`
        );

        return result;
    } catch (error) {
        // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
        console.error(`[generateDocsScore] Error generating docs score for ${domain}:`, error);

        return {
            issueCounts: { critical: 0, high: 1, medium: 0, low: 0 },
            issues: [
                {
                    page: `https://${domain}`,
                    issueType: "Scraping Error",
                    suggestedFix: error instanceof Error ? error.message : "Unknown error occurred",
                    severity: "high"
                }
            ]
        };
    }
}
