#!/usr/bin/env node

/**
 * Lightweight HTTP caching proxy for self-hosted Fern docs.
 *
 * This proxy sits in front of Next.js and caches full page responses
 * to avoid re-rendering pages on every request.
 *
 * Features:
 * - In-memory LRU cache with configurable size
 * - Cache bypass for authenticated requests
 * - Cache invalidation via API
 * - Respects Cache-Control headers
 * - Streaming support for large responses
 */

const http = require("http");
const { URL } = require("url");

// Configuration from environment
const PROXY_PORT = parseInt(process.env.CACHE_PROXY_PORT || "3000", 10);
const BACKEND_PORT = parseInt(process.env.NEXTJS_PORT || "3001", 10);
const BACKEND_HOST = process.env.NEXTJS_HOST || "127.0.0.1";
const MAX_CACHE_SIZE = parseInt(process.env.CACHE_MAX_ENTRIES || "1000", 10);
const MAX_CACHE_ENTRY_SIZE = parseInt(process.env.CACHE_MAX_ENTRY_SIZE || "5242880", 10); // 5MB default
const DEFAULT_TTL = parseInt(process.env.CACHE_DEFAULT_TTL || "2592000", 10); // 30 days default
const DEBUG = process.env.CACHE_PROXY_DEBUG === "1";
const CACHE_DISABLED = process.env.CACHE_DISABLED === "1" || process.env.CACHE_DISABLED === "true";

// LRU Cache implementation
class LRUCache {
    constructor(maxSize) {
        this.maxSize = maxSize;
        this.cache = new Map();
        this.hits = 0;
        this.misses = 0;
    }

    get(key) {
        if (!this.cache.has(key)) {
            this.misses++;
            return null;
        }

        const entry = this.cache.get(key);

        // Check if expired
        if (entry.expiresAt && entry.expiresAt < Date.now()) {
            this.cache.delete(key);
            this.misses++;
            return null;
        }

        // Move to end (most recently used)
        this.cache.delete(key);
        this.cache.set(key, entry);
        this.hits++;
        return entry;
    }

    set(key, value, ttlSeconds) {
        // Delete if exists (to update position)
        if (this.cache.has(key)) {
            this.cache.delete(key);
        }

        // Evict oldest if at capacity
        while (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }

        const entry = {
            ...value,
            cachedAt: Date.now(),
            expiresAt: ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null
        };

        this.cache.set(key, entry);
    }

    delete(key) {
        return this.cache.delete(key);
    }

    clear() {
        this.cache.clear();
    }

    // Delete entries matching a pattern (for cache invalidation)
    invalidatePattern(pattern) {
        let count = 0;
        for (const key of this.cache.keys()) {
            if (key.includes(pattern)) {
                this.cache.delete(key);
                count++;
            }
        }
        return count;
    }

    stats() {
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            hits: this.hits,
            misses: this.misses,
            hitRate:
                this.hits + this.misses > 0 ? ((this.hits / (this.hits + this.misses)) * 100).toFixed(2) + "%" : "N/A"
        };
    }
}

const cache = new LRUCache(MAX_CACHE_SIZE);

function log(...args) {
    // biome-ignore lint/suspicious/noConsole: This is a server script that needs to log
    console.log(`[${new Date().toISOString()}] [cache-proxy]`, ...args);
}

function debug(...args) {
    if (DEBUG) {
        log("[DEBUG]", ...args);
    }
}

// Generate cache key from request
// In self-hosted mode, we don't vary by host since there's only one domain
function getCacheKey(req) {
    return `${req.method}:${req.url}`;
}

// Check if request should bypass cache
function shouldBypassCache(req) {
    // Skip all caching if disabled
    if (CACHE_DISABLED) {
        return true;
    }

    // Don't cache non-GET requests
    if (req.method !== "GET") {
        return true;
    }

    // Don't cache requests with authentication
    if (req.headers["authorization"] || req.headers["cookie"]?.includes("fern_token")) {
        return true;
    }

    // Don't cache API routes (except some specific ones)
    if (req.url.includes("/api/") && !req.url.includes("/api/fern-docs/favicon")) {
        return true;
    }

    // Don't cache static assets - browsers cache these with immutable headers
    // This saves proxy memory for HTML pages which benefit most from caching
    if (req.url.startsWith("/_next/static/") || req.url.startsWith("/_next/image")) {
        return true;
    }

    // Don't cache if Cache-Control: no-cache
    if (req.headers["cache-control"]?.includes("no-cache")) {
        return true;
    }

    return false;
}

