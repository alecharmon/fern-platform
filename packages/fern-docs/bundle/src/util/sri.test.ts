import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computeSriHashUncached, enrichRemoteScriptsWithIntegrity } from "./sri";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("computeSriHashUncached", () => {
    beforeEach(() => {
        mockFetch.mockClear();
    });

    afterEach(() => {
        vi.clearAllTimers();
    });

    it("should compute SHA-256 hash for valid script", async () => {
        const scriptContent = "console.log('Hello World');";
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            headers: {
                get: (header: string) => (header === "Access-Control-Allow-Origin" ? "*" : null)
            },
            arrayBuffer: async () => Buffer.from(scriptContent)
        });

        const hash = await computeSriHashUncached("https://example.com/script.js", "sha256");

        expect(hash).toBeDefined();
        expect(hash).toMatch(/^sha256-[A-Za-z0-9+/=]+$/);
        expect(mockFetch).toHaveBeenCalledWith("https://example.com/script.js", expect.any(Object));
    });

    it("should return undefined for failed fetch", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 404
        });

        const hash = await computeSriHashUncached("https://example.com/not-found.js", "sha256");

        expect(hash).toBeUndefined();
    });

    it("should handle network errors", async () => {
        mockFetch.mockRejectedValueOnce(new Error("Network error"));

        const hash = await computeSriHashUncached("https://example.com/network-error.js", "sha256");

        expect(hash).toBeUndefined();
    });

    it("should skip scripts without CORS support", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            headers: {
                get: () => null // No CORS headers
            },
            arrayBuffer: async () => Buffer.from("console.log('no cors');")
        });

        const hash = await computeSriHashUncached("https://example.com/no-cors-script.js", "sha256");

        expect(hash).toBeUndefined();
    });

    it("should support different algorithms", async () => {
        const scriptContent = "console.log('test');";

        // Mock fetch for each call
        mockFetch.mockResolvedValue({
            ok: true,
            status: 200,
            headers: {
                get: (header: string) => (header === "Access-Control-Allow-Origin" ? "*" : null)
            },
            arrayBuffer: async () => Buffer.from(scriptContent)
        });

        const sha256Hash = await computeSriHashUncached("https://example.com/different-algos.js", "sha256");
        const sha384Hash = await computeSriHashUncached("https://example.com/different-algos.js", "sha384");
        const sha512Hash = await computeSriHashUncached("https://example.com/different-algos.js", "sha512");

        expect(sha256Hash).toMatch(/^sha256-/);
        expect(sha384Hash).toMatch(/^sha384-/);
        expect(sha512Hash).toMatch(/^sha512-/);

        // Should have called fetch 3 times (once per algorithm)
        expect(mockFetch).toHaveBeenCalledTimes(3);
    });
});

describe("enrichRemoteScriptsWithIntegrity", () => {
    beforeEach(() => {
        mockFetch.mockClear();
    });

    it("should return undefined for undefined input", async () => {
        const result = await enrichRemoteScriptsWithIntegrity(undefined);
        expect(result).toBeUndefined();
    });

    it("should return empty array for empty input", async () => {
        const result = await enrichRemoteScriptsWithIntegrity([]);
        expect(result).toEqual([]);
    });

    it("should skip scripts that already have integrity", async () => {
        const scripts = [
            {
                url: "https://example.com/script1.js",
                strategy: "afterInteractive" as const,
                integrity: "sha384-existing-hash"
            }
        ];

        const result = await enrichRemoteScriptsWithIntegrity(scripts);

        expect(result).toEqual(scripts);
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should compute integrity for scripts without it", async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            status: 200,
            headers: {
                get: (header: string) => (header === "Access-Control-Allow-Origin" ? "*" : null)
            },
            arrayBuffer: async () => Buffer.from("console.log('test');")
        });

        const scripts = [
            {
                url: "https://example.com/script1.js",
                strategy: "afterInteractive" as const,
                integrity: undefined
            }
        ];

        const result = await enrichRemoteScriptsWithIntegrity(scripts, computeSriHashUncached);

        expect(result).toBeDefined();
        expect(result).toHaveLength(1);
        expect(result?.[0]?.integrity).toBeDefined();
        expect(result?.[0]?.integrity).toMatch(/^sha256-/);
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should handle mixed scripts with and without integrity", async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            status: 200,
            headers: {
                get: (header: string) => (header === "Access-Control-Allow-Origin" ? "*" : null)
            },
            arrayBuffer: async () => Buffer.from("console.log('test');")
        });

        const scripts = [
            {
                url: "https://example.com/script1.js",
                strategy: "afterInteractive" as const,
                integrity: "sha384-existing"
            },
            {
                url: "https://example.com/script2.js",
                strategy: "lazyOnload" as const
            }
        ];

        const result = await enrichRemoteScriptsWithIntegrity(scripts, computeSriHashUncached);

        expect(result).toBeDefined();
        expect(result).toHaveLength(2);
        expect(result?.[0]?.integrity).toBe("sha384-existing");
        expect(result?.[1]?.integrity).toBeDefined();
        expect(result?.[1]?.integrity).toMatch(/^sha256-/);
        expect(mockFetch).toHaveBeenCalledTimes(1); // Only for script2
    });

    it("should handle fetch failures gracefully", async () => {
        mockFetch.mockResolvedValue({
            ok: false,
            status: 404
        });

        const scripts = [
            {
                url: "https://example.com/not-found.js",
                strategy: "afterInteractive" as const,
                integrity: undefined
            }
        ];

        const result = await enrichRemoteScriptsWithIntegrity(scripts, computeSriHashUncached);

        expect(result).toBeDefined();
        expect(result).toHaveLength(1);
        expect(result?.[0]?.integrity).toBeUndefined();
    });
});
