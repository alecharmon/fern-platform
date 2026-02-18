#!/usr/bin/env bun

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
 * - WebSocket proxy via Bun native WebSocket
 * - Test login endpoint for auth testing
 */

import { writeFileSync } from "node:fs";
import { getCacheKey, shouldBypassCache } from "./cache-utils";
import {
    ADDITIONAL_ALLOWED_DOMAINS,
    ADMIN_TOKEN_PATH,
    BACKEND_HOST,
    BACKEND_PORT,
    CACHE_ADMIN_TOKEN,
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
import { handleCorsPreflightProxy, handleCorsProxy } from "./cors-proxy";
import { getRootDomain, isProxyTargetAllowed } from "./domain-utils";
import { handleExportDownload, handleExportStart, handleExportStatus } from "./export";
import { debug, log } from "./logger";
import { cache, getCacheStatsHeaders } from "./lru-cache";
import { handleCacheControl, proxyRequest } from "./proxy";
import { handleTestLogin } from "./test-login";
import { runWarmup } from "./warmup";

interface WebSocketData {
    targetUrl: string;
    targetWs: WebSocket | null;
}

const server = Bun.serve<WebSocketData>({
    port: PROXY_PORT,
    hostname: "0.0.0.0",
    async fetch(req, server) {
        const url = new URL(req.url);

        // Handle WebSocket upgrade for CORS proxy
        if (req.headers.get("upgrade")?.toLowerCase() === "websocket" && url.pathname.startsWith("/__proxy/")) {
            const targetUrl = url.pathname.slice("/__proxy/".length) + url.search;
            if (!targetUrl) {
                return new Response("Missing target URL", { status: 400 });
            }

            let parsedUrl: URL;
            try {
                parsedUrl = new URL(targetUrl);
            } catch {
                return new Response("Invalid target URL", { status: 400 });
            }

            if (!isProxyTargetAllowed(parsedUrl.hostname, DOCS_DOMAIN, ADDITIONAL_ALLOWED_DOMAINS)) {
                log(
                    "CORS proxy WebSocket error: Domain not allowed - " +
                        parsedUrl.hostname +
                        " (docs domain: " +
                        DOCS_DOMAIN +
                        ")"
                );
                return new Response("Proxy target domain not allowed", { status: 403 });
            }

            log("CORS proxy WebSocket upgrade: " + parsedUrl.origin + parsedUrl.pathname);
            const upgraded = server.upgrade(req, { data: { targetUrl: parsedUrl.href, targetWs: null } });
            if (upgraded) {
                return undefined as unknown as Response;
            }
            return new Response("WebSocket upgrade failed", { status: 500 });
        }

        // Handle cache control endpoints
        if (url.pathname.startsWith("/__cache/")) {
            // Health endpoint: no auth required so K8s probes and readiness.sh can reach it
            if (url.pathname === "/__cache/health") {
                return Response.json({ status: "ok", timestamp: new Date().toISOString() });
            }

            const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
            const queryToken = url.searchParams.get("token") || "";
            if (bearer !== CACHE_ADMIN_TOKEN && queryToken !== CACHE_ADMIN_TOKEN) {
                return Response.json({ error: "Unauthorized" }, { status: 401 });
            }

            if (url.pathname === "/__cache/export") {
                return handleExportStart(req);
            }
            if (url.pathname === "/__cache/export/status") {
                return handleExportStatus();
            }
            if (url.pathname === "/__cache/export/download") {
                return handleExportDownload();
            }
            if (url.pathname === "/__cache/warmup" && req.method === "POST") {
                log("Warmup triggered via API...");
                const result = await runWarmup();
                return Response.json(result);
            }
            const cacheResponse = handleCacheControl(req);
            if (cacheResponse) {
                return cacheResponse;
            }
        }

        // Handle test login endpoint
        if (url.pathname.startsWith("/__test-login")) {
            const testLoginResponse = await handleTestLogin(req);
            if (testLoginResponse) {
                return testLoginResponse;
            }
        }

        // Block /_local/ — this is an internal route that redirects to FDR (localhost:8080).
        // It should never be exposed externally as it leaks internal service addresses.
        if (url.pathname.startsWith("/_local/")) {
            return new Response("Forbidden", { status: 403 });
        }

        // Handle CORS proxy requests
        if (url.pathname.startsWith("/__proxy/")) {
            if (req.method === "OPTIONS") {
                return handleCorsPreflightProxy();
            }
            return handleCorsProxy(req);
        }

        const isRsc = !!req.headers.get("rsc");
        const reqType = isRsc ? "RSC" : "HTML";
        const bypassReason = shouldBypassCache(req);
        const cacheKey = bypassReason ? null : await getCacheKey(req);

        if (!bypassReason) {
            const cached = cache.get(cacheKey!);
            if (cached) {
                const age = Math.floor((Date.now() - cached.cachedAt) / 1000);
                debug("[" + reqType + "] HIT  " + url.pathname + " (age: " + age + "s, key: " + cacheKey + ")");

                const headers = new Headers(cached.headers);
                headers.set("x-cache", "HIT");
                headers.set("x-cache-age", age.toString());
                const statsHeaders = getCacheStatsHeaders();
                for (const [k, v] of Object.entries(statsHeaders)) {
                    headers.set(k, v);
                }

                return new Response(cached.body, { status: cached.statusCode, headers });
            }
            debug("[" + reqType + "] MISS " + url.pathname + " (key: " + cacheKey + ")");
        } else {
            debug("[" + reqType + "] BYPASS " + url.pathname + " (reason: " + bypassReason + ")");
        }

        return proxyRequest(req, cacheKey);
    },

    websocket: {
        open(ws) {
            const { targetUrl } = ws.data;
            const wsUrl = targetUrl.replace(/^http/, "ws");
            const targetWs = new WebSocket(wsUrl);

            ws.data.targetWs = targetWs;

            targetWs.addEventListener("open", () => {
                debug("CORS proxy WebSocket connected to target: " + targetUrl);
            });

            targetWs.addEventListener("message", (event) => {
                if (typeof event.data === "string") {
                    ws.sendText(event.data);
                } else if (event.data instanceof ArrayBuffer) {
                    ws.sendBinary(new Uint8Array(event.data));
                }
            });

            targetWs.addEventListener("close", (event) => {
                debug("CORS proxy WebSocket target closed: " + event.code);
                ws.close(event.code, event.reason);
            });

            targetWs.addEventListener("error", (event) => {
                log("CORS proxy WebSocket target error: " + String(event));
                ws.close(1011, "Target WebSocket error");
            });
        },
        message(ws, message) {
            const { targetWs } = ws.data;
            if (targetWs && targetWs.readyState === WebSocket.OPEN) {
                targetWs.send(message);
            }
        },
        close(ws, code, reason) {
            const { targetWs } = ws.data;
            if (targetWs) {
                targetWs.close(code, reason);
            }
        }
    }
});

log("Cache proxy listening on port " + PROXY_PORT);
log("Proxying to " + BACKEND_HOST + ":" + BACKEND_PORT);
log("Caching: " + (CACHE_DISABLED ? "DISABLED" : "enabled"));
if (!CACHE_DISABLED) {
    log("Max cache entries: " + MAX_CACHE_SIZE);
    log("Max entry size: " + MAX_CACHE_ENTRY_SIZE + " bytes");
    log("Default TTL: " + DEFAULT_TTL + " seconds");
    log("CDN TTL: " + CDN_TTL + " seconds (for downstream caches like CloudFront)");
}
log("CORS proxy: enabled at /__proxy/");
if (DOCS_DOMAIN || ADDITIONAL_ALLOWED_DOMAINS.length > 0) {
    const allowedDomains: string[] = [];
    if (DOCS_DOMAIN) {
        allowedDomains.push("*." + getRootDomain(DOCS_DOMAIN));
    }
    for (const domain of ADDITIONAL_ALLOWED_DOMAINS) {
        allowedDomains.push("*." + getRootDomain(domain));
    }
    log("CORS proxy domain restriction: " + allowedDomains.join(", "));
    if (ADDITIONAL_ALLOWED_DOMAINS.length > 0) {
        log("  Additional domains from CORS_PROXY_ALLOWED_DOMAINS: " + ADDITIONAL_ALLOWED_DOMAINS.join(", "));
    }
} else {
    log(
        "CORS proxy domain restriction: DISABLED (set NEXT_PUBLIC_DOCS_DOMAIN_URL or CORS_PROXY_ALLOWED_DOMAINS to enable)"
    );
}
if (TEST_LOGIN_ENABLED) {
    log(
        "Test login: ENABLED at /__test-login (set FERN_AUTH_REDIRECT to http://<host>:" + PROXY_PORT + "/__test-login)"
    );
}
if (FERN_AUTH_TYPE) {
    log("Auth-aware caching: enabled (auth type: " + FERN_AUTH_TYPE + ", cache keys include isLoggedIn + roles)");
} else {
    log("Auth-aware caching: disabled (no FERN_AUTH_TYPE configured)");
}
// Write the admin token to disk so export.sh (via docker exec) can read it
writeFileSync(ADMIN_TOKEN_PATH, CACHE_ADMIN_TOKEN, { mode: 0o600 });
log("Admin endpoints (/__cache/*): protected (token written to " + ADMIN_TOKEN_PATH + ")");
log("Debug mode: " + (DEBUG ? "enabled" : "disabled"));

// Graceful shutdown
process.on("SIGTERM", () => {
    log("Received SIGTERM, shutting down...");
    log("Final cache stats: " + JSON.stringify(cache.stats()));
    server.stop();
    process.exit(0);
});

process.on("SIGINT", () => {
    log("Received SIGINT, shutting down...");
    log("Final cache stats: " + JSON.stringify(cache.stats()));
    server.stop();
    process.exit(0);
});
