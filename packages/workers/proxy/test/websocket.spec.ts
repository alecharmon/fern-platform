import { describe, expect, it, vi } from "vitest";

import { containsCRLF, MONITORED_HEADERS, sanitizeHeaders } from "../src/websocket";

describe("containsCRLF", () => {
    it("should return false for normal strings", () => {
        expect(containsCRLF("hello")).toBe(false);
        expect(containsCRLF("Authorization")).toBe(false);
        expect(containsCRLF("Bearer abc123")).toBe(false);
        expect(containsCRLF("")).toBe(false);
    });

    it("should detect carriage return", () => {
        expect(containsCRLF("value\rinjected")).toBe(true);
    });

    it("should detect line feed", () => {
        expect(containsCRLF("value\ninjected")).toBe(true);
    });

    it("should detect CRLF pair", () => {
        expect(containsCRLF("value\r\ninjected: header")).toBe(true);
    });
});

describe("MONITORED_HEADERS", () => {
    it("should contain all expected dangerous headers", () => {
        const expected = [
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
        ];
        for (const header of expected) {
            expect(MONITORED_HEADERS.has(header)).toBe(true);
        }
    });

    it("should not contain legitimate API headers", () => {
        expect(MONITORED_HEADERS.has("authorization")).toBe(false);
        expect(MONITORED_HEADERS.has("content-type")).toBe(false);
        expect(MONITORED_HEADERS.has("x-api-key")).toBe(false);
        expect(MONITORED_HEADERS.has("accept")).toBe(false);
        expect(MONITORED_HEADERS.has("user-agent")).toBe(false);
    });
});

describe("sanitizeHeaders", () => {
    it("should pass through safe headers without logging", () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        const input = {
            Authorization: "Bearer token123",
            "Content-Type": "application/json",
            "X-API-Key": "key123"
        };
        const result = sanitizeHeaders(input);
        expect(result).toEqual(input);
        expect(warnSpy).not.toHaveBeenCalled();
        warnSpy.mockRestore();
    });

    it("should forward monitored headers but log warnings (case-insensitive)", () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        const input = {
            Authorization: "Bearer token123",
            Host: "evil.internal",
            Origin: "https://attacker.com",
            "X-Forwarded-For": "127.0.0.1"
        };
        const result = sanitizeHeaders(input);
        expect(result).toEqual(input);
        expect(warnSpy).toHaveBeenCalledTimes(3);
        expect(warnSpy).toHaveBeenCalledWith("[websocket-proxy] Monitored header detected: host=evil.internal");
        expect(warnSpy).toHaveBeenCalledWith(
            "[websocket-proxy] Monitored header detected: origin=https://attacker.com"
        );
        expect(warnSpy).toHaveBeenCalledWith("[websocket-proxy] Monitored header detected: x-forwarded-for=127.0.0.1");
        warnSpy.mockRestore();
    });

    it("should forward hop-by-hop headers but log warnings", () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        const input = {
            Connection: "keep-alive",
            "Keep-Alive": "timeout=5",
            "Transfer-Encoding": "chunked",
            TE: "trailers",
            Trailer: "Expires"
        };
        const result = sanitizeHeaders(input);
        expect(result).toEqual(input);
        expect(warnSpy).toHaveBeenCalledTimes(5);
        warnSpy.mockRestore();
    });

    it("should forward Cloudflare-specific headers but log warnings", () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        const input = {
            "CF-Connecting-IP": "1.2.3.4",
            "CF-IPCountry": "US",
            "CF-Ray": "abc123",
            "CF-Visitor": '{"scheme":"https"}',
            "True-Client-IP": "5.6.7.8"
        };
        const result = sanitizeHeaders(input);
        expect(result).toEqual(input);
        expect(warnSpy).toHaveBeenCalledTimes(5);
        warnSpy.mockRestore();
    });

    it("should still strip headers with CRLF in the key", () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        const input = {
            "X-Custom\r\nEvil: injected": "value"
        };
        const result = sanitizeHeaders(input);
        expect(result).toEqual({});
        expect(warnSpy).toHaveBeenCalled();
        warnSpy.mockRestore();
    });

    it("should still strip headers with CRLF in the value", () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        const input = {
            "X-Custom": "value\r\nEvil-Header: injected"
        };
        const result = sanitizeHeaders(input);
        expect(result).toEqual({});
        expect(warnSpy).toHaveBeenCalled();
        warnSpy.mockRestore();
    });

    it("should handle an empty headers object", () => {
        expect(sanitizeHeaders({})).toEqual({});
    });

    it("should forward Upgrade header but log a warning", () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        const input = { Upgrade: "h2c" };
        const result = sanitizeHeaders(input);
        expect(result).toEqual(input);
        expect(warnSpy).toHaveBeenCalledWith("[websocket-proxy] Monitored header detected: upgrade=h2c");
        warnSpy.mockRestore();
    });

    it("should forward cookie headers but log warnings", () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        const input = {
            Cookie: "session=abc123",
            "Set-Cookie": "token=xyz"
        };
        const result = sanitizeHeaders(input);
        expect(result).toEqual(input);
        expect(warnSpy).toHaveBeenCalledTimes(2);
        warnSpy.mockRestore();
    });

    it("should allow arbitrary custom API headers through without logging", () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        const input = {
            "X-Fern-Token": "abc",
            "X-Custom-Auth": "secret",
            "Sec-WebSocket-Protocol": "graphql-ws",
            "X-Plant-Species": "fern"
        };
        const result = sanitizeHeaders(input);
        expect(result).toEqual(input);
        expect(warnSpy).not.toHaveBeenCalled();
        warnSpy.mockRestore();
    });

    it("should log warnings for each monitored header with its value", () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        sanitizeHeaders({
            Host: "evil.com",
            Authorization: "Bearer safe"
        });
        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(warnSpy).toHaveBeenCalledWith("[websocket-proxy] Monitored header detected: host=evil.com");
        warnSpy.mockRestore();
    });

    it("should still log and strip CRLF injection attempts", () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        sanitizeHeaders({
            "X-Custom": "value\r\nInjected: true"
        });
        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(warnSpy).toHaveBeenCalledWith("[websocket-proxy] CRLF injection attempt stripped: x-custom");
        warnSpy.mockRestore();
    });
});
