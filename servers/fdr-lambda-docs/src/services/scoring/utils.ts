import type { PageData } from "./types";

export const REQUEST_TIMEOUT = 15000;
export const MAX_REDIRECTS = 5;
export const MAX_RETRIES = 2;
export const RETRY_DELAY_MS = 1000;
export const PAGE_CONCURRENCY = 3;
export const LINK_CONCURRENCY = 5;

export const BROWSER_HEADERS = {
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

export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
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

export async function fetchPage(url: string): Promise<string> {
    const response = await fetchWithTimeout(url, {
        headers: BROWSER_HEADERS
    });

    if (!response.ok) {
        return "";
    }

    return response.text();
}

export async function fetchAllPages(domain: string): Promise<PageData[]> {
    const urls = await fetchSitemap(domain);
    const pages: PageData[] = [];

    // Fetch pages with limited concurrency
    const limit = PAGE_CONCURRENCY;
    for (let i = 0; i < urls.length; i += limit) {
        const batch = urls.slice(i, i + limit);
        const results = await Promise.all(
            batch.map(async (url) => {
                const html = await fetchPage(url);
                return { url, html };
            })
        );
        pages.push(...results.filter((p) => p.html.length > 0));
    }

    return pages;
}

export function shouldSkipUrl(url: string): boolean {
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

export function normalizeUrl(url: string, baseUrl: string): string | null {
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

export function extractLinksFromHtml(html: string, baseUrl: string): string[] {
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

        const normalizedUrl = normalizeUrl(href, baseUrl);
        if (normalizedUrl) {
            links.push(normalizedUrl);
        }
    }

    return [...new Set(links)];
}

export function countWords(html: string): number {
    // Remove script/style tags and HTML
    const text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    return text.split(" ").filter((w) => w.length > 0).length;
}

export function getRetryDelay(response: Response, attempt: number): number {
    const retryAfter = response.headers.get("retry-after");
    if (retryAfter) {
        const seconds = parseInt(retryAfter, 10);
        if (!isNaN(seconds)) {
            return Math.min(seconds * 1000, 10000);
        }
    }
    return RETRY_DELAY_MS * Math.pow(2, attempt);
}
