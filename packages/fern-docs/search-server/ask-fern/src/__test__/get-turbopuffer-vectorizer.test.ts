import type { MockInstance } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("gpt-tokenizer", () => ({
    encode: (s: string) => Array(parseInt(s.replace(/\D/g, "") || "0", 10)).fill(0)
}));

vi.mock("ai", () => ({
    embedMany: vi.fn()
}));

import { embedMany } from "ai";
import { getTurbopufferVectorizer } from "../turbopuffer/utils/get-turbopuffer-vectorizer";

const embedManyMock = embedMany as ReturnType<typeof vi.fn>;

function getCallValues(callIdx: number): string[] {
    const arg = embedManyMock.mock.calls[callIdx]![0] as { values: string[] };
    return arg.values;
}

describe("getTurbopufferVectorizer", () => {
    let randSpy: ReturnType<typeof vi.spyOn>;
    let setTimeoutSpy: MockInstance;

    beforeEach(() => {
        vi.clearAllMocks();

        vi.useFakeTimers();

        randSpy = vi.spyOn(Math, "random").mockReturnValue(0);

        setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    });

    afterEach(() => {
        vi.useRealTimers();

        randSpy.mockRestore();
        setTimeoutSpy.mockRestore();
        vi.restoreAllMocks();
    });

    describe("batching logic", () => {
        it("should send single batch when total tokens under limit", async () => {
            embedManyMock.mockResolvedValue({
                embeddings: [[0], [0], [0]],
                usage: { tokens: 35 }
            });

            const vectorize = getTurbopufferVectorizer({} as any);
            const promise = vectorize(["c10", "c20", "c5"]);

            await vi.runAllTimersAsync();
            await promise;

            expect(embedManyMock).toHaveBeenCalledTimes(1);
            expect(getCallValues(0)).toEqual(["c10", "c20", "c5"]);
        });

        it("should send multiple batches when tokens exceed limit", async () => {
            embedManyMock
                .mockResolvedValueOnce({
                    embeddings: [[0]],
                    usage: { tokens: 14500 }
                })
                .mockResolvedValueOnce({
                    embeddings: [[0], [0]],
                    usage: { tokens: 1500 }
                });

            const vectorize = getTurbopufferVectorizer({} as any);
            const promise = vectorize(["c14500", "c1000", "c500"]);

            await vi.runAllTimersAsync();
            await promise;

            expect(embedManyMock).toHaveBeenCalledTimes(2);
            expect(getCallValues(0)).toEqual(["c14500"]);
            expect(getCallValues(1)).toEqual(["c1000", "c500"]);
        });

        it("should allow exact boundary without early flush", async () => {
            embedManyMock.mockResolvedValue({
                embeddings: [[0], [0]],
                usage: { tokens: 15000 }
            });

            const vectorize = getTurbopufferVectorizer({} as any);
            const promise = vectorize(["c10000", "c5000"]);

            await vi.runAllTimersAsync();
            await promise;

            expect(embedManyMock).toHaveBeenCalledTimes(1);
            expect(getCallValues(0)).toEqual(["c10000", "c5000"]);
        });

        it("should prevent overflow by checking before adding chunk", async () => {
            embedManyMock
                .mockResolvedValueOnce({
                    embeddings: [[0]],
                    usage: { tokens: 14500 }
                })
                .mockResolvedValueOnce({
                    embeddings: [[0]],
                    usage: { tokens: 1000 }
                });

            const vectorize = getTurbopufferVectorizer({} as any);
            const promise = vectorize(["c14500", "c1000"]);

            await vi.runAllTimersAsync();
            await promise;

            expect(embedManyMock).toHaveBeenCalledTimes(2);
            expect(getCallValues(0)).toEqual(["c14500"]);
            expect(getCallValues(1)).toEqual(["c1000"]);
        });

        it("should handle empty chunks array", async () => {
            const vectorize = getTurbopufferVectorizer({} as any);
            const promise = vectorize([]);

            await vi.runAllTimersAsync();
            const result = await promise;

            expect(embedManyMock).not.toHaveBeenCalled();
            expect(result).toEqual([]);
        });
    });

    describe("inter-batch delay", () => {
        it("should add delay when batch exceeds 80% of max tokens", async () => {
            embedManyMock
                .mockResolvedValueOnce({
                    embeddings: [[0]],
                    usage: { tokens: 13000 }
                })
                .mockResolvedValueOnce({
                    embeddings: [[0]],
                    usage: { tokens: 3000 }
                });

            const vectorize = getTurbopufferVectorizer({} as any);
            const promise = vectorize(["c13000", "c3000"]);

            await vi.runAllTimersAsync();
            await promise;

            expect(embedManyMock).toHaveBeenCalledTimes(2);
            expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 500);
        });

        it("should not add delay for final batch", async () => {
            embedManyMock.mockResolvedValue({
                embeddings: [[0]],
                usage: { tokens: 13000 }
            });

            const vectorize = getTurbopufferVectorizer({} as any);
            const promise = vectorize(["c13000"]);

            await vi.runAllTimersAsync();
            await promise;

            expect(embedManyMock).toHaveBeenCalledTimes(1);
            expect(setTimeoutSpy).not.toHaveBeenCalled();
        });
    });

    describe("retry logic", () => {
        it("should retry on rate limit error and honor retry-after", async () => {
            embedManyMock
                .mockRejectedValueOnce(
                    new Error("Rate limit reached for text-embedding-3-large... Please try again in 2000ms")
                )
                .mockResolvedValueOnce({
                    embeddings: [[0]],
                    usage: { tokens: 10 }
                });

            const vectorize = getTurbopufferVectorizer({} as any);
            const promise = vectorize(["c10"]);

            await vi.advanceTimersByTimeAsync(2000);
            await promise;

            expect(embedManyMock).toHaveBeenCalledTimes(2);
            expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 2000);
        });

        it("should use exponential backoff when retry-after not present", async () => {
            embedManyMock.mockRejectedValueOnce(new Error("Some other error")).mockResolvedValueOnce({
                embeddings: [[0]],
                usage: { tokens: 10 }
            });

            const vectorize = getTurbopufferVectorizer({} as any);
            const promise = vectorize(["c10"]);

            await vi.advanceTimersByTimeAsync(1000);
            await promise;

            expect(embedManyMock).toHaveBeenCalledTimes(2);
            expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 1000);
        });

        it("should throw after max retries exceeded", async () => {
            embedManyMock.mockRejectedValue(new Error("Persistent error"));

            const vectorize = getTurbopufferVectorizer({} as any);
            const promise = vectorize(["c10"]);
            const assertion = expect(promise).rejects.toThrow("Failed to embed after 5 attempts");

            await vi.advanceTimersByTimeAsync(1000);
            await vi.advanceTimersByTimeAsync(2000);
            await vi.advanceTimersByTimeAsync(4000);
            await vi.advanceTimersByTimeAsync(8000);
            await vi.advanceTimersByTimeAsync(16000);

            await assertion;
            expect(embedManyMock).toHaveBeenCalledTimes(5);
        });

        it("should add inter-batch delay after rate limit error", async () => {
            embedManyMock
                .mockRejectedValueOnce(new Error("Rate limit reached... Please try again in 1500ms"))
                .mockResolvedValueOnce({
                    embeddings: [[0]],
                    usage: { tokens: 14500 }
                })
                .mockResolvedValueOnce({
                    embeddings: [[0]],
                    usage: { tokens: 1000 }
                });

            const vectorize = getTurbopufferVectorizer({} as any);
            const promise = vectorize(["c14500", "c1000"]);

            await vi.runAllTimersAsync();
            await promise;

            expect(embedManyMock).toHaveBeenCalledTimes(3);
            const setTimeoutCalls = setTimeoutSpy.mock.calls.map((call: any) => call[1]);
            expect(setTimeoutCalls).toContain(1500);
        });
    });

    describe("token count", () => {
        it("should populate token count from embedding output", async () => {
            embedManyMock.mockResolvedValue({
                embeddings: [[0], [0]],
                usage: { tokens: 25 }
            });

            const vectorize = getTurbopufferVectorizer({} as any);
            const promise = vectorize(["c10", "c15"]);

            await vi.runAllTimersAsync();
            await promise;

            expect(embedManyMock).toHaveBeenCalledTimes(1);
        });

        it("should handle missing usage tokens gracefully", async () => {
            embedManyMock.mockResolvedValue({
                embeddings: [[0]],
                usage: undefined
            });

            const vectorize = getTurbopufferVectorizer({} as any);
            const promise = vectorize(["c10"]);

            await vi.runAllTimersAsync();
            await promise;

            expect(embedManyMock).toHaveBeenCalledTimes(1);
        });
    });
});
