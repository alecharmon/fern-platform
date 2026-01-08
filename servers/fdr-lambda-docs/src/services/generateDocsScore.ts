export interface DocsScoreIssue {
    page: string;
    issueType: string;
    suggestedFix: string;
}

export interface DocsScoreCategory {
    categoryName: string;
    issues: DocsScoreIssue[];
}

export interface DocsScoreData {
    categories: DocsScoreCategory[];
}

export interface PageHealthScore {
    url: string;
    score: number;
    issues: DocsScoreIssue[];
}

const DEFAULT_MAX_CONCURRENCY = 10;

/**
 * Placeholder function for calculating health score from HTML content.
 * This will be implemented later with actual scoring logic.
 */
export function getHealthScore(_html: string, url: string): PageHealthScore {
    return {
        url,
        score: 85,
        issues: []
    };
}

// URL patterns to skip (auto-generated pages)
const SKIP_URL_PATTERNS = ["/api-reference", "/api-reference/"];

/**
 * Filters out URLs that should be skipped (e.g., auto-generated API reference pages).
 */
function filterUrls(urls: string[]): string[] {
    return urls.filter((url) => {
        const urlPath = new URL(url).pathname;
        return !SKIP_URL_PATTERNS.some((pattern) => urlPath.includes(pattern));
    });
}

/**
 * Fetches and parses the sitemap.xml for a given domain.
 * Returns an array of page URLs found in the sitemap (excluding auto-generated pages).
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
    const allUrls: string[] = [];

    for (const match of urlMatches) {
        if (match[1]) {
            allUrls.push(match[1]);
        }
    }

    // Filter out auto-generated pages
    const urls = filterUrls(allUrls);

    // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
    console.log(
        `[fetchSitemap] Found ${allUrls.length} URLs in sitemap, ${urls.length} after filtering (skipped ${allUrls.length - urls.length} api-reference pages)`
    );

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
 * Processes a single URL, fetching HTML and calculating health score.
 */
async function processUrl(url: string): Promise<PageHealthScore> {
    try {
        const html = await fetchPageHtml(url);
        return getHealthScore(html, url);
    } catch (error) {
        // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
        console.error(`[processUrl] Error processing ${url}:`, error);
        return {
            url,
            score: 0,
            issues: [
                {
                    page: url,
                    issueType: "Fetch Error",
                    suggestedFix: `Failed to fetch page: ${error instanceof Error ? error.message : "Unknown error"}`
                }
            ]
        };
    }
}

/**
 * Processes all URLs with a concurrent queue that maintains max concurrency.
 * Unlike batch processing, this starts a new request as soon as any completes.
 */
async function processUrlsWithConcurrency(
    urls: string[],
    maxConcurrency: number = DEFAULT_MAX_CONCURRENCY
): Promise<PageHealthScore[]> {
    const results: PageHealthScore[] = new Array(urls.length);
    let nextIndex = 0;
    let completed = 0;

    // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
    console.log(`[processUrlsWithConcurrency] Processing ${urls.length} URLs with max concurrency ${maxConcurrency}`);

    async function worker(): Promise<void> {
        while (nextIndex < urls.length) {
            const index = nextIndex++;
            const url = urls[index];

            // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
            console.log(`[processUrlsWithConcurrency] [${++completed}/${urls.length}] Fetching: ${url}`);

            results[index] = await processUrl(url);
        }
    }

    // Start workers up to maxConcurrency
    const workers = Array.from({ length: Math.min(maxConcurrency, urls.length) }, () => worker());

    await Promise.all(workers);

    return results;
}

/**
 * Aggregates individual page scores into overall score and categorized issues.
 */
function aggregateResults(pageScores: PageHealthScore[]): { score: number; data: DocsScoreData } {
    if (pageScores.length === 0) {
        return {
            score: 0,
            data: { categories: [] }
        };
    }

    // Calculate average score
    const totalScore = pageScores.reduce((sum, page) => sum + page.score, 0);
    const averageScore = Math.round(totalScore / pageScores.length);

    // Group issues by type (category)
    const issuesByCategory = new Map<string, DocsScoreIssue[]>();

    for (const pageScore of pageScores) {
        for (const issue of pageScore.issues) {
            const categoryIssues = issuesByCategory.get(issue.issueType) || [];
            categoryIssues.push(issue);
            issuesByCategory.set(issue.issueType, categoryIssues);
        }
    }

    // Convert to categories array
    const categories: DocsScoreCategory[] = [];
    for (const [categoryName, issues] of issuesByCategory) {
        categories.push({ categoryName, issues });
    }

    return {
        score: averageScore,
        data: { categories }
    };
}

/**
 * Main function to generate docs score by scraping the sitemap and processing pages.
 */
export async function generateDocsScore(
    domain: string,
    maxConcurrency: number = DEFAULT_MAX_CONCURRENCY
): Promise<{ score: number; data: DocsScoreData }> {
    try {
        // Step 1: Fetch sitemap
        const urls = await fetchSitemap(domain);

        if (urls.length === 0) {
            // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
            console.log(`[generateDocsScore] No URLs found in sitemap for ${domain}`);
            return {
                score: 0,
                data: {
                    categories: [
                        {
                            categoryName: "Sitemap",
                            issues: [
                                {
                                    page: `https://${domain}/sitemap.xml`,
                                    issueType: "Empty Sitemap",
                                    suggestedFix: "Add pages to your sitemap.xml"
                                }
                            ]
                        }
                    ]
                }
            };
        }

        // Step 2: Process URLs with concurrent queue
        const pageScores = await processUrlsWithConcurrency(urls, maxConcurrency);

        // Step 3: Aggregate results
        const result = aggregateResults(pageScores);

        // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
        console.log(`[generateDocsScore] Completed scoring for ${domain}: ${result.score}/100`);

        return result;
    } catch (error) {
        // biome-ignore lint/suspicious/noConsole: console output is intentional for lambda logging
        console.error(`[generateDocsScore] Error generating docs score for ${domain}:`, error);

        return {
            score: 0,
            data: {
                categories: [
                    {
                        categoryName: "Error",
                        issues: [
                            {
                                page: `https://${domain}`,
                                issueType: "Scraping Error",
                                suggestedFix: error instanceof Error ? error.message : "Unknown error occurred"
                            }
                        ]
                    }
                ]
            }
        };
    }
}
