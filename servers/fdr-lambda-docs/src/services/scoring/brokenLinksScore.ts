import type { PageData } from "./types";
import {
    BROWSER_HEADERS,
    extractLinksFromHtml,
    fetchWithTimeout,
    getRetryDelay,
    LINK_CONCURRENCY,
    MAX_REDIRECTS,
    MAX_RETRIES,
    normalizeUrl,
    sleep
} from "./utils";

interface LinkInfo {
    url: string;
    sourcePages: Set<string>;
}

async function checkLink(url: string): Promise<{ statusCode: number | null; error?: string }> {
    let redirectCount = 0;
    let currentUrl = url;
    let retryCount = 0;

    while (redirectCount < MAX_REDIRECTS) {
        try {
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

            if ((headResponse.status === 429 || headResponse.status === 503) && retryCount < MAX_RETRIES) {
                const delay = getRetryDelay(headResponse, retryCount);
                await sleep(delay);
                retryCount++;
                continue;
            }

            // If HEAD returns 403, 404, or 405, try GET (some servers don't support HEAD)
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

                if ((getResponse.status === 429 || getResponse.status === 503) && retryCount < MAX_RETRIES) {
                    const delay = getRetryDelay(getResponse, retryCount);
                    await sleep(delay);
                    retryCount++;
                    continue;
                }

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

export interface BrokenLink {
    url: string;
    statusCode: number;
}

/**
 * Checks all links across pages and returns a mapping of page URL -> broken links found on that page.
 * Each unique link is only checked once, but the result is mapped back to all pages containing it.
 */
export async function getBrokenLinksPerPage(pages: PageData[]): Promise<Map<string, BrokenLink[]>> {
    const brokenLinksPerPage = new Map<string, BrokenLink[]>();

    // Initialize empty arrays for all pages
    for (const page of pages) {
        brokenLinksPerPage.set(page.url, []);
    }

    // Collect all unique links and their source pages
    const allLinks = new Map<string, LinkInfo>();

    for (const page of pages) {
        const links = extractLinksFromHtml(page.html, page.url);
        for (const link of links) {
            const existing = allLinks.get(link);
            if (existing) {
                existing.sourcePages.add(page.url);
            } else {
                allLinks.set(link, {
                    url: link,
                    sourcePages: new Set([page.url])
                });
            }
        }
    }

    // Check links with limited concurrency
    const linkEntries = Array.from(allLinks.entries());

    for (let i = 0; i < linkEntries.length; i += LINK_CONCURRENCY) {
        const batch = linkEntries.slice(i, i + LINK_CONCURRENCY);
        const results = await Promise.all(
            batch.map(async ([url, linkInfo]) => {
                const result = await checkLink(url);
                return { url, linkInfo, result };
            })
        );

        for (const { url, linkInfo, result } of results) {
            // Only report actual broken links (4xx, 5xx status codes)
            if (result.statusCode !== null && result.statusCode >= 400) {
                const brokenLink: BrokenLink = { url, statusCode: result.statusCode };

                // Add this broken link to all pages that contain it
                for (const sourcePageUrl of linkInfo.sourcePages) {
                    const pageLinks = brokenLinksPerPage.get(sourcePageUrl);
                    if (pageLinks) {
                        pageLinks.push(brokenLink);
                    }
                }
            }
        }
    }

    return brokenLinksPerPage;
}
