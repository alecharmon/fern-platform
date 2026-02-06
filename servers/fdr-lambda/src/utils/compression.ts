/** biome-ignore-all lint/suspicious/noConsole: logging is intentional in Lambda */

import { gzipSync } from "node:zlib";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

const LAMBDA_PAYLOAD_LIMIT = 6_291_556;
const COMPRESSION_THRESHOLD = 5_000_000;

export function compressResponseIfNeeded(
    event: APIGatewayProxyEvent,
    response: APIGatewayProxyResult
): APIGatewayProxyResult {
    const bodyLength = response.body ? Buffer.byteLength(response.body, "utf-8") : 0;

    if (bodyLength < COMPRESSION_THRESHOLD) {
        return response;
    }

    const acceptEncoding = event.headers?.["accept-encoding"] ?? event.headers?.["Accept-Encoding"] ?? "";
    if (!acceptEncoding.includes("gzip")) {
        if (bodyLength >= LAMBDA_PAYLOAD_LIMIT) {
            console.error(`Response body (${bodyLength} bytes) exceeds Lambda limit and client does not accept gzip`);
        }
        return response;
    }

    const compressed = gzipSync(Buffer.from(response.body ?? "", "utf-8"));
    const base64Body = compressed.toString("base64");

    console.log(
        `Compressed response from ${bodyLength} bytes to ${compressed.length} bytes (base64: ${base64Body.length} bytes)`
    );

    return {
        ...response,
        headers: {
            ...response.headers,
            "Content-Encoding": "gzip"
        },
        body: base64Body,
        isBase64Encoded: true
    };
}
