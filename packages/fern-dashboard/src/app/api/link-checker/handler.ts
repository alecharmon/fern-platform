import pLimit from "p-limit";

import type { BrokenLink, CompleteData, SendEventFn } from "./types";

const PAGE_CONCURRENCY = 3;
const LINK_CONCURRENCY = 5;
const REQUEST_TIMEOUT = 15000;
const MAX_REDIRECTS = 5;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryDelay(response: Response, attempt: number): number {
    // Check for Retry-After header (common with 429)
    const retryAfter = response.headers.get("retry-after");
    if (retryAfter) {
        const seconds = parseInt(retryAfter, 10);
        if (!isNaN(seconds)) {
            return Math.min(seconds * 1000, 10000); // Cap at 10 seconds
        }
    }
    // Exponential backoff: 1s, 2s, 4s...
    return RETRY_DELAY_MS * Math.pow(2, attempt);
}

// Browser-like headers to avoid bot detection
const BROWSER_HEADERS = {
    "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "no-cache",
    Pragma: "no-cache"
};

const SKIP_EXTENSIONS = new Set([
    ".css",
    ".js",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".svg",
    ".ico",
    ".woff",
    ".woff2",
    ".ttf",
    ".eot",
    ".pdf",
    ".zip",
    ".tar",
    ".gz"
]);

const SKIP_PROTOCOLS = new Set(["mailto:", "tel:", "javascript:", "data:"]);

interface LinkInfo {
    url: string;
    sourcePages: Set<string>;
}

function shouldSkipUrl(url: string): boolean {
    const lowerUrl = url.toLowerCase();

    for (const protocol of SKIP_PROTOCOLS) {
        if (lowerUrl.startsWith(protocol)) {
            return true;
        }
    }

    if (url.startsWith("#")) {
        return true;
    }

    try {
        const parsed = new URL(url);
        const pathname = parsed.pathname.toLowerCase();
        for (const ext of SKIP_EXTENSIONS) {
            if (pathname.endsWith(ext)) {
                return true;
            }
        }
    } catch {
        // If we can't parse it, don't skip
    }

    return false;
}

function normalizeUrl(url: string, baseUrl: string): string | null {
    try {
        if (url.startsWith("//")) {
            url = "https:" + url;
        }

        const resolved = new URL(url, baseUrl);

        resolved.hash = "";

        return resolved.href;
    } catch {
        return null;
    }
}

function isInternalLink(linkUrl: string, domainWithPath: string): boolean {
    try {
        const parsed = new URL(linkUrl);
        // Extract hostname and optional path from the domain parameter
        // domainWithPath could be "docs.example.com" or "docs.example.com/api"
        const [hostname, ...pathParts] = domainWithPath.split("/");
        const basePath = pathParts.length > 0 ? "/" + pathParts.join("/") : "";

        const hostnameMatches = parsed.hostname === hostname || parsed.hostname.endsWith("." + hostname);

        if (!hostnameMatches) {
            return false;
        }

        // If there's a base path, check if the link path starts with it
        if (basePath && !parsed.pathname.startsWith(basePath)) {
            return false;
        }

        return true;
    } catch {
        return false;
    }
}

async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
            redirect: "follow"
        });
        return response;
    } finally {
        clearTimeout(timeout);
    }
}

export async function fetchSitemap(domain: string): Promise<string[]> {
    const sitemapUrl = `https://${domain}/sitemap.xml`;

    const response = await fetchWithTimeout(sitemapUrl);

    if (!response.ok) {
        throw new Error(`Failed to fetch sitemap: ${response.status} ${response.statusText}`);
    }

    const xml = await response.text();

    const locMatches = xml.matchAll(/<loc>([^<]+)<\/loc>/g);
    const urls: string[] = [];

    for (const match of locMatches) {
        const url = match[1]?.trim();
        if (url) {
            urls.push(url);
        }
    }

    if (urls.length === 0) {
        throw new Error("No pages found in sitemap");
    }

    return urls;
}

