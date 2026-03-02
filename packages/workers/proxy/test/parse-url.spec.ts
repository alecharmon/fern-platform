import { describe, expect, it } from "vitest";

import { parseUrl } from "../src/parse-url";

describe("parseUrl", () => {
    it("should parse a basic https URL", () => {
        const result = parseUrl("https://proxy.ferndocs.com/https://example.com/test");
        expect(result).toBeDefined();
        expect(result!.origin).toBe("https://example.com");
        expect(result!.pathname).toBe("/test");
    });

    it("should parse a URL with search params", () => {
        const result = parseUrl("https://proxy.ferndocs.com/https://example.com/test?foo=bar&baz=qux");
        expect(result).toBeDefined();
        expect(result!.origin).toBe("https://example.com");
        expect(result!.pathname).toBe("/test");
        expect(result!.searchParams.get("foo")).toBe("bar");
        expect(result!.searchParams.get("baz")).toBe("qux");
    });

    it("should return undefined for invalid URLs", () => {
        expect(parseUrl("https://proxy.ferndocs.com/")).toBeUndefined();
        expect(parseUrl("https://proxy.ferndocs.com/http://example.com/test")).toBeUndefined();
    });

    it("should parse a wss URL", () => {
        const result = parseUrl("https://proxy.ferndocs.com/wss://example.com/ws");
        expect(result).toBeDefined();
        expect(result!.protocol).toBe("wss:");
        expect(result!.host).toBe("example.com");
        expect(result!.pathname).toBe("/ws");
    });

    describe("non-ASCII characters in path (emoji slugs)", () => {
        it("should handle emoji characters in the path", () => {
            const result = parseUrl("https://proxy.ferndocs.com/https://example.com/docs/%F0%9F%8C%BF-getting-started");
            expect(result).toBeDefined();
            expect(result!.origin).toBe("https://example.com");
            expect(result!.pathname).toContain("getting-started");
        });

        it("should handle raw emoji characters in the path", () => {
            const result = parseUrl("https://proxy.ferndocs.com/https://example.com/docs/\u{1F33F}-getting-started");
            expect(result).toBeDefined();
            expect(result!.origin).toBe("https://example.com");
            expect(result!.pathname).toContain("getting-started");
        });

        it("should handle multiple emoji characters in the path", () => {
            const result = parseUrl(
                "https://proxy.ferndocs.com/https://example.com/docs/%F0%9F%9A%80-launch/%F0%9F%93%9A-guides"
            );
            expect(result).toBeDefined();
            expect(result!.origin).toBe("https://example.com");
        });

        it("should handle emoji-only slug segments", () => {
            const result = parseUrl("https://proxy.ferndocs.com/https://example.com/docs/%F0%9F%8C%BF");
            expect(result).toBeDefined();
            expect(result!.origin).toBe("https://example.com");
        });

        it("should handle CJK characters in the path", () => {
            const result = parseUrl("https://proxy.ferndocs.com/https://example.com/docs/%E4%B8%AD%E6%96%87-guide");
            expect(result).toBeDefined();
            expect(result!.origin).toBe("https://example.com");
        });

        it("should handle accented characters in the path", () => {
            const result = parseUrl("https://proxy.ferndocs.com/https://example.com/docs/caf%C3%A9-guide");
            expect(result).toBeDefined();
            expect(result!.origin).toBe("https://example.com");
        });
    });
});
