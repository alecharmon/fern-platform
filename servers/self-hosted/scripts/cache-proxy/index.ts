#!/usr/bin/env node

/**
 * Lightweight HTTP caching proxy for self-hosted Fern docs.
 *
 * This proxy sits in front of Next.js and caches full page responses
 * to avoid re-rendering pages on every request.
 *
 * Features:
 * - In-memory LRU cache with configurable size
 * - Auth-aware caching with role-based cache keys
 * - Cache invalidation via API
 * - Respects Cache-Control headers
 * - Streaming support for large responses
 * - CORS proxy for API Explorer
 * - Test login endpoint for auth testing
 */

import http from "http";
import { getCacheKey, shouldBypassCache } from "./cache-utils";
import {
    ADDITIONAL_ALLOWED_DOMAINS,
    BACKEND_HOST,
    BACKEND_PORT,
    CACHE_DISABLED,
    CDN_TTL,
    DEBUG,
    DEFAULT_TTL,
    DOCS_DOMAIN,
    FERN_AUTH_TYPE,
    MAX_CACHE_ENTRY_SIZE,
    MAX_CACHE_SIZE,
    PROXY_PORT,
    TEST_LOGIN_ENABLED
} from "./config";
import { handleCorsPreflightProxy, handleCorsProxy, handleWebSocketUpgrade } from "./cors-proxy";
import { getRootDomain } from "./domain-utils";
import { debug, log } from "./logger";
import { cache } from "./lru-cache";
import { handleCacheControl, proxyRequest } from "./proxy";
import { handleTestLogin } from "./test-login";

// Main request handler
function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const startTime = Date.now();

    // Handle cache control endpoints
    if (req.url?.startsWith("/__cache/")) {
        if (handleCacheControl(req, res)) {
            return;
        }
    }

    // Handle test login endpoint
    if (req.url?.startsWith("/__test-login")) {
        if (handleTestLogin(req, res)) {
            return;
        }
    }

    // Handle CORS proxy requests
    if (req.url?.startsWith("/__proxy/")) {
        if (req.method === "OPTIONS") {
            handleCorsPreflightProxy(req, res);
        } else {
            handleCorsProxy(req, res);
        }
        return;
    }

    const url = req.url || "";
    const isRsc = !!req.headers["rsc"];
    const reqType = isRsc ? "RSC" : "HTML";
    const bypassReason = shouldBypassCache(req);
    const cacheKey = bypassReason ? null : getCacheKey(req);

    if (!bypassReason) {
        const cached = cache.get(cacheKey!);
        if (cached) {
            const age = Math.floor((Date.now() - cached.cachedAt) / 1000);
            debug(`[${reqType}] HIT  ${url} (age: ${age}s, key: ${cacheKey})`);

            // Add cache headers
            const headers = {
                ...cached.headers,
                "x-cache": "HIT",
                "x-cache-age": age.toString()
            };

            res.writeHead(cached.statusCode, headers);
            res.end(cached.body);

            const duration = Date.now() - startTime;
            debug(`Served from cache in ${duration}ms: ${url}`);
            return;
        }
        debug(`[${reqType}] MISS ${url} (key: ${cacheKey})`);
    } else {
        debug(`[${reqType}] BYPASS ${url} (reason: ${bypassReason})`);
    }

    // Proxy to backend
    proxyRequest(req, res, cacheKey);
}

// Start server
const server = http.createServer(handleRequest);

// Handle WebSocket upgrade requests
server.on("upgrade", (req, clientSocket, head) => {
    handleWebSocketUpgrade(req, clientSocket, head);
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
        const allowedDomains: string[] = [];
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
    if (FERN_AUTH_TYPE) {
        log(`Auth-aware caching: enabled (auth type: ${FERN_AUTH_TYPE}, cache keys include isLoggedIn + roles)`);
    } else {
        log(`Auth-aware caching: disabled (no FERN_AUTH_TYPE configured)`);
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
