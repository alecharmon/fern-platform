import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAndDiscard } from "./fetch-and-discard";

describe("fetchAndDiscard", () => {
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
        vi.restoreAllMocks();
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    function mockFetchWithBody(status: number, ok: boolean, bodyContent = "response body") {
        const cancelFn = vi.fn().mockResolvedValue(undefined);
        const body = {
            cancel: cancelFn,
            getReader: vi.fn(),
            locked: false
        } as unknown as ReadableStream<Uint8Array>;

        globalThis.fetch = vi.fn().mockResolvedValue({
            ok,
            status,
            body
        });

        return { cancelFn, body };
    }

    it("should return ok and status from the response", async () => {
        mockFetchWithBody(200, true);

        const result = await fetchAndDiscard("https://example.com/page");

        expect(result).toEqual({ ok: true, status: 200 });
    });

    it("should cancel the response body to release the connection", async () => {
        const { cancelFn } = mockFetchWithBody(200, true);

        await fetchAndDiscard("https://example.com/page");

        expect(cancelFn).toHaveBeenCalledOnce();
    });

    it("should cancel the body even on non-ok responses", async () => {
        const { cancelFn } = mockFetchWithBody(500, false);

        const result = await fetchAndDiscard("https://example.com/page");

        expect(result).toEqual({ ok: false, status: 500 });
        expect(cancelFn).toHaveBeenCalledOnce();
    });

    it("should handle responses with null body (e.g. HEAD requests)", async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            body: null
        });

        const result = await fetchAndDiscard("https://example.com/page", { method: "HEAD" });

        expect(result).toEqual({ ok: true, status: 200 });
    });

    it("should pass through request init options to fetch", async () => {
        mockFetchWithBody(200, true);
        const fetchSpy = globalThis.fetch as ReturnType<typeof vi.fn>;

        const headers = { "X-Custom-Header": "value" };
        await fetchAndDiscard("https://example.com/page", {
            method: "POST",
            headers,
            signal: AbortSignal.timeout(5000)
        });

        expect(fetchSpy).toHaveBeenCalledWith(
            "https://example.com/page",
            expect.objectContaining({
                method: "POST",
                headers
            })
        );
    });

    it("should propagate fetch errors without leaking connections", async () => {
        globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

        await expect(fetchAndDiscard("https://example.com/page")).rejects.toThrow("Network error");
    });

    it("should cancel bodies for all concurrent requests", async () => {
        const cancelFns: ReturnType<typeof vi.fn>[] = [];

        globalThis.fetch = vi.fn().mockImplementation(async () => {
            const cancelFn = vi.fn().mockResolvedValue(undefined);
            cancelFns.push(cancelFn);
            return {
                ok: true,
                status: 200,
                body: { cancel: cancelFn }
            };
        });

        const urls = Array.from({ length: 50 }, (_, i) => `https://example.com/page-${i}`);
        await Promise.all(urls.map((url) => fetchAndDiscard(url)));

        expect(cancelFns).toHaveLength(50);
        for (const cancelFn of cancelFns) {
            expect(cancelFn).toHaveBeenCalledOnce();
        }
    });
});
