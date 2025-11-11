import { beforeEach, describe, expect, it, vi } from "vitest";
import { getLanguageModel } from "../get-model-from-config";

// Track which mocks were called to verify correct config is used
const mockCalls: { provider: string; modelId: string }[] = [];

// Mock the external dependencies
vi.mock("@ai-sdk/amazon-bedrock", () => ({
    createAmazonBedrock: vi.fn(() =>
        vi.fn((modelId: string) => {
            mockCalls.push({ provider: "bedrock", modelId });
            return { modelId, provider: "bedrock" };
        })
    )
}));

vi.mock("@ai-sdk/anthropic", () => ({
    createAnthropic: vi.fn(() =>
        vi.fn((modelId: string) => {
            mockCalls.push({ provider: "anthropic", modelId });
            return { modelId, provider: "anthropic" };
        })
    )
}));

vi.mock("@ai-sdk/cohere", () => ({
    createCohere: vi.fn(() =>
        vi.fn((modelId: string) => {
            mockCalls.push({ provider: "cohere", modelId });
            return { modelId, provider: "cohere" };
        })
    )
}));

vi.mock("ai-fallback", () => ({
    createFallback: vi.fn((config) => ({
        models: config.models,
        provider: "fallback"
    }))
}));

vi.mock("@fern-api/docs-server/env-variables", () => ({
    anthropicApiKey: vi.fn(() => "test-anthropic-key"),
    cohereApiKey: vi.fn(() => "test-cohere-key")
}));

