import { describe, expect, it } from "vitest";
import type { ActivityLogEntry, ActivityLogType, Duration } from "../types.js";

describe("types", () => {
    it("ActivityLogType is a union of event type literals", () => {
        const askFern: ActivityLogType = "ask_fern";
        const fernWriter: ActivityLogType = "fern_writer";
        expect(askFern).toBe("ask_fern");
        expect(fernWriter).toBe("fern_writer");
    });

    it("ActivityLogEntry discriminates on type", () => {
        const entry: ActivityLogEntry = {
            type: "ask_fern",
            metadata: { question: "test", response_tokens: 10 }
        };

        if (entry.type === "ask_fern") {
            expect(entry.metadata.question).toBe("test");
        }
    });

    it("Duration supports days and hours", () => {
        const d1: Duration = { days: 90 };
        const d2: Duration = { hours: 2 };
        const d3: Duration = { days: 1, hours: 12 };
        expect(d1.days).toBe(90);
        expect(d2.hours).toBe(2);
        expect(d3.days).toBe(1);
        expect(d3.hours).toBe(12);
    });
});
