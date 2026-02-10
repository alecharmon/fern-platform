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
// CDN TTL for downstream caches (e.g., CloudFront) - 1 hour default
const CDN_TTL = parseInt(process.env.CACHE_CDN_TTL || "3600", 10);
// Docs site domain for CORS proxy validation (e.g., "docs.example.com")
// Uses NEXT_PUBLIC_DOCS_DOMAIN_URL which is already set by run.sh from the docs.yml config
const DOCS_DOMAIN = process.env.NEXT_PUBLIC_DOCS_DOMAIN_URL || "";

// Additional allowed domains for CORS proxy (comma-separated list of root domains)
// Example: "api.example.com,partner.example.org" allows *.example.com and *.example.org
const ADDITIONAL_ALLOWED_DOMAINS = process.env.CORS_PROXY_ALLOWED_DOMAINS
    ? process.env.CORS_PROXY_ALLOWED_DOMAINS.split(",")
          .map((d) => d.trim().toLowerCase())
          .filter(Boolean)
    : [];

// Test login configuration - enables a mock login endpoint for testing basic_token_verification
const TEST_LOGIN_ENABLED = process.env.FERN_AUTH_TEST_LOGIN === "1" || process.env.FERN_AUTH_TEST_LOGIN === "true";
const FERN_AUTH_SECRET = process.env.FERN_AUTH_SECRET || "";
const FERN_AUTH_ISSUER = process.env.FERN_AUTH_ISSUER || "https://buildwithfern.com";

/**
 * Extract the root domain from a hostname.
 * For example: "docs.example.com" -> "example.com"
 * Handles common TLDs like .com, .org, .io, .co.uk, etc.
 */
function getRootDomain(hostname) {
    const parts = hostname.toLowerCase().split(".");
    if (parts.length <= 2) {
        return hostname.toLowerCase();
    }
    // Handle common two-part TLDs like .co.uk, .com.au, etc.
    const twoPartTlds = ["co.uk", "com.au", "co.nz", "co.jp", "com.br", "co.in", "org.uk", "net.au"];
    const lastTwo = parts.slice(-2).join(".");
    if (twoPartTlds.includes(lastTwo)) {
        return parts.slice(-3).join(".");
    }
    return parts.slice(-2).join(".");
}

/**
 * Check if a target hostname matches a given allowed domain.
 * Returns true if target matches the root domain or is a subdomain of it.
 */
function matchesDomain(targetHostname, allowedDomain) {
    const allowedRoot = getRootDomain(allowedDomain);
    const targetLower = targetHostname.toLowerCase();
    return targetLower === allowedRoot || targetLower.endsWith("." + allowedRoot);
}

/**
 * Check if a target hostname is allowed based on the docs domain and additional allowed domains.
 * Returns true if the target domain matches or is a subdomain of any allowed root domain.
 */
function isProxyTargetAllowed(targetHostname, docsDomain, additionalDomains) {
    // If no docs domain is configured, allow all (backward compatibility)
    if (!docsDomain && additionalDomains.length === 0) {
        return true;
    }
    // Check against docs domain
    if (docsDomain && matchesDomain(targetHostname, docsDomain)) {
        return true;
    }
    // Check against additional allowed domains
    for (const domain of additionalDomains) {
        if (matchesDomain(targetHostname, domain)) {
            return true;
        }
    }
    return false;
}

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
    "/_next/image", // Image optimization - browsers handle caching
    "/api/fern-docs/search/v2/facet", // Search facets need fresh results with query params
    "/api/fern-docs/search/v2/key" // Search API keys should not be cached
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

