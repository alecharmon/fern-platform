import { vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@anthropic-ai/sdk", () => ({
    Anthropic: vi.fn().mockImplementation(() => ({}))
}));
vi.mock("@ai-sdk/anthropic", () => ({
    createAnthropic: vi.fn().mockReturnValue(() => ({}))
}));
vi.mock("ai", () => ({
    generateObject: vi.fn()
}));

import { AnthropicClient, AnthropicGenerationError } from ".";

describe("AnthropicClient.withRetries", () => {
    it("retries retriable errors and succeeds within the limit", async () => {
        const client = new AnthropicClient("fake-api-key");
        const attempts: number[] = [];

        const result = await (client as any).withRetries(async () => {
            attempts.push(Date.now());
            if (attempts.length < 3) {
                throw new AnthropicGenerationError("temporary failure", { retriable: true });
            }
            return "ok";
        }, 3);

        expect(result).toBe("ok");
        expect(attempts.length).toBe(3);
    });

    it("does not retry non-retriable errors", async () => {
        const client = new AnthropicClient("fake-api-key");
        const error = new AnthropicGenerationError("non-retriable failure", { retriable: false });
        let calls = 0;

        await expect(
            (client as any).withRetries(async () => {
                calls += 1;
                throw error;
            }, 3)
        ).rejects.toBe(error);

        expect(calls).toBe(1);
    });

    it("throws after exhausting retries on retriable errors", async () => {
        const client = new AnthropicClient("fake-api-key");
        let calls = 0;

        await expect(
            (client as any).withRetries(async () => {
                calls += 1;
                throw new AnthropicGenerationError("temporary failure", { retriable: true });
            }, 2)
        ).rejects.toBeInstanceOf(AnthropicGenerationError);

        expect(calls).toBe(2);
    });
});
