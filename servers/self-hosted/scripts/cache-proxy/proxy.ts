/**
 * Main cache proxy: forwards requests to the Next.js backend,
 * caches responses, and exposes cache control API endpoints.
 */

import { getTTLFromHeaders, isCacheable, setCdnCacheHeaders } from "./cache-utils";
import { BACKEND_ORIGIN, DEFAULT_TTL, MAX_CACHE_ENTRY_SIZE, PROXY_PORT } from "./config";
import { debug, log } from "./logger";
import { cache, getCacheStatsHeaders } from "./lru-cache";

/**
 * Proxy request to the backend Next.js server using native fetch.
 */
export async function proxyRequest(req: Request, cacheKey: string | null): Promise<Response> {
    const url = new URL(req.url);
    const backendUrl = `${BACKEND_ORIGIN}${url.pathname}${url.search}`;

    // Preserve the original Host header so Next.js middleware can build correct redirect URLs
    const originalHost = req.headers.get("host") || new URL(BACKEND_ORIGIN).host;

    // Strip prefetch headers so Next.js always returns the full page response (not
    // the lightweight partial payload). This means prefetch requests get the same
    // full response from cache, so navigation is instant when the user clicks.
    const forwardHeaders = new Headers(req.headers);
    forwardHeaders.delete("next-router-prefetch");
    forwardHeaders.delete("next-router-segment-prefetch");
    forwardHeaders.set("host", new URL(BACKEND_ORIGIN).host);
    forwardHeaders.set("x-forwarded-host", originalHost);
    forwardHeaders.set("x-forwarded-port", String(PROXY_PORT));

    try {
        const backendRes = await fetch(backendUrl, {
            method: req.method,
            headers: forwardHeaders,
            body: req.method !== "GET" && req.method !== "HEAD" ? req.body : undefined,
            redirect: "manual",
            // Prevent Bun from automatically decompressing gzip/br/deflate responses.
            // We want to forward the raw compressed bytes to the client (and store them
            // compressed in cache) so that Content-Encoding headers remain correct and
            // browsers handle decompression themselves.
            decompress: false
        });

        const statusCode = backendRes.status;
        const headers = backendRes.headers;
        const contentType = headers.get("content-type") || "";
        const isHtmlPage = contentType.includes("text/html");
        const isRscResponse = contentType.includes("text/x-component");

        // For HTML pages and RSC responses, use DEFAULT_TTL instead of parsing headers (Next.js sends no-cache)
        const ttl = isHtmlPage || isRscResponse ? DEFAULT_TTL : getTTLFromHeaders(headers);
        const shouldCache = cacheKey && isCacheable(statusCode, headers);

        const isRsc = isRscResponse ? "RSC" : isHtmlPage ? "HTML" : "OTHER";
        debug(
            `[${isRsc}] Backend ${statusCode} for ${url.pathname} (cacheable: ${shouldCache}, ttl: ${ttl}s, type: ${contentType})`
        );

        const statsHeaders = getCacheStatsHeaders();

        if (shouldCache && backendRes.body) {
            const [clientStream, cacheStream] = backendRes.body.tee();

            const responseHeaders = new Headers(setCdnCacheHeaders(headers, true));
            responseHeaders.set("x-cache", "MISS");
            for (const [k, v] of Object.entries(statsHeaders)) {
                responseHeaders.set(k, v);
            }

            collectAndCache(cacheStream, cacheKey, statusCode, responseHeaders, ttl, isRsc, url.pathname);

            return new Response(clientStream, { status: statusCode, headers: responseHeaders });
        }

        const bypassHeaders = new Headers(headers);
        bypassHeaders.set("x-cache", "BYPASS");
        for (const [k, v] of Object.entries(statsHeaders)) {
            bypassHeaders.set(k, v);
        }
        if (statusCode === 200 && (url.pathname.includes("/_files/") || url.pathname.endsWith("/favicon.ico"))) {
            bypassHeaders.set("cache-control", "public, max-age=31536000, immutable");
        }
        return new Response(backendRes.body, { status: statusCode, headers: bypassHeaders });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        log(`Proxy error: ${message}`);
        return new Response("Bad Gateway", { status: 502, headers: { "Content-Type": "text/plain" } });
    }
}

async function collectAndCache(
    stream: ReadableStream<Uint8Array>,
    cacheKey: string,
    statusCode: number,
    headers: Headers,
    ttl: number,
    isRsc: string,
    pathname: string
): Promise<void> {
    try {
        const chunks: Uint8Array[] = [];
        let totalSize = 0;
        const reader = stream.getReader();

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }
            totalSize += value.length;
            if (totalSize <= MAX_CACHE_ENTRY_SIZE) {
                chunks.push(value);
            }
        }

        if (totalSize <= MAX_CACHE_ENTRY_SIZE) {
            const body = new Uint8Array(totalSize);
            let offset = 0;
            for (const chunk of chunks) {
                body.set(chunk, offset);
                offset += chunk.length;
            }
            cache.set(cacheKey, { statusCode, headers: new Headers(headers), body }, ttl);
            debug(`[${isRsc}] CACHED ${pathname} (${totalSize} bytes, TTL: ${ttl}s, key: ${cacheKey})`);
        } else {
            debug(`[${isRsc}] NOT CACHED (too large) ${pathname} (${totalSize} bytes, max: ${MAX_CACHE_ENTRY_SIZE})`);
        }
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        debug(`Cache collection error for ${pathname}: ${message}`);
    }
}

/**
 * Handle cache control API requests (/__cache/*).
 * Returns a Response if the request was handled, null otherwise.
 */
export function handleCacheControl(req: Request): Response | null {
    const url = new URL(req.url);

    if (url.pathname === "/__cache/stats") {
        return Response.json(cache.stats());
    }

    if (url.pathname === "/__cache/clear" && req.method === "POST") {
        cache.clear();
        log("Cache cleared");
        return Response.json({ success: true, message: "Cache cleared" });
    }

    if (url.pathname === "/__cache/invalidate" && req.method === "POST") {
        const pattern = url.searchParams.get("pattern") || "";
        const count = cache.invalidatePattern(pattern);
        log(`Invalidated ${count} entries matching: ${pattern}`);
        return Response.json({ success: true, invalidated: count });
    }

    return null;
}