// Set CDN-friendly cache headers for downstream caches (e.g., CloudFront)
// This allows CDNs to cache the response while still allowing the proxy to serve stale content
function setCdnCacheHeaders(headers, isCacheableResponse) {
    const newHeaders = { ...headers };

    if (isCacheableResponse && CDN_TTL > 0) {
        // Set Cache-Control for downstream CDNs
        // s-maxage is for shared caches (CDNs), max-age is for browser cache
        // stale-while-revalidate allows CDN to serve stale content while fetching fresh
        newHeaders["cache-control"] =
            `public, max-age=${CDN_TTL}, s-maxage=${CDN_TTL}, stale-while-revalidate=${CDN_TTL}`;
    }

    return newHeaders;
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
    // Preserve the original Host header so Next.js middleware can build correct redirect URLs
    const originalHost = req.headers.host || `${BACKEND_HOST}:${BACKEND_PORT}`;
    const options = {
        hostname: BACKEND_HOST,
        port: BACKEND_PORT,
        path: req.url,
        method: req.method,
        headers: {
            ...req.headers,
            host: `${BACKEND_HOST}:${BACKEND_PORT}`,
            "x-forwarded-host": originalHost,
            "x-forwarded-port": String(PROXY_PORT)
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

        // Set CDN-friendly cache headers for cacheable responses
        const responseHeaders = setCdnCacheHeaders(headers, shouldCache);

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
                            headers: { ...responseHeaders },
                            body
                        },
                        ttl
                    );
                    debug(`Cached: ${cacheKey} (${body.length} bytes, TTL: ${ttl}s)`);
                } else {
                    debug(`Not cached (too large): ${cacheKey} (${totalSize} bytes)`);
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
        log(`CORS proxy error: Missing target URL`);
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("Missing target URL");
        return;
    }

    let parsedUrl;
    try {
        parsedUrl = new URL(targetUrl);
    } catch {
        log(`CORS proxy error: Invalid target URL - ${targetUrl}`);
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("Invalid target URL");
        return;
    }

    // Only allow http and https protocols
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        log(`CORS proxy error: Unsupported protocol - ${parsedUrl.protocol}`);
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("Only HTTP and HTTPS protocols are supported");
        return;
    }

    // Validate that the target domain matches the docs site domain (SSRF protection)
    if (!isProxyTargetAllowed(parsedUrl.hostname, DOCS_DOMAIN, ADDITIONAL_ALLOWED_DOMAINS)) {
        log(`CORS proxy error: Domain not allowed - ${parsedUrl.hostname} (docs domain: ${DOCS_DOMAIN})`);
        res.writeHead(403, { "Content-Type": "text/plain", "Access-Control-Allow-Origin": "*" });
        res.end("Proxy target domain not allowed");
        return;
    }

    // Log the request (excluding sensitive headers/API keys)
    log(`CORS proxy request: ${req.method} ${parsedUrl.origin}${parsedUrl.pathname}`);

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

        // Log the response (status code and timing only, no sensitive data)
        log(`CORS proxy response: ${proxyRes.statusCode} ${parsedUrl.origin}${parsedUrl.pathname} (${responseTime}ms)`);

        res.writeHead(proxyRes.statusCode, responseHeaders);
        proxyRes.pipe(res);
    });

    proxyReq.on("error", (err) => {
        log(`CORS proxy error: ${err.message} - ${parsedUrl.origin}${parsedUrl.pathname}`);
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

// ============================================================================
// Test Login Endpoint
// ============================================================================
// When FERN_AUTH_TEST_LOGIN=true, this provides a mock login page for testing
// basic_token_verification auth without needing a real auth provider.
//
// Flow:
// 1. User visits docs → middleware sees no fern_token → redirects to FERN_AUTH_REDIRECT
// 2. Set FERN_AUTH_REDIRECT to http://<host>/__test-login
// 3. User sees "Login with Test" button → clicks it
// 4. Proxy mints a valid JWT, sets fern_token cookie, redirects back to docs
// ============================================================================

const crypto = require("crypto");

/**
 * Create a base64url-encoded string from a Buffer or string.
 */
function base64url(input) {
    const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, "utf8");
    return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

/**
 * Mint a Fern JWT compatible with basic_token_verification.
 * Uses HMAC-SHA256 (HS256) matching the jose library's signFernJWT.
 */
function mintTestFernJWT(secret, issuer) {
    const header = { alg: "HS256", typ: "JWT" };
    const now = Math.floor(Date.now() / 1000);
    const payload = {
        fern: {},
        iat: now,
        exp: now + 30 * 24 * 60 * 60, // 30 days
        iss: issuer || "https://buildwithfern.com"
    };

    const headerB64 = base64url(JSON.stringify(header));
    const payloadB64 = base64url(JSON.stringify(payload));
    const signature = crypto.createHmac("sha256", secret).update(`${headerB64}.${payloadB64}`).digest();
    const signatureB64 = base64url(signature);

    return `${headerB64}.${payloadB64}.${signatureB64}`;
}

/**
 * Fix protocol for localhost URLs: https://localhost → http://localhost.
 * The middleware may incorrectly produce https:// for localhost when the host
 * contains URL-encoded characters (e.g. localhost%3A3000).
 */
function fixLocalhostProtocol(url) {
    if (typeof url === "string" && url.startsWith("https://localhost")) {
        return "http" + url.slice(5);
    }
    return url;
}

/**
 * Serve the test login HTML page.
 *
 * The middleware redirects here with query params:
 *   - redirect_uri: the /api/fern-docs/auth/jwt/callback URL
 *   - state: the URL the user was trying to visit
 *
 * On click, we mint a JWT and redirect to the real callback route,
 * which verifies the token and sets the fern_token cookie properly.
 */
function serveTestLoginPage(req, res) {
    const url = new URL(req.url, `http://localhost:${PROXY_PORT}`);
    // The middleware sets these when redirecting to the login page
    const redirectUri = url.searchParams.get("redirect_uri") || "";
    const state = url.searchParams.get("state") || "/";

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Login - Fern Docs</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
            color: #e2e8f0;
        }
        .card {
            background: #1e293b;
            border: 1px solid #334155;
            border-radius: 12px;
            padding: 40px;
            max-width: 420px;
            width: 90%;
            text-align: center;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }
        .logo {
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 8px;
            color: #f8fafc;
        }
        .subtitle {
            color: #94a3b8;
            font-size: 14px;
            margin-bottom: 32px;
        }
        .info {
            background: #0f172a;
            border: 1px solid #334155;
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 24px;
            text-align: left;
            font-size: 13px;
            color: #94a3b8;
            line-height: 1.5;
        }
        .info code {
            background: #334155;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'SF Mono', Consolas, monospace;
            font-size: 12px;
            color: #e2e8f0;
        }
        .badge {
            display: inline-block;
            background: #f59e0b20;
            color: #f59e0b;
            border: 1px solid #f59e0b40;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            margin-bottom: 24px;
            letter-spacing: 0.5px;
        }
        form { width: 100%; }
        button {
            width: 100%;
            padding: 14px 24px;
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        }
        button:hover {
            transform: translateY(-1px);
            box-shadow: 0 8px 25px -5px rgba(99, 102, 241, 0.4);
        }
        button:active {
            transform: translateY(0);
        }
        .return-to {
            margin-top: 16px;
            font-size: 12px;
            color: #64748b;
            word-break: break-all;
        }
    </style>
</head>
<body>
    <div class="card">
        <div class="logo">Fern Docs</div>
        <div class="subtitle">Self-Hosted Authentication Test</div>
        <div class="badge">TEST MODE</div>
        <div class="info">
            This is a <strong style="color: #e2e8f0;">test login page</strong> for validating
            <code>basic_token_verification</code> auth in the self-hosted container.
            Clicking the button below will mint a valid JWT and redirect through
            the standard <code>/api/fern-docs/auth/jwt/callback</code> route.
        </div>
        <form method="POST" action="/__test-login">
            <input type="hidden" name="redirect_uri" value="${redirectUri.replace(/"/g, "&quot;")}" />
            <input type="hidden" name="state" value="${state.replace(/"/g, "&quot;")}" />
            <button type="submit">Login with Test</button>
        </form>
        <div class="return-to">Redirecting to: ${state.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
    </div>
</body>
</html>`;

    res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store"
    });
    res.end(html);
}

/**
 * Handle POST to /__test-login: mint JWT, set cookie directly, redirect back.
 *
 * Sets the fern_token cookie at the proxy layer and redirects the user back
 * to the docs. This bypasses /api/fern-docs/auth/jwt/callback because that
 * route's cookie-setting logic uses req.nextUrl.host which resolves to the
 * internal Next.js port (127.0.0.1:3001) in self-hosted mode, producing
 * cookies with wrong domain/secure flags that browsers reject.
 */
function handleTestLoginPost(req, res) {
    // Collect the POST body to read the form fields
    let body = "";
    req.on("data", (chunk) => {
        body += chunk.toString();
    });
    req.on("end", () => {
        const params = new URLSearchParams(body);
        // Decode values -- the middleware may URL-encode the colon in localhost:3000
        // as %3A, which propagates through the form fields.
        const state = fixLocalhostProtocol(decodeURIComponent(params.get("state") || "/"));

        if (!FERN_AUTH_SECRET) {
            log("Test login error: FERN_AUTH_SECRET is not set");
            res.writeHead(500, { "Content-Type": "text/plain" });
            res.end("FERN_AUTH_SECRET is required for test login");
            return;
        }

        // Mint the JWT
        const token = mintTestFernJWT(FERN_AUTH_SECRET, FERN_AUTH_ISSUER);
        log(`Test login: minted JWT (issuer=${FERN_AUTH_ISSUER}), redirecting to ${state}`);

        // Set the fern_token cookie directly and redirect to the return URL.
        // Use permissive cookie settings since this is for testing on localhost/self-hosted.
        const cookieValue = `fern_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`;
        res.writeHead(302, {
            Location: state,
            "Set-Cookie": cookieValue,
            "Cache-Control": "no-store"
        });
        res.end();
    });
}

/**
 * Handle the test login endpoint (GET shows page, POST mints token).
 * Returns true if the request was handled, false otherwise.
 */
function handleTestLogin(req, res) {
    if (!TEST_LOGIN_ENABLED) {
        return false;
    }

    const url = new URL(req.url, `http://localhost:${PROXY_PORT}`);
    if (url.pathname !== "/__test-login") {
        return false;
    }

    if (req.method === "GET") {
        serveTestLoginPage(req, res);
        return true;
    }

    if (req.method === "POST") {
        handleTestLoginPost(req, res);
        return true;
    }

    res.writeHead(405, { "Content-Type": "text/plain" });
    res.end("Method not allowed");
    return true;
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

    // Handle test login endpoint
    if (req.url.startsWith("/__test-login")) {
        if (handleTestLogin(req, res)) {
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

    // Validate that the target domain matches the docs site domain (SSRF protection)
    if (!isProxyTargetAllowed(parsedUrl.hostname, DOCS_DOMAIN, ADDITIONAL_ALLOWED_DOMAINS)) {
        log(`CORS proxy WebSocket error: Domain not allowed - ${parsedUrl.hostname} (docs domain: ${DOCS_DOMAIN})`);
        clientSocket.end("HTTP/1.1 403 Forbidden\r\n\r\nProxy target domain not allowed");
        return;
    }

    // Log WebSocket proxy request (excluding sensitive data)
    log(`CORS proxy WebSocket upgrade: ${parsedUrl.origin}${parsedUrl.pathname}`);

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
        log(`CORS proxy WebSocket error: ${err.message} - ${parsedUrl.origin}${parsedUrl.pathname}`);
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
        log(`CDN TTL: ${CDN_TTL} seconds (for downstream caches like CloudFront)`);
    }
    log(`CORS proxy: enabled at /__proxy/`);
    if (DOCS_DOMAIN || ADDITIONAL_ALLOWED_DOMAINS.length > 0) {
        const allowedDomains = [];
        if (DOCS_DOMAIN) {
            allowedDomains.push(`*.${getRootDomain(DOCS_DOMAIN)}`);
        }
        for (const domain of ADDITIONAL_ALLOWED_DOMAINS) {
            allowedDomains.push(`*.${getRootDomain(domain)}`);
        }
        log(`CORS proxy domain restriction: ${allowedDomains.join(", ")}`);
        if (ADDITIONAL_ALLOWED_DOMAINS.length > 0) {
            log(`  Additional domains from CORS_PROXY_ALLOWED_DOMAINS: ${ADDITIONAL_ALLOWED_DOMAINS.join(", ")}`);
        }
    } else {
        log(
            `CORS proxy domain restriction: DISABLED (set NEXT_PUBLIC_DOCS_DOMAIN_URL or CORS_PROXY_ALLOWED_DOMAINS to enable)`
        );
    }
    if (TEST_LOGIN_ENABLED) {
        log(
            `Test login: ENABLED at /__test-login (set FERN_AUTH_REDIRECT to http://<host>:${PROXY_PORT}/__test-login)`
        );
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
