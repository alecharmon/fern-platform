/**
 * Cache utility functions: key generation, bypass logic, TTL parsing,
 * CDN header management, and cacheability checks.
 */

import { getAuthInfoFromRequest } from "./auth";
import { CACHE_DISABLED, CDN_TTL, DEFAULT_TTL, EXCLUDED_PATHS, EXCLUDED_PATHS_WITH_EXCEPTIONS } from "./config";

/**
 * Normalize the URL for cache key generation.
 *
 * Strips the `_rsc` query parameter which Next.js uses as a per-navigation cache-buster.
 * Each browser navigation generates a unique `_rsc` value (e.g., `?_rsc=1rneo`, `?_rsc=16xxn`),
 * so including it in the cache key would cause every RSC request to be a cache miss.
 */
function normalizeUrlForCacheKey(url: string): string {
    const qIndex = url.indexOf("?");
    if (qIndex === -1) {
        return url;
    }

    const pathname = url.slice(0, qIndex);
    const search = url.slice(qIndex + 1);

    // Remove _rsc parameter while preserving other query params
    const params = search.split("&").filter((p) => !p.startsWith("_rsc=") && p !== "_rsc");

    return params.length > 0 ? `${pathname}?${params.join("&")}` : pathname;
}

/**
 * Generate cache key from request.
 *
 * Includes auth state (isLoggedIn + roles) so different auth states get separate cache entries.
 * Also includes Next.js RSC-related headers so that HTML page requests and RSC (client-side
 * navigation) requests are cached separately — Next.js returns completely different content
 * (text/html vs text/x-component) depending on these headers (see the Vary response header).
 */
export async function getCacheKey(req: Request): Promise<string> {
    const authInfo = await getAuthInfoFromRequest(req);
    const rolesKey = authInfo.roles.sort().join(",");

    // Include the RSC header in the cache key so that HTML page requests and RSC (client-side
    // navigation) requests are cached separately — Next.js returns completely different content
    // (text/html vs text/x-component) depending on this header (see the Vary response header).
    // Note: prefetch headers (next-router-prefetch, next-router-segment-prefetch) are stripped
    // by the proxy before forwarding, so the backend always returns the full response.
    const rsc = req.headers.get("rsc") || "";

    // Normalize URL to strip _rsc query param (Next.js cache-buster that changes per navigation)
    const url = new URL(req.url);
    const normalizedUrl = normalizeUrlForCacheKey(url.pathname + url.search);

    return `${req.method}:${authInfo.isLoggedIn}:${rolesKey}:${rsc}:${normalizedUrl}`;
}

/**
 * Check if request should bypass cache.
 * Returns null if caching is allowed, or a reason string if bypassed.
 */
export function shouldBypassCache(req: Request): string | null {
    // Skip all caching if disabled
    if (CACHE_DISABLED) {
        return "cache_disabled";
    }

    // Don't cache non-GET requests
    if (req.method !== "GET") {
        return `method_${req.method}`;
    }

    const parsedUrl = new URL(req.url);
    const url = parsedUrl.pathname + parsedUrl.search;

    // Check excluded paths with exceptions
    for (const { pattern, exceptions } of EXCLUDED_PATHS_WITH_EXCEPTIONS) {
        if (url.includes(pattern)) {
            const hasException = exceptions.some((exception) => url.includes(exception));
            if (!hasException) {
                return `excluded_path:${pattern}`;
            }
        }
    }

    // Check excluded paths
    for (const path of EXCLUDED_PATHS) {
        if (url.includes(path)) {
            return `excluded_path:${path}`;
        }
    }

    // NOTE: We intentionally do NOT respect the request's Cache-Control: no-cache header.
    // Browsers send "no-cache" on RSC fetch requests to bypass the browser's own HTTP cache,
    // but our proxy should still serve and store cached responses. The whole purpose of this
    // proxy is to aggressively cache page/RSC responses to avoid re-rendering on every request.

    return null;
}

/**
 * Parse TTL from response headers.
 */
export function getTTLFromHeaders(headers: Headers): number {
    const cacheControl = headers.get("cache-control");
    if (!cacheControl) {
        return DEFAULT_TTL;
    }

    // Check for no-store or no-cache
    if (cacheControl.includes("no-store") || cacheControl.includes("no-cache")) {
        return 0;
    }

    // Parse max-age
    const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
    if (maxAgeMatch) {
        return parseInt(maxAgeMatch[1], 10);
    }

    // Parse s-maxage (takes precedence for shared caches)
    const sMaxAgeMatch = cacheControl.match(/s-maxage=(\d+)/);
    if (sMaxAgeMatch) {
        return parseInt(sMaxAgeMatch[1], 10);
    }

    return DEFAULT_TTL;
}

/**
 * Set CDN-friendly cache headers for downstream caches (e.g., CloudFront).
 * This allows CDNs to cache the response while still allowing the proxy to serve stale content.
 */
export function setCdnCacheHeaders(headers: Headers, isCacheableResponse: boolean): Headers {
    const newHeaders = new Headers(headers);

    if (isCacheableResponse && CDN_TTL > 0) {
        // s-maxage is for shared caches (CDNs), max-age is for browser cache
        // stale-while-revalidate allows CDN to serve stale content while fetching fresh
        newHeaders.set(
            "cache-control",
            `public, max-age=${CDN_TTL}, s-maxage=${CDN_TTL}, stale-while-revalidate=${CDN_TTL}`
        );
    }

    return newHeaders;
}

/**
 * Check if response is cacheable.
 */
export function isCacheable(statusCode: number, headers: Headers): boolean {
    // Only cache successful responses
    if (statusCode !== 200) {
        return false;
    }

    // Check content type
    const contentType = headers.get("content-type") || "";
    const isHtmlPage = contentType.includes("text/html");
    const isRscResponse = contentType.includes("text/x-component");

    // For HTML pages and RSC responses, be aggressive - cache regardless of Cache-Control headers
    // Next.js sends no-cache/private by default for SSR pages, but we want to cache them
    // RSC responses (text/x-component) are used for client-side navigation
    if (isHtmlPage || isRscResponse) {
        return true;
    }

    // For non-HTML responses, respect Cache-Control headers
    const cacheControl = headers.get("cache-control") || "";
    if (cacheControl.includes("no-store") || cacheControl.includes("private")) {
        return false;
    }

    return true;
}