export async function scrapePage(pageUrl: string): Promise<string[]> {
    const response = await fetchWithTimeout(pageUrl, {
        headers: BROWSER_HEADERS
    });

    if (!response.ok) {
        return [];
    }

    const html = await response.text();

    // Only match anchor tags, not <link> tags for stylesheets, canonical URLs, etc.
    const hrefMatches = html.matchAll(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>/gi);
    const links: string[] = [];

    for (const match of hrefMatches) {
        const href = match[1]?.trim();
        if (!href) {
            continue;
        }

        if (shouldSkipUrl(href)) {
            continue;
        }

        const normalizedUrl = normalizeUrl(href, pageUrl);
        if (normalizedUrl) {
            links.push(normalizedUrl);
        }
    }

    return [...new Set(links)];
}

export async function checkLink(url: string): Promise<{ statusCode: number | null; error?: string }> {
    let redirectCount = 0;
    let currentUrl = url;
    let retryCount = 0;

    while (redirectCount < MAX_REDIRECTS) {
        try {
            // First try HEAD request with browser headers
            const headResponse = await fetchWithTimeout(currentUrl, {
                method: "HEAD",
                headers: BROWSER_HEADERS,
                redirect: "manual"
            });

            if (headResponse.status >= 300 && headResponse.status < 400) {
                const location = headResponse.headers.get("location");
                if (location) {
                    currentUrl = normalizeUrl(location, currentUrl) || location;
                    redirectCount++;
                    continue;
                }
            }

            // Handle rate limiting (429) and service unavailable (503) with retry
            if ((headResponse.status === 429 || headResponse.status === 503) && retryCount < MAX_RETRIES) {
                const delay = getRetryDelay(headResponse, retryCount);
                await sleep(delay);
                retryCount++;
                continue;
            }

            // If HEAD returns 403, 404, or 405, some servers don't support HEAD - try GET
            if (headResponse.status === 403 || headResponse.status === 404 || headResponse.status === 405) {
                const getResponse = await fetchWithTimeout(currentUrl, {
                    method: "GET",
                    headers: BROWSER_HEADERS,
                    redirect: "manual"
                });

                if (getResponse.status >= 300 && getResponse.status < 400) {
                    const location = getResponse.headers.get("location");
                    if (location) {
                        currentUrl = normalizeUrl(location, currentUrl) || location;
                        redirectCount++;
                        continue;
                    }
                }

                // Handle rate limiting (429) and service unavailable (503) with retry
                if ((getResponse.status === 429 || getResponse.status === 503) && retryCount < MAX_RETRIES) {
                    const delay = getRetryDelay(getResponse, retryCount);
                    await sleep(delay);
                    retryCount++;
                    continue;
                }

                // If still 403, mark as blocked (likely bot detection)
                if (getResponse.status === 403) {
                    return { statusCode: null, error: "blocked" };
                }

                return { statusCode: getResponse.status };
            }

            return { statusCode: headResponse.status };
        } catch (error) {
            if (error instanceof Error && error.name === "AbortError") {
                return { statusCode: null, error: "timeout" };
            }

            // Network error - try GET as fallback
            try {
                const response = await fetchWithTimeout(currentUrl, {
                    method: "GET",
                    headers: BROWSER_HEADERS,
                    redirect: "manual"
                });

                if (response.status >= 300 && response.status < 400) {
                    const location = response.headers.get("location");
                    if (location) {
                        currentUrl = normalizeUrl(location, currentUrl) || location;
                        redirectCount++;
                        continue;
                    }
                }

                // Handle rate limiting (429) and service unavailable (503) with retry
                if ((response.status === 429 || response.status === 503) && retryCount < MAX_RETRIES) {
                    const delay = getRetryDelay(response, retryCount);
                    await sleep(delay);
                    retryCount++;
                    continue;
                }

                if (response.status === 403) {
                    return { statusCode: null, error: "blocked" };
                }

                return { statusCode: response.status };
            } catch (getError) {
                if (getError instanceof Error) {
                    if (getError.name === "AbortError") {
                        return { statusCode: null, error: "timeout" };
                    }
                    return { statusCode: null, error: getError.message };
                }
                return { statusCode: null, error: "Unknown error" };
            }
        }
    }

    return { statusCode: null, error: "Too many redirects" };
}

