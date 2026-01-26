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
const https = require("https");
const net = require("net");
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

// Paths that should never be cached
// These patterns are checked using includes() for flexibility
const EXCLUDED_PATHS = [
    "/_search/", // MeiliSearch requests need fresh results
    "/_next/static/", // Static assets - browsers cache these with immutable headers
    "/_next/image" // Image optimization - browsers handle caching
];

// Paths that should be excluded unless they match an exception
const EXCLUDED_PATHS_WITH_EXCEPTIONS = [
    {
        pattern: "/api/",
        exceptions: ["/api/fern-docs/favicon"]
    }
];

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

    // Check excluded paths with exceptions
    for (const { pattern, exceptions } of EXCLUDED_PATHS_WITH_EXCEPTIONS) {
        if (req.url.includes(pattern)) {
            const hasException = exceptions.some((exception) => req.url.includes(exception));
            if (!hasException) {
                return true;
            }
        }
    }

    // Check excluded paths
    for (const path of EXCLUDED_PATHS) {
        if (req.url.includes(path)) {
            return true;
        }
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

/**
 * Handle CORS proxy requests.
 * This endpoint proxies API requests from the API Explorer to external APIs,
 * avoiding CORS issues by making the request server-side.
 *
 * The target URL is extracted from the path after /__proxy/
 * For example: /__proxy/https://api.example.com/v1/users
 */
function handleCorsProxy(req, res) {
    // Extract target URL from the path (everything after /__proxy/)
    const targetUrl = req.url.slice("/__proxy/".length);

    if (!targetUrl) {
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("Missing target URL");
        return;
    }

    let parsedUrl;
    try {
        parsedUrl = new URL(targetUrl);
    } catch {
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("Invalid target URL");
        return;
    }

    // Only allow http and https protocols
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("Only HTTP and HTTPS protocols are supported");
        return;
    }

    debug(`CORS proxy request: ${req.method} ${targetUrl}`);

    // Get the list of headers to forward from the X-Fern-Proxy-Request-Headers header
    const headersToForward = (req.headers["x-fern-proxy-request-headers"] || "").split(",").filter(Boolean);

    // Build headers to forward to the target
    const forwardHeaders = {};
    for (const header of headersToForward) {
        const lowerHeader = header.toLowerCase();
        if (req.headers[lowerHeader] != null) {
            forwardHeaders[header] = req.headers[lowerHeader];
        }
    }

    // Also forward content-type if present (for POST/PUT requests)
    if (req.headers["content-type"]) {
        forwardHeaders["Content-Type"] = req.headers["content-type"];
    }

    const requestModule = parsedUrl.protocol === "https:" ? https : http;

    const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === "https:" ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: req.method,
        headers: forwardHeaders,
        rejectUnauthorized: false
    };

    const startTime = Date.now();

    const proxyReq = requestModule.request(options, (proxyRes) => {
        const endTime = Date.now();
        const responseTime = endTime - startTime;

        // Collect response headers to forward back
        const responseHeaders = {};
        const responseHeadersList = [];

        for (const [key, value] of Object.entries(proxyRes.headers)) {
            // Skip hop-by-hop headers
            const lowerKey = key.toLowerCase();
            if (
                lowerKey === "transfer-encoding" ||
                lowerKey === "connection" ||
                lowerKey === "keep-alive" ||
                lowerKey === "proxy-authenticate" ||
                lowerKey === "proxy-authorization" ||
                lowerKey === "te" ||
                lowerKey === "trailer" ||
                lowerKey === "upgrade"
            ) {
                continue;
            }
            responseHeaders[key] = value;
            responseHeadersList.push(key);
        }

        // Add proxy metadata headers
        responseHeaders["X-Fern-Proxy-Response-Headers"] = responseHeadersList.join(",");
        responseHeaders["X-Fern-Proxy-Response-Time"] = String(responseTime);
        responseHeaders["X-Fern-Proxy-Origin-Latency"] = String(responseTime);

        // Add CORS headers to allow the browser to read the response
        responseHeaders["Access-Control-Allow-Origin"] = "*";
        responseHeaders["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, PATCH, OPTIONS";
        responseHeaders["Access-Control-Allow-Headers"] = "*";
        responseHeaders["Access-Control-Expose-Headers"] =
            responseHeadersList.join(",") +
            ",X-Fern-Proxy-Response-Headers,X-Fern-Proxy-Response-Time,X-Fern-Proxy-Origin-Latency";

        debug(`CORS proxy response: ${proxyRes.statusCode} in ${responseTime}ms`);

        res.writeHead(proxyRes.statusCode, responseHeaders);
        proxyRes.pipe(res);
    });

    proxyReq.on("error", (err) => {
        log(`CORS proxy error: ${err.message}`);
        if (!res.headersSent) {
            res.writeHead(502, {
                "Content-Type": "text/plain",
                "Access-Control-Allow-Origin": "*"
            });
            res.end(`Proxy error: ${err.message}`);
        }
    });

    // Forward request body if present
    req.pipe(proxyReq);
}

/**
 * Handle CORS preflight (OPTIONS) requests for the proxy endpoint.
 */
