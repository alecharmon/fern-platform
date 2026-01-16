const DEFAULT_HTTP_PROXY_URL = "https://proxy.ferndocs.com/";
const DEFAULT_WEBSOCKET_PROXY_URL = "wss://proxy.ferndocs.com/";

export function getHttpProxyUrl(): string {
    if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_IS_SELF_HOSTED === "1") {
        return `${window.location.origin}/__proxy/`;
    }
    return DEFAULT_HTTP_PROXY_URL;
}

export function getWebSocketProxyUrl(): string {
    if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_IS_SELF_HOSTED === "1") {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        return `${protocol}//${window.location.host}/__proxy/`;
    }
    return DEFAULT_WEBSOCKET_PROXY_URL;
}