// Parse TTL from response headers
function getTTLFromHeaders(headers) {
    const cacheControl = headers["cache-control"];
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

// Check if response is cacheable
function isCacheable(statusCode, headers, url) {
    // Only cache successful responses
    if (statusCode !== 200) {
        return false;
    }

    // Check content type
    const contentType = headers["content-type"] || "";
    const isHtmlPage = contentType.includes("text/html");
    const isRscResponse = contentType.includes("text/x-component");

    // For HTML pages and RSC responses, be aggressive - cache regardless of Cache-Control headers
    // Next.js sends no-cache/private by default for SSR pages, but we want to cache them
    // RSC responses (text/x-component) are used for client-side navigation
    if (isHtmlPage || isRscResponse) {
        return true;
    }

    // For non-HTML responses, respect Cache-Control headers
    const cacheControl = headers["cache-control"] || "";
    if (cacheControl.includes("no-store") || cacheControl.includes("private")) {
        return false;
    }

    return true;
}

// Proxy request to backend
function proxyRequest(req, res, cacheKey) {
    const options = {
        hostname: BACKEND_HOST,
        port: BACKEND_PORT,
        path: req.url,
        method: req.method,
        headers: {
            ...req.headers,
            host: `${BACKEND_HOST}:${BACKEND_PORT}`
        }
    };

    const proxyReq = http.request(options, (proxyRes) => {
        const statusCode = proxyRes.statusCode;
        const headers = proxyRes.headers;
        const contentType = headers["content-type"] || "";
        const isHtmlPage = contentType.includes("text/html");
        const isRscResponse = contentType.includes("text/x-component");

        // For HTML pages and RSC responses, use DEFAULT_TTL instead of parsing headers (Next.js sends no-cache)
        const ttl = isHtmlPage || isRscResponse ? DEFAULT_TTL : getTTLFromHeaders(headers);
        const shouldCache = cacheKey && isCacheable(statusCode, headers, req.url);

        debug(`Backend response: ${statusCode}, cacheable: ${shouldCache}, ttl: ${ttl}s, contentType: ${contentType}`);

        if (shouldCache) {
            // Collect response body for caching
            const chunks = [];
            let totalSize = 0;

            proxyRes.on("data", (chunk) => {
                totalSize += chunk.length;
                if (totalSize <= MAX_CACHE_ENTRY_SIZE) {
                    chunks.push(chunk);
                }
            });

            proxyRes.on("end", () => {
                if (totalSize <= MAX_CACHE_ENTRY_SIZE) {
                    const body = Buffer.concat(chunks);
                    cache.set(
                        cacheKey,
                        {
                            statusCode,
                            headers: { ...headers },
                            body
                        },
                        ttl
                    );
                    debug(`Cached: ${cacheKey} (${body.length} bytes, TTL: ${ttl}s)`);
                } else {
                    debug(`Not cached (too large): ${cacheKey} (${totalSize} bytes)`);
                }
            });

            // Stream response to client
            res.writeHead(statusCode, headers);
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

// Handle cache control requests
function handleCacheControl(req, res) {
    const url = new URL(req.url, `http://localhost:${PROXY_PORT}`);

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

// Main request handler
function handleRequest(req, res) {
    const startTime = Date.now();

    // Handle cache control endpoints
    if (req.url.startsWith("/__cache/")) {
        if (handleCacheControl(req, res)) {
            return;
        }
    }

    const bypassCache = shouldBypassCache(req);
    const cacheKey = bypassCache ? null : getCacheKey(req);

    if (!bypassCache) {
        const cached = cache.get(cacheKey);
        if (cached) {
            debug(`Cache HIT: ${cacheKey}`);

            // Add cache headers
            const headers = {
                ...cached.headers,
                "x-cache": "HIT",
                "x-cache-age": Math.floor((Date.now() - cached.cachedAt) / 1000).toString()
            };

            res.writeHead(cached.statusCode, headers);
            res.end(cached.body);

            const duration = Date.now() - startTime;
            debug(`Served from cache in ${duration}ms: ${req.url}`);
            return;
        }
        debug(`Cache MISS: ${cacheKey}`);
    } else {
        debug(`Cache BYPASS: ${req.url}`);
    }

    // Proxy to backend
    proxyRequest(req, res, cacheKey);
}

// Start server
const server = http.createServer(handleRequest);

server.listen(PROXY_PORT, "0.0.0.0", () => {
    log(`Cache proxy listening on port ${PROXY_PORT}`);
    log(`Proxying to ${BACKEND_HOST}:${BACKEND_PORT}`);
    log(`Caching: ${CACHE_DISABLED ? "DISABLED" : "enabled"}`);
    if (!CACHE_DISABLED) {
        log(`Max cache entries: ${MAX_CACHE_SIZE}`);
        log(`Max entry size: ${MAX_CACHE_ENTRY_SIZE} bytes`);
        log(`Default TTL: ${DEFAULT_TTL} seconds`);
    }
    log(`Debug mode: ${DEBUG ? "enabled" : "disabled"}`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
    log("Received SIGTERM, shutting down...");
    log(`Final cache stats: ${JSON.stringify(cache.stats())}`);
    server.close(() => {
        process.exit(0);
    });
});

process.on("SIGINT", () => {
    log("Received SIGINT, shutting down...");
    log(`Final cache stats: ${JSON.stringify(cache.stats())}`);
    server.close(() => {
        process.exit(0);
    });
});
