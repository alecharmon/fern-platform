/**
 * CORS proxy: proxies API requests from the API Explorer to external APIs,
 * avoiding CORS issues by making the request server-side.
 *
 * Supports HTTP requests and preflight (OPTIONS).
 * WebSocket upgrades are handled via Bun.serve's native websocket support in index.ts.
 */

import { ADDITIONAL_ALLOWED_DOMAINS, DOCS_DOMAIN } from "./config";
import { isProxyTargetAllowed } from "./domain-utils";
import { debug, log } from "./logger";

/**
 * Handle CORS proxy requests.
 * The target URL is extracted from the path after /__proxy/
 * For example: /__proxy/https://api.example.com/v1/users
 */
export async function handleCorsProxy(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const targetUrl = url.pathname.slice("/__proxy/".length) + url.search;

    if (!targetUrl) {
        log("CORS proxy error: Missing target URL");
        return new Response("Missing target URL", { status: 400 });
    }

    let parsedUrl: URL;
    try {
        parsedUrl = new URL(targetUrl);
    } catch {
        log(`CORS proxy error: Invalid target URL - ${targetUrl}`);
        return new Response("Invalid target URL", { status: 400 });
    }

    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        log(`CORS proxy error: Unsupported protocol - ${parsedUrl.protocol}`);
        return new Response("Only HTTP and HTTPS protocols are supported", { status: 400 });
    }

    if (!isProxyTargetAllowed(parsedUrl.hostname, DOCS_DOMAIN, ADDITIONAL_ALLOWED_DOMAINS)) {
        log(`CORS proxy error: Domain not allowed - ${parsedUrl.hostname} (docs domain: ${DOCS_DOMAIN})`);
        return new Response("Proxy target domain not allowed", {
            status: 403,
            headers: { "Access-Control-Allow-Origin": "*" }
        });
    }

    log(`CORS proxy request: ${req.method} ${parsedUrl.origin}${parsedUrl.pathname}`);

    const headersToForwardRaw = req.headers.get("x-fern-proxy-request-headers") || "";
    const headersToForward = headersToForwardRaw.split(",").filter(Boolean);

    // Headers that should never be forwarded to the target API.
    const BLOCKED_HEADERS = new Set([
        "cookie",
        "host",
        "origin",
        "referer",
        "connection",
        "keep-alive",
        "transfer-encoding",
        "te",
        "trailer",
        "upgrade",
        "proxy-authorization",
        "proxy-connection",
        "x-fern-proxy-request-headers"
    ]);

    const forwardHeaders = new Headers();

    if (headersToForward.length > 0) {
        for (const header of headersToForward) {
            const value = req.headers.get(header);
            if (value != null) {
                forwardHeaders.set(header, value);
            }
        }
    } else {
        debug("CORS proxy: X-Fern-Proxy-Request-Headers missing, forwarding all non-sensitive headers");
        for (const [key, value] of req.headers.entries()) {
            if (!BLOCKED_HEADERS.has(key.toLowerCase())) {
                forwardHeaders.set(key, value);
            }
        }
    }

    if (req.headers.get("content-type") && !forwardHeaders.has("content-type")) {
        forwardHeaders.set("Content-Type", req.headers.get("content-type")!);
    }

    if (req.headers.get("authorization") && !forwardHeaders.has("authorization")) {
        forwardHeaders.set("Authorization", req.headers.get("authorization")!);
    }

    debug(`CORS proxy forwarding headers: ${Array.from(forwardHeaders.keys()).join(", ") || "(none)"}`);

    const startTime = Date.now();

    try {
        const proxyRes = await fetch(parsedUrl.href, {
            method: req.method,
            headers: forwardHeaders,
            body: req.method !== "GET" && req.method !== "HEAD" ? req.body : undefined,
            redirect: "manual",
            tls: { rejectUnauthorized: false }
        } as RequestInit);

        const responseTime = Date.now() - startTime;

        const responseHeaders = new Headers();
        const responseHeadersList: string[] = [];

        // Skip hop-by-hop headers
        const HOP_BY_HOP = new Set([
            "transfer-encoding",
            "connection",
            "keep-alive",
            "proxy-authenticate",
            "proxy-authorization",
            "te",
            "trailer",
            "upgrade"
        ]);

        for (const [key, value] of proxyRes.headers.entries()) {
            if (!HOP_BY_HOP.has(key.toLowerCase())) {
                responseHeaders.set(key, value);
                responseHeadersList.push(key);
            }
        }

        responseHeaders.set("X-Fern-Proxy-Response-Headers", responseHeadersList.join(","));
        responseHeaders.set("X-Fern-Proxy-Response-Time", String(responseTime));
        responseHeaders.set("X-Fern-Proxy-Origin-Latency", String(responseTime));

        responseHeaders.set("Access-Control-Allow-Origin", "*");
        responseHeaders.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
        responseHeaders.set("Access-Control-Allow-Headers", "*");
        responseHeaders.set(
            "Access-Control-Expose-Headers",
            responseHeadersList.join(",") +
                ",X-Fern-Proxy-Response-Headers,X-Fern-Proxy-Response-Time,X-Fern-Proxy-Origin-Latency"
        );

        log(`CORS proxy response: ${proxyRes.status} ${parsedUrl.origin}${parsedUrl.pathname} (${responseTime}ms)`);

        return new Response(proxyRes.body, { status: proxyRes.status, headers: responseHeaders });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        log(`CORS proxy error: ${message} - ${parsedUrl.origin}${parsedUrl.pathname}`);
        return new Response(`Proxy error: ${message}`, {
            status: 400,
            headers: { "Content-Type": "text/plain", "Access-Control-Allow-Origin": "*" }
        });
    }
}

/**
 * Handle CORS preflight (OPTIONS) requests for the proxy endpoint.
 */
export function handleCorsPreflightProxy(): Response {
    return new Response(null, {
        status: 204,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
            "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Fern-Proxy-Request-Headers, *",
            "Access-Control-Max-Age": "86400"
        }
    });
}
