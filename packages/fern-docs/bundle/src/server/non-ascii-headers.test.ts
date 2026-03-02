/**
 * Regression tests for non-ASCII character handling in middleware headers.
 *
 * When the middleware decodes a URL pathname containing emoji or other non-ASCII
 * characters (e.g. /docs/%F0%9F%8C%BF-getting-started -> /docs/🌿-getting-started),
 * the decoded value must be re-encoded before being set as an HTTP header value.
 * HTTP headers only support ASCII characters; setting raw non-ASCII values causes
 * the request to fail silently.
 *
 * Self-contained to avoid importing from the middleware (which has Next.js dependencies).
 * The logic tested here mirrors the implementation in proxy.ts.
 */

/**
 * Mirrors the middleware pathname decoding logic from proxy.ts (line ~135):
 *   pathname = decodeURIComponent(removeTrailingSlash(request.nextUrl.pathname))
 *
 * Returns the decoded pathname, or undefined if the encoding is invalid.
 */
function decodePathname(rawPathname: string): string | undefined {
    const withoutTrailingSlash = rawPathname.endsWith("/") ? rawPathname.slice(0, -1) : rawPathname;
    try {
        return decodeURIComponent(withoutTrailingSlash);
    } catch {
        return undefined;
    }
}

/**
 * Mirrors how the middleware sets the x-fern-requested-path header (proxy.ts line ~186):
 *   headers.set("x-fern-requested-path", encodeURIComponent(pathname))
 *
 * The pathname has already been decoded, so it must be re-encoded for safe header transport.
 */
function encodeForHeader(decodedPathname: string): string {
    return encodeURIComponent(decodedPathname);
}

/**
 * Validates that a string is safe to use as an HTTP header value.
 * HTTP/1.1 header values must only contain visible ASCII characters (0x20-0x7E)
 * plus horizontal tab (0x09). Non-ASCII bytes (>0x7F) are not allowed.
 */
function isAsciiSafeHeaderValue(value: string): boolean {
    for (let i = 0; i < value.length; i++) {
        const code = value.charCodeAt(i);
        if (code > 0x7e) {
            return false;
        }
    }
    return true;
}

