/**
 * CORS proxy: proxies API requests from the API Explorer to external APIs,
 * avoiding CORS issues by making the request server-side.
 *
 * Supports HTTP requests, preflight (OPTIONS), and WebSocket upgrades.
 */

import http from "http";
import https from "https";
import net from "net";
import type { Duplex } from "stream";
import tls from "tls";
import { URL } from "url";
import { ADDITIONAL_ALLOWED_DOMAINS, DOCS_DOMAIN } from "./config";
import { isProxyTargetAllowed } from "./domain-utils";
import { debug, log } from "./logger";

/**
 * Handle CORS proxy requests.
 * The target URL is extracted from the path after /__proxy/
 * For example: /__proxy/https://api.example.com/v1/users
 */
export function handleCorsProxy(req: http.IncomingMessage, res: http.ServerResponse): void {
    // Extract target URL from the path (everything after /__proxy/)
    const targetUrl = (req.url || "").slice("/__proxy/".length);

    if (!targetUrl) {
        log("CORS proxy error: Missing target URL");
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("Missing target URL");
        return;
    }

    let parsedUrl: URL;
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

    const headersToForwardRaw = (req.headers["x-fern-proxy-request-headers"] as string) || "";
    const headersToForward = headersToForwardRaw.split(",").filter(Boolean);

    // Headers that should never be forwarded to the target API.
    // These are either security-sensitive (cookies from the docs site), internal to the proxy,
    // or hop-by-hop headers that don't belong in the proxied request.
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

    const forwardHeaders: Record<string, string | string[] | undefined> = {};

    if (headersToForward.length > 0) {
        for (const header of headersToForward) {
            const lowerHeader = header.toLowerCase();
            if (req.headers[lowerHeader] != null) {
                forwardHeaders[header] = req.headers[lowerHeader];
            }
        }
    } else {
        // Fallback: if X-Fern-Proxy-Request-Headers is missing (e.g. stripped by a reverse proxy
        // or ingress controller), forward all non-sensitive headers to avoid silently dropping
        // auth and other API headers. This matches the Cloudflare Worker proxy behavior.
        debug("CORS proxy: X-Fern-Proxy-Request-Headers missing, forwarding all non-sensitive headers");
        for (const [key, value] of Object.entries(req.headers)) {
            if (!BLOCKED_HEADERS.has(key) && value != null) {
                forwardHeaders[key] = value;
            }
        }
    }

    if (req.headers["content-type"] && !forwardHeaders["Content-Type"] && !forwardHeaders["content-type"]) {
        forwardHeaders["Content-Type"] = req.headers["content-type"];
    }

    if (req.headers["authorization"] && !forwardHeaders["Authorization"] && !forwardHeaders["authorization"]) {
        forwardHeaders["Authorization"] = req.headers["authorization"];
    }

    debug(`CORS proxy forwarding headers: ${Object.keys(forwardHeaders).join(", ") || "(none)"}`);

    const requestModule = parsedUrl.protocol === "https:" ? https : http;

    const options: https.RequestOptions = {
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
        const responseHeaders: Record<string, string | string[] | undefined> = {};
        const responseHeadersList: string[] = [];

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

        res.writeHead(proxyRes.statusCode || 500, responseHeaders);
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
export function handleCorsPreflightProxy(_req: http.IncomingMessage, res: http.ServerResponse): void {
    res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Fern-Proxy-Request-Headers, *",
        "Access-Control-Max-Age": "86400"
    });
    res.end();
}

/**
 * Handle WebSocket upgrade requests for the CORS proxy.
 * This allows the API Explorer to work with WebSocket-based APIs.
 */
export function handleWebSocketUpgrade(req: http.IncomingMessage, clientSocket: Duplex, head: Buffer): void {
    if (!req.url?.startsWith("/__proxy/")) {
        clientSocket.end("HTTP/1.1 404 Not Found\r\n\r\n");
        return;
    }

    // Extract target URL from the path (everything after /__proxy/)
    const targetUrl = req.url.slice("/__proxy/".length);

    if (!targetUrl) {
        clientSocket.end("HTTP/1.1 400 Bad Request\r\n\r\nMissing target URL");
        return;
    }

    let parsedUrl: URL;
    try {
        parsedUrl = new URL(targetUrl);
    } catch {
        clientSocket.end("HTTP/1.1 400 Bad Request\r\n\r\nInvalid target URL");
        return;
    }

    // Only allow ws and wss protocols (converted from http/https)
    const isSecure = parsedUrl.protocol === "https:" || parsedUrl.protocol === "wss:";
    const targetPort = parseInt(parsedUrl.port || (isSecure ? "443" : "80"), 10);

    // Validate that the target domain matches the docs site domain (SSRF protection)
    if (!isProxyTargetAllowed(parsedUrl.hostname, DOCS_DOMAIN, ADDITIONAL_ALLOWED_DOMAINS)) {
        log(`CORS proxy WebSocket error: Domain not allowed - ${parsedUrl.hostname} (docs domain: ${DOCS_DOMAIN})`);
        clientSocket.end("HTTP/1.1 403 Forbidden\r\n\r\nProxy target domain not allowed");
        return;
    }

    // Log WebSocket proxy request (excluding sensitive data)
    log(`CORS proxy WebSocket upgrade: ${parsedUrl.origin}${parsedUrl.pathname}`);

    // Build the WebSocket upgrade request to send to the target
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

    const onConnect = (targetSocket: net.Socket): void => {
        targetSocket.write(upgradeRequest);
        if (head.length > 0) {
            targetSocket.write(head);
        }
    };

    // Create connection to target server
    let targetSocket: net.Socket;
    if (isSecure) {
        targetSocket = tls.connect(
            {
                host: parsedUrl.hostname,
                port: targetPort,
                servername: parsedUrl.hostname,
                rejectUnauthorized: false
            },
            () => onConnect(targetSocket)
        );
    } else {
        targetSocket = net.connect(targetPort, parsedUrl.hostname, () => onConnect(targetSocket));
    }

    targetSocket.on("error", (err) => {
        log(`CORS proxy WebSocket error: ${err.message} - ${parsedUrl.origin}${parsedUrl.pathname}`);
        clientSocket.end();
    });

    // Once we get data from target, pipe it to client and vice versa
    targetSocket.once("data", (chunk: Buffer) => {
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
}