export async function runLinkChecker(domain: string, sendEvent: SendEventFn): Promise<void> {
    const startTime = Date.now();

    let pages: string[];
    try {
        pages = await fetchSitemap(domain);
        sendEvent({
            type: "sitemap_fetched",
            data: {
                totalPages: pages.length,
                sitemapUrl: `https://${domain}/sitemap.xml`
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        sendEvent({
            type: "error",
            data: {
                message: error instanceof Error ? error.message : "Failed to fetch sitemap",
                code: "SITEMAP_FETCH_ERROR"
            },
            timestamp: new Date().toISOString()
        });
        return;
    }

    const allLinks = new Map<string, LinkInfo>();
    const pageLimit = pLimit(PAGE_CONCURRENCY);

    let pagesScraped = 0;
    await Promise.all(
        pages.map((pageUrl) =>
            pageLimit(async () => {
                try {
                    const links = await scrapePage(pageUrl);

                    for (const link of links) {
                        const existing = allLinks.get(link);
                        if (existing) {
                            existing.sourcePages.add(pageUrl);
                        } else {
                            allLinks.set(link, {
                                url: link,
                                sourcePages: new Set([pageUrl])
                            });
                        }
                    }

                    pagesScraped++;
                    sendEvent({
                        type: "page_scraped",
                        data: {
                            pageUrl,
                            linksFound: links.length,
                            pageIndex: pagesScraped,
                            totalPages: pages.length
                        },
                        timestamp: new Date().toISOString()
                    });
                } catch (error) {
                    console.error(`[link-checker] error scraping ${pageUrl}: ${error}`);
                    pagesScraped++;
                    sendEvent({
                        type: "page_scraped",
                        data: {
                            pageUrl,
                            linksFound: 0,
                            pageIndex: pagesScraped,
                            totalPages: pages.length
                        },
                        timestamp: new Date().toISOString()
                    });
                }
            })
        )
    );

    const linkLimit = pLimit(LINK_CONCURRENCY);
    const brokenLinks: BrokenLink[] = [];
    const blockedLinks: BrokenLink[] = [];
    let workingLinks = 0;
    let skippedLinks = 0;
    let linksChecked = 0;

    const linkEntries = Array.from(allLinks.entries());
    const totalLinks = linkEntries.length;

    // Send event that link checking has started
    sendEvent({
        type: "links_check_started",
        data: {
            totalLinks
        },
        timestamp: new Date().toISOString()
    });

    await Promise.all(
        linkEntries.map(([url, linkInfo]) =>
            linkLimit(async () => {
                const result = await checkLink(url);
                linksChecked++;

                // Send progress update every 10 links or on last link
                if (linksChecked % 10 === 0 || linksChecked === totalLinks) {
                    sendEvent({
                        type: "link_check_progress",
                        data: {
                            linksChecked,
                            totalLinks
                        },
                        timestamp: new Date().toISOString()
                    });
                }

                // Handle blocked links (403 with bot detection)
                if (result.error === "blocked") {
                    const blockedLink: BrokenLink = {
                        url,
                        statusCode: null,
                        error: "blocked",
                        sourcePages: Array.from(linkInfo.sourcePages),
                        isInternal: isInternalLink(url, domain)
                    };
                    blockedLinks.push(blockedLink);

                    sendEvent({
                        type: "link_blocked",
                        data: {
                            url,
                            statusCode: null,
                            isInternal: blockedLink.isInternal,
                            sourcePages: blockedLink.sourcePages,
                            error: "blocked"
                        },
                        timestamp: new Date().toISOString()
                    });
                    return;
                }

                // Handle other skipped links (timeout, network errors)
                if (result.statusCode === null) {
                    skippedLinks++;
                    return;
                }

                if (result.statusCode >= 400) {
                    const brokenLink: BrokenLink = {
                        url,
                        statusCode: result.statusCode,
                        error: result.error,
                        sourcePages: Array.from(linkInfo.sourcePages),
                        isInternal: isInternalLink(url, domain)
                    };
                    brokenLinks.push(brokenLink);

                    sendEvent({
                        type: "link_checked",
                        data: {
                            url,
                            statusCode: result.statusCode,
                            isInternal: brokenLink.isInternal,
                            sourcePages: brokenLink.sourcePages,
                            error: result.error
                        },
                        timestamp: new Date().toISOString()
                    });
                } else {
                    workingLinks++;
                }
            })
        )
    );

    const duration = Date.now() - startTime;

    const completeData: CompleteData = {
        totalPages: pages.length,
        totalLinks: allLinks.size,
        brokenLinks,
        blockedLinks,
        workingLinks,
        skippedLinks,
        duration
    };

    sendEvent({
        type: "complete",
        data: completeData,
        timestamp: new Date().toISOString()
    });
}