describe("get-model-from-config", () => {
    beforeEach(() => {
        mockCalls.length = 0; // Clear mock calls before each test
    });

    describe("getLanguageModel with regular models", () => {
        it("should return bedrock model with fallback for claude-3.7", () => {
            const result = getLanguageModel("claude-3.7");
            expect(result.provider).toBe("bedrock");
            expect(result.model).toBeDefined();
        });

        it("should return bedrock model with fallback for claude-4", () => {
            const result = getLanguageModel("claude-4");
            expect(result.provider).toBe("bedrock");
            expect(result.model).toBeDefined();
        });

        it("should return bedrock model with fallback for claude-4.5", () => {
            const result = getLanguageModel("claude-4.5");
            expect(result.provider).toBe("bedrock");
            expect(result.model).toBeDefined();
        });

        it("should return bedrock model with fallback for claude-4.5-haiku", () => {
            const result = getLanguageModel("claude-4.5-haiku");
            expect(result.provider).toBe("bedrock");
            expect(result.model).toBeDefined();
        });

        it("should default to claude-3.7 for undefined model", () => {
            const result = getLanguageModel(undefined);
            expect(result.provider).toBe("bedrock");
            expect(result.model).toBeDefined();
        });

        it("should default to claude-3.7 for invalid model", () => {
            const result = getLanguageModel("invalid-model");
            expect(result.provider).toBe("bedrock");
            expect(result.model).toBeDefined();
        });

        it("should return cohere model for command-a", () => {
            const result = getLanguageModel("command-a");
            expect(result.provider).toBe("cohere");
            expect(result.model).toBeDefined();
        });

        it("should return cohere model for command-r-plus", () => {
            const result = getLanguageModel("command-r-plus");
            expect(result.provider).toBe("cohere");
            expect(result.model).toBeDefined();
        });
    });

    describe("getLanguageModel with forStructuredOutput option", () => {
        it("should return anthropic model for claude-3.7 with structured output", () => {
            const result = getLanguageModel("claude-3.7", { forStructuredOutput: true });
            expect(result.provider).toBe("anthropic");
            expect(result.model).toBeDefined();
            expect((result.model as any).modelId).toBe("claude-3-7-sonnet-20250219");
        });

        it("should return anthropic model for claude-4 with structured output", () => {
            const result = getLanguageModel("claude-4", { forStructuredOutput: true });
            expect(result.provider).toBe("anthropic");
            expect(result.model).toBeDefined();
            expect((result.model as any).modelId).toBe("claude-sonnet-4-20250514");
        });

        it("should return anthropic model for claude-4.5 with structured output", () => {
            const result = getLanguageModel("claude-4.5", { forStructuredOutput: true });
            expect(result.provider).toBe("anthropic");
            expect(result.model).toBeDefined();
            expect((result.model as any).modelId).toBe("claude-sonnet-4-5-20250929");
        });

        it("should return anthropic model for claude-4.5-haiku with structured output", () => {
            const result = getLanguageModel("claude-4.5-haiku", { forStructuredOutput: true });
            expect(result.provider).toBe("anthropic");
            expect(result.model).toBeDefined();
            expect((result.model as any).modelId).toBe("claude-haiku-4-5-20251001");
        });

        it("should default to claude-3.7 anthropic model for undefined model with structured output", () => {
            const result = getLanguageModel(undefined, { forStructuredOutput: true });
            expect(result.provider).toBe("anthropic");
            expect(result.model).toBeDefined();
            expect((result.model as any).modelId).toBe("claude-3-7-sonnet-20250219");
        });

        it("should default to claude-3.7 anthropic model for invalid model with structured output", () => {
            const result = getLanguageModel("invalid-model", { forStructuredOutput: true });
            expect(result.provider).toBe("anthropic");
            expect(result.model).toBeDefined();
            expect((result.model as any).modelId).toBe("claude-3-7-sonnet-20250219");
        });
    });

    describe("model resolution validation", () => {
        it("should correctly resolve valid model IDs", () => {
            const validModels = ["claude-3.7", "claude-4", "claude-4.5", "claude-4.5-haiku"];

            for (const model of validModels) {
                const result = getLanguageModel(model, { forStructuredOutput: true });
                expect(result.provider).toBe("anthropic");
                expect(result.model).toBeDefined();
            }
        });

        it("should fallback to default for all invalid model IDs", () => {
            const invalidModels = ["claude-3", "claude-4.5-sonnet", "gpt-4", "invalid", "", "claude-5"];

            for (const model of invalidModels) {
                const result = getLanguageModel(model, { forStructuredOutput: true });
                expect(result.provider).toBe("anthropic");
                // Should fall back to default model (claude-3.7)
                expect((result.model as any).modelId).toBe("claude-3-7-sonnet-20250219");
            }
        });
    });

    describe("correct config selection for structured output", () => {
        it("should use Anthropic model IDs (not Bedrock) for structured output", () => {
            mockCalls.length = 0;

            const result = getLanguageModel("claude-4.5-haiku", { forStructuredOutput: true });

            expect(result.provider).toBe("anthropic");

            // The key test: should use Anthropic's model ID format (claude-haiku-4-5-20251001)
            // NOT Bedrock's format (us.anthropic.claude-haiku-4-5-20251001-v1:0)
            const anthropicCalls = mockCalls.filter((call) => call.provider === "anthropic");
            expect(anthropicCalls.length).toBeGreaterThan(0);
            expect(anthropicCalls[0]?.modelId).toBe("claude-haiku-4-5-20251001");
            expect(anthropicCalls[0]?.modelId).not.toContain("us.anthropic");
            expect(anthropicCalls[0]?.modelId).not.toContain("-v1:0");
        });

        it("should use Bedrock model IDs for regular (non-structured output) requests", () => {
            mockCalls.length = 0;

            const result = getLanguageModel("claude-4.5-haiku");

            expect(result.provider).toBe("bedrock");

            // Should use Bedrock's model ID format
            const bedrockCalls = mockCalls.filter((call) => call.provider === "bedrock");
            expect(bedrockCalls.length).toBeGreaterThan(0);
            expect(bedrockCalls.some((call) => call.modelId.includes("us.anthropic"))).toBe(true);
            expect(bedrockCalls.some((call) => call.modelId.includes("-v1:0"))).toBe(true);
        });
    });
});