function handleCorsPreflightProxy(req, res) {
    res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Max-Age": "86400"
    });
    res.end();
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

    // Handle CORS proxy requests
    if (req.url.startsWith("/__proxy/")) {
        if (req.method === "OPTIONS") {
            handleCorsPreflightProxy(req, res);
        } else {
            handleCorsProxy(req, res);
        }
        return;
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

/**
 * Handle WebSocket upgrade requests for the CORS proxy.
 * This allows the API Explorer to work with WebSocket-based APIs.
 */
server.on("upgrade", (req, clientSocket, head) => {
    if (!req.url.startsWith("/__proxy/")) {
        clientSocket.end("HTTP/1.1 404 Not Found\r\n\r\n");
        return;
    }

    // Extract target URL from the path (everything after /__proxy/)
    const targetUrl = req.url.slice("/__proxy/".length);

    if (!targetUrl) {
        clientSocket.end("HTTP/1.1 400 Bad Request\r\n\r\nMissing target URL");
        return;
    }

    let parsedUrl;
    try {
        parsedUrl = new URL(targetUrl);
    } catch {
        clientSocket.end("HTTP/1.1 400 Bad Request\r\n\r\nInvalid target URL");
        return;
    }

    // Only allow ws and wss protocols (converted from http/https)
    const isSecure = parsedUrl.protocol === "https:" || parsedUrl.protocol === "wss:";
    const targetPort = parsedUrl.port || (isSecure ? 443 : 80);

    debug(`WebSocket proxy upgrade: ${targetUrl}`);

    // Create connection to target server
    const targetSocket = isSecure
        ? require("tls").connect(
              {
                  host: parsedUrl.hostname,
                  port: targetPort,
                  servername: parsedUrl.hostname,
                  rejectUnauthorized: false
              },
              () => {
                  // Send the upgrade request to the target
                  const upgradeRequest =
                      `GET ${parsedUrl.pathname}${parsedUrl.search} HTTP/1.1\r\n` +
                      `Host: ${parsedUrl.hostname}\r\n` +
                      `Upgrade: websocket\r\n` +
                      `Connection: Upgrade\r\n` +
                      `Sec-WebSocket-Key: ${req.headers["sec-websocket-key"]}\r\n` +
                      `Sec-WebSocket-Version: ${req.headers["sec-websocket-version"]}\r\n` +
                      (req.headers["sec-websocket-protocol"]
                          ? `Sec-WebSocket-Protocol: ${req.headers["sec-websocket-protocol"]}\r\n`
                          : "") +
                      `\r\n`;
                  targetSocket.write(upgradeRequest);
                  if (head.length > 0) {
                      targetSocket.write(head);
                  }
              }
          )
        : net.connect(targetPort, parsedUrl.hostname, () => {
              // Send the upgrade request to the target
              const upgradeRequest =
                  `GET ${parsedUrl.pathname}${parsedUrl.search} HTTP/1.1\r\n` +
                  `Host: ${parsedUrl.hostname}\r\n` +
                  `Upgrade: websocket\r\n` +
                  `Connection: Upgrade\r\n` +
                  `Sec-WebSocket-Key: ${req.headers["sec-websocket-key"]}\r\n` +
                  `Sec-WebSocket-Version: ${req.headers["sec-websocket-version"]}\r\n` +
                  (req.headers["sec-websocket-protocol"]
                      ? `Sec-WebSocket-Protocol: ${req.headers["sec-websocket-protocol"]}\r\n`
                      : "") +
                  `\r\n`;
              targetSocket.write(upgradeRequest);
              if (head.length > 0) {
                  targetSocket.write(head);
              }
          });

    targetSocket.on("error", (err) => {
        log(`WebSocket proxy error: ${err.message}`);
        clientSocket.end();
    });

    // Once we get data from target, pipe it to client and vice versa
    targetSocket.once("data", (chunk) => {
        // Forward the response (including upgrade response) to client
        clientSocket.write(chunk);
        // Now pipe bidirectionally
        targetSocket.pipe(clientSocket);
        clientSocket.pipe(targetSocket);
    });

    clientSocket.on("error", (err) => {
        debug(`WebSocket client error: ${err.message}`);
        targetSocket.end();
    });

    clientSocket.on("close", () => {
        targetSocket.end();
    });

    targetSocket.on("close", () => {
        clientSocket.end();
    });
});

server.listen(PROXY_PORT, "0.0.0.0", () => {
    log(`Cache proxy listening on port ${PROXY_PORT}`);
    log(`Proxying to ${BACKEND_HOST}:${BACKEND_PORT}`);
    log(`Caching: ${CACHE_DISABLED ? "DISABLED" : "enabled"}`);
    if (!CACHE_DISABLED) {
        log(`Max cache entries: ${MAX_CACHE_SIZE}`);
        log(`Max entry size: ${MAX_CACHE_ENTRY_SIZE} bytes`);
        log(`Default TTL: ${DEFAULT_TTL} seconds`);
    }
    log(`CORS proxy: enabled at /__proxy/`);
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
