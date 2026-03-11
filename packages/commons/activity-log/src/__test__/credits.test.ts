import { describe, expect, it } from "vitest";
import { calculateCredits } from "../credits.js";
import type { AskFernEvent, FernWriterEvent } from "../types.js";

describe("calculateCredits", () => {
    it("returns response_tokens for ask_fern events", () => {
        const event: AskFernEvent = {
            type: "ask_fern",
            metadata: {
                question: "How do I use the API?",
                response_tokens: 150
            }
        };
        expect(calculateCredits(event)).toBe(150);
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

    it("returns 0 when response_tokens is 0", () => {
        const event: AskFernEvent = {
            type: "ask_fern",
            metadata: {
                question: "test",
                response_tokens: 0
            }
        };
        expect(calculateCredits(event)).toBe(0);
    });
});