describe("non-ASCII pathname handling in middleware headers", () => {
    describe("decodePathname", () => {
        it("decodes percent-encoded emoji to raw Unicode", () => {
            const result = decodePathname("/docs/%F0%9F%8C%BF-getting-started");
            expect(result).toBe("/docs/\u{1F33F}-getting-started");
        });

        it("decodes percent-encoded accented characters", () => {
            const result = decodePathname("/docs/caf%C3%A9-guide");
            expect(result).toBe("/docs/caf\u{00E9}-guide");
        });

        it("decodes percent-encoded CJK characters", () => {
            const result = decodePathname("/docs/%E4%B8%AD%E6%96%87-guide");
            expect(result).toBe("/docs/\u{4E2D}\u{6587}-guide");
        });

        it("passes through plain ASCII pathnames unchanged", () => {
            const result = decodePathname("/docs/getting-started");
            expect(result).toBe("/docs/getting-started");
        });

        it("removes trailing slash before decoding", () => {
            const result = decodePathname("/docs/%F0%9F%8C%BF-getting-started/");
            expect(result).toBe("/docs/\u{1F33F}-getting-started");
        });

        it("returns undefined for malformed percent-encoding", () => {
            const result = decodePathname("/docs/%ZZ-invalid");
            expect(result).toBeUndefined();
        });
    });

    describe("encodeForHeader produces ASCII-safe values", () => {
        it("encodes emoji characters for safe header transport", () => {
            const decoded = "/docs/\u{1F33F}-getting-started";
            const encoded = encodeForHeader(decoded);
            expect(isAsciiSafeHeaderValue(encoded)).toBe(true);
            expect(encoded).toContain("%F0%9F%8C%BF");
        });

        it("encodes accented characters for safe header transport", () => {
            const decoded = "/docs/caf\u{00E9}-guide";
            const encoded = encodeForHeader(decoded);
            expect(isAsciiSafeHeaderValue(encoded)).toBe(true);
        });

        it("encodes CJK characters for safe header transport", () => {
            const decoded = "/docs/\u{4E2D}\u{6587}-guide";
            const encoded = encodeForHeader(decoded);
            expect(isAsciiSafeHeaderValue(encoded)).toBe(true);
        });

        it("leaves plain ASCII pathnames readable (only encodes special URL chars)", () => {
            const decoded = "/docs/getting-started";
            const encoded = encodeForHeader(decoded);
            expect(isAsciiSafeHeaderValue(encoded)).toBe(true);
        });

        it("handles multiple emoji in a single slug", () => {
            const decoded = "/docs/\u{1F680}-launch/\u{1F4DA}-guides";
            const encoded = encodeForHeader(decoded);
            expect(isAsciiSafeHeaderValue(encoded)).toBe(true);
        });

        it("handles emoji-only path segment", () => {
            const decoded = "/docs/\u{1F33F}";
            const encoded = encodeForHeader(decoded);
            expect(isAsciiSafeHeaderValue(encoded)).toBe(true);
        });
    });

    describe("round-trip: decode -> encode -> decode preserves original path", () => {
        const testCases = [
            { name: "emoji slug", raw: "/docs/%F0%9F%8C%BF-getting-started" },
            { name: "accented slug", raw: "/docs/caf%C3%A9-guide" },
            { name: "CJK slug", raw: "/docs/%E4%B8%AD%E6%96%87-guide" },
            { name: "multiple emojis", raw: "/docs/%F0%9F%9A%80-launch/%F0%9F%93%9A-guides" },
            { name: "plain ASCII slug", raw: "/docs/getting-started" },
            { name: "mixed ASCII and emoji", raw: "/docs/hello-%F0%9F%8C%8D-world" }
        ];

        for (const { name, raw } of testCases) {
            it(`preserves ${name} through encode/decode round-trip`, () => {
                const decoded = decodePathname(raw);
                expect(decoded).toBeDefined();

                const reEncoded = encodeForHeader(decoded!);
                expect(isAsciiSafeHeaderValue(reEncoded)).toBe(true);

                const reDecoded = decodeURIComponent(reEncoded);
                expect(reDecoded).toBe(decoded);
            });
        }
    });

    describe("changelog slug encoding", () => {
        /**
         * Mirrors how the middleware sets the x-fern-changelog-slug header (proxy.ts line ~456):
         *   "x-fern-changelog-slug": encodeURIComponent(slug)
         *
         * When a changelog page has an emoji in its slug, the header must be encoded.
         */
        it("encodes changelog slug with emoji for safe header transport", () => {
            const slug = "changelog/\u{1F33F}-new-feature";
            const encoded = encodeURIComponent(slug);
            expect(isAsciiSafeHeaderValue(encoded)).toBe(true);
            expect(decodeURIComponent(encoded)).toBe(slug);
        });

        it("encodes changelog slug with accented characters", () => {
            const slug = "changelog/caf\u{00E9}-update";
            const encoded = encodeURIComponent(slug);
            expect(isAsciiSafeHeaderValue(encoded)).toBe(true);
            expect(decodeURIComponent(encoded)).toBe(slug);
        });
    });

    describe("raw non-ASCII values are NOT safe for headers", () => {
        it("emoji characters fail ASCII header safety check", () => {
            const decoded = "/docs/\u{1F33F}-getting-started";
            expect(isAsciiSafeHeaderValue(decoded)).toBe(false);
        });

        it("accented characters fail ASCII header safety check", () => {
            const decoded = "/docs/caf\u{00E9}-guide";
            expect(isAsciiSafeHeaderValue(decoded)).toBe(false);
        });

        it("CJK characters fail ASCII header safety check", () => {
            const decoded = "/docs/\u{4E2D}\u{6587}-guide";
            expect(isAsciiSafeHeaderValue(decoded)).toBe(false);
        });
    });
});
