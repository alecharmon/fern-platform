type WebSocketData =
    // handshake on the first message is required after the initial connection to forward any headers
    | { type: "handshake"; headers?: Record<string, string> }
    // after the handshake, we can forward any data
    | ArrayBuffer
    | string;

// Headers that should not be forwarded from the client to the upstream server.
// Currently in monitor-only mode: these headers are logged but still forwarded.
// Once monitoring confirms none are in legitimate use, switch to blocking mode.
export const MONITORED_HEADERS = new Set([
    "host",
    "origin",
    "referer",
    "x-forwarded-for",
    "x-forwarded-host",
    "x-forwarded-proto",
    "x-real-ip",
    "forwarded",
    "via",
    "connection",
    "keep-alive",
    "transfer-encoding",
    "te",
    "trailer",
    "proxy-authorization",
    "proxy-connection",
    "upgrade",
    "cf-connecting-ip",
    "cf-ipcountry",
    "cf-ray",
    "cf-visitor",
    "true-client-ip",
    "x-forwarded-port",
    "x-request-id",
    "cookie",
    "set-cookie"
]);

export function containsCRLF(value: string): boolean {
    return /[\r\n]/.test(value);
}

export function sanitizeHeaders(raw: Record<string, string>): Record<string, string> {
    const sanitized: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw)) {
        const lower = key.toLowerCase();
        if (MONITORED_HEADERS.has(lower)) {
            console.warn(`[websocket-proxy] Monitored header detected: ${lower}=${value}`);
        }
        if (typeof value !== "string") {
            console.warn(`[websocket-proxy] Non-string header value stripped: ${lower}`);
            continue;
        }
        if (containsCRLF(key) || containsCRLF(value)) {
            console.warn(`[websocket-proxy] CRLF injection attempt stripped: ${lower}`);
            continue;
        }
        sanitized[key] = value;
    }
    return sanitized;
}

async function handleSession(websocket: WebSocket, url: URL): Promise<void> {
    let recievedHandshake = false;
    let forwardedWs: WebSocket | null = null;

    websocket.accept();

    async function connectToProxy(data: WebSocketData): Promise<void> {
        const headers: Record<string, string> = {
            Upgrade: "websocket"
        };

        if (typeof data === "object" && "headers" in data && data.headers != null) {
            Object.assign(headers, sanitizeHeaders(data.headers));
        }

        // cloudflare doesn't support fetching wss://, so we need to convert it to https://
        const requestUrl = new URL(url);
        requestUrl.protocol = "https:";
        const resp = await fetch(requestUrl, { headers });

        // Check if the server accepted the WebSocket connection
        if (resp.status !== 101) {
            throw new Error(resp.statusText);
        }

        // If the WebSocket handshake completed successfully, then the
        // response has a `webSocket` property.
        forwardedWs = resp.webSocket;
        if (!forwardedWs) {
            throw new Error("Server didn't accept WebSocket");
        }

        // Call accept() to indicate that you'll be handling the socket here
        // in JavaScript, as opposed to returning it on to a client.
        forwardedWs.accept();

        forwardedWs.addEventListener("message", (msg: MessageEvent) => {
            websocket.send(msg.data);
        });

        forwardedWs.addEventListener("close", () => {
            websocket.close(1000, "Forwarded WebSocket closed");
        });
    }

    websocket.addEventListener("message", async ({ data }: MessageEvent) => {
        if (!recievedHandshake) {
            let parsedData: WebSocketData;
            try {
                parsedData = JSON.parse(typeof data === "string" ? data : new TextDecoder().decode(data));
            } catch (e) {
                console.error(e);
                websocket.close(1011, "Invalid JSON");
                return;
            }

            if (typeof parsedData === "object" && "type" in parsedData && parsedData.type !== "handshake") {
                websocket.close(1011, "Expected handshake");
                return;
            }

            try {
                await connectToProxy(parsedData);
                recievedHandshake = true;
            } catch (e: unknown) {
                console.error(e);
                websocket.close(1011, "Failed to connect to proxy" + (e instanceof Error ? `: ${e.message}` : ""));
            }
        } else if (forwardedWs) {
            forwardedWs.send(data);
        } else {
            websocket.close(1011, "No connection to proxy");
        }
    });

    websocket.addEventListener("close", async (evt: CloseEvent) => {
        // Handle when a client closes the WebSocket connection
        console.log(evt);
        if (forwardedWs) {
            forwardedWs.close();
        }
    });
}

export async function upgradeToWebsocket(url: URL): Promise<Response> {
    const [client, server] = Object.values(new WebSocketPair());
    await handleSession(server, url);

    return new Response(null, {
        status: 101,
        webSocket: client
    });
}
