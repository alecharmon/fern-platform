/**
 * Main cache proxy: forwards requests to the Next.js backend,
 * caches responses, and exposes cache control API endpoints.
 */

import http from "http";
import { URL } from "url";
import { getTTLFromHeaders, isCacheable, setCdnCacheHeaders } from "./cache-utils";
import { BACKEND_HOST, BACKEND_PORT, DEFAULT_TTL, MAX_CACHE_ENTRY_SIZE, PROXY_PORT } from "./config";
import { debug, log } from "./logger";
import { cache } from "./lru-cache";

/**
 * Proxy request to the backend Next.js server.
 */
export function proxyRequest(req: http.IncomingMessage, res: http.ServerResponse, cacheKey: string | null): void {
    // Preserve the original Host header so Next.js middleware can build correct redirect URLs
    const originalHost = req.headers.host || `${BACKEND_HOST}:${BACKEND_PORT}`;
    // Strip prefetch headers so Next.js always returns the full page response (not
    // the lightweight partial payload). This means prefetch requests get the same
    // full response from cache, so navigation is instant when the user clicks.
    const forwardHeaders = { ...req.headers };
    delete forwardHeaders["next-router-prefetch"];
    delete forwardHeaders["next-router-segment-prefetch"];

    const options: http.RequestOptions = {
        hostname: BACKEND_HOST,
        port: BACKEND_PORT,
        path: req.url,
        method: req.method,
        headers: {
            ...forwardHeaders,
            host: `${BACKEND_HOST}:${BACKEND_PORT}`,
            "x-forwarded-host": originalHost,
            "x-forwarded-port": String(PROXY_PORT)
        }
    };

    const proxyReq = http.request(options, (proxyRes) => {
        const statusCode = proxyRes.statusCode || 500;
        const headers = proxyRes.headers;
        const contentType = (headers["content-type"] as string) || "";
        const isHtmlPage = contentType.includes("text/html");
        const isRscResponse = contentType.includes("text/x-component");

        // For HTML pages and RSC responses, use DEFAULT_TTL instead of parsing headers (Next.js sends no-cache)
        const ttl = isHtmlPage || isRscResponse ? DEFAULT_TTL : getTTLFromHeaders(headers);
        const shouldCache = cacheKey && isCacheable(statusCode, headers, req.url || "");

        const isRsc = isRscResponse ? "RSC" : isHtmlPage ? "HTML" : "OTHER";
        debug(
            `[${isRsc}] Backend ${statusCode} for ${req.url} (cacheable: ${shouldCache}, ttl: ${ttl}s, type: ${contentType})`
        );

        // Set CDN-friendly cache headers for cacheable responses
        const responseHeaders = setCdnCacheHeaders(headers, !!shouldCache);

        if (shouldCache) {
            // Collect response body for caching
            const chunks: Buffer[] = [];
            let totalSize = 0;

            proxyRes.on("data", (chunk: Buffer) => {
                totalSize += chunk.length;
                if (totalSize <= MAX_CACHE_ENTRY_SIZE) {
                    chunks.push(chunk);
                }
            });

            proxyRes.on("end", () => {
                if (totalSize <= MAX_CACHE_ENTRY_SIZE) {
                    const body = Buffer.concat(chunks);
                    cache.set(cacheKey, { statusCode, headers: { ...responseHeaders }, body }, ttl);
                    debug(`[${isRsc}] CACHED ${req.url} (${body.length} bytes, TTL: ${ttl}s, key: ${cacheKey})`);
                } else {
                    debug(
                        `[${isRsc}] NOT CACHED (too large) ${req.url} (${totalSize} bytes, max: ${MAX_CACHE_ENTRY_SIZE})`
                    );
                }
            });

            // Stream response to client with CDN-friendly headers
            res.writeHead(statusCode, responseHeaders);
            proxyRes.pipe(res);
        } else {
            // Stream directly without caching
            res.writeHead(statusCode, headers);
            proxyRes.pipe(res);
        }
    });

    proxyReq.on("error", (err) => {
        log(`Proxy error: ${err.message}`);
        if (!res.headersSent) {
            res.writeHead(502, { "Content-Type": "text/plain" });
            res.end("Bad Gateway");
        }
    });

    // Forward request body if present
    req.pipe(proxyReq);
}

/**
 * Handle cache control API requests (/__cache/*).
 * Returns true if the request was handled, false otherwise.
 */
export function handleCacheControl(req: http.IncomingMessage, res: http.ServerResponse): boolean {
    const url = new URL(req.url || "", `http://localhost:${PROXY_PORT}`);

    if (url.pathname === "/__cache/stats") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(cache.stats(), null, 2));
        return true;
    }

    if (url.pathname === "/__cache/clear" && req.method === "POST") {
        cache.clear();
        log("Cache cleared");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, message: "Cache cleared" }));
        return true;
    }

    if (url.pathname === "/__cache/invalidate" && req.method === "POST") {
        const pattern = url.searchParams.get("pattern") || "";
        const count = cache.invalidatePattern(pattern);
        log(`Invalidated ${count} entries matching: ${pattern}`);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, invalidated: count }));
        return true;
    }

    return false;
}
