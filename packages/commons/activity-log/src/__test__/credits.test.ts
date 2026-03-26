import { describe, expect, it } from "vitest";
import { ASK_FERN_CREDITS_PER_CONVERSATION, calculateCredits } from "../credits.js";
import type { AskFernEvent, FernWriterEvent } from "../types.js";

describe("calculateCredits", () => {
    it("ASK_FERN_CREDITS_PER_CONVERSATION is 2", () => {
        expect(ASK_FERN_CREDITS_PER_CONVERSATION).toBe(2);
    });

    it("returns static 2 credits for ask_fern events", () => {
        const event: AskFernEvent = {
            type: "ask_fern",
            metadata: {
                question: "How do I use the API?",
                response_tokens: 150
            }
        };
        expect(calculateCredits(event)).toBe(ASK_FERN_CREDITS_PER_CONVERSATION);
    });

    it("returns static 2 credits for ask_fern events even with high response_tokens", () => {
        const event: AskFernEvent = {
            type: "ask_fern",
            metadata: {
                question: "Explain the entire API reference in detail",
                response_tokens: 5000
            }
        };
        expect(calculateCredits(event)).toBe(ASK_FERN_CREDITS_PER_CONVERSATION);
    });

    it("returns response_tokens for fern_writer events", () => {
        const event: FernWriterEvent = {
            type: "fern_writer",
            metadata: {
                github_repo: "fern-api/fern",
                response_tokens: 500
            }
        };
        expect(calculateCredits(event)).toBe(500);
    });

    it("returns 0 when response_tokens is 0 for fern_writer events", () => {
        const event: FernWriterEvent = {
            type: "fern_writer",
            metadata: {
                github_repo: "fern-api/fern",
                response_tokens: 0
            }
        };
        expect(calculateCredits(event)).toBe(0);
    });
});
