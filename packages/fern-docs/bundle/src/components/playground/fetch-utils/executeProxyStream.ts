import urljoin from "url-join";

import type { ProxyRequest } from "../types";
import { getHttpProxyUrl } from "./proxyUrl";
import { toBodyInit } from "./requestToBodyInit";

export async function executeProxyStream(
    req: ProxyRequest,
    disableProxy: boolean = false
): Promise<[Response, ReadableStream<Uint8Array>]> {
    const requestHeaders = new Headers(req.headers);

    // Only set proxy-specific headers when using the proxy
    if (!disableProxy) {
        requestHeaders.set("X-Fern-Proxy-Request-Headers", Object.keys(req.headers).join(","));
    }

    const reqContentType = requestHeaders.get("Content-Type") ?? undefined;

    // Only delete Content-Type for form-data that will be sent as multipart (not form-urlencoded)
    if (req.body?.type === "form-data" && !reqContentType?.toLowerCase().includes("form-urlencoded")) {
        requestHeaders.delete("Content-Type");
    }

    const response = await fetch(disableProxy ? req.url : urljoin(getHttpProxyUrl(), req.url), {
        method: req.method,
        headers: requestHeaders,
        body: await toBodyInit(req.body, reqContentType),
        mode: "cors"
    });

    if (response.body == null) {
        throw new Error("Response body is null");
    }

    return [response, response.body];
}
