import { describe, expect, it } from "vitest";

import {
    CreditsCheckQuerySchema,
    InsertActivitySchema,
    InsertCreditsSchema,
    SumCreditsSchema
} from "../_utils/schemas";

describe("InsertActivitySchema", () => {
    it("accepts valid ask_fern input", () => {
        const result = InsertActivitySchema.safeParse({
            org_id: "org-1",
            site: "docs.example.com",
            entry: { type: "ask_fern", metadata: { question: "How?", response_tokens: 100 } }
        });
        expect(result.success).toBe(true);
    });

    it("accepts valid fern_writer input", () => {
        const result = InsertActivitySchema.safeParse({
            org_id: "org-1",
            site: "docs.example.com",
            entry: { type: "fern_writer", metadata: { github_repo: "fern-api/fern", response_tokens: 500 } }
        });
        expect(result.success).toBe(true);
    });

    it("accepts optional ttl", () => {
        const result = InsertActivitySchema.safeParse({
            org_id: "org-1",
            site: "docs.example.com",
            entry: { type: "ask_fern", metadata: { question: "How?", response_tokens: 100 } },
            ttl: { days: 90 }
        });
        expect(result.success).toBe(true);
    });

    it("rejects empty org_id", () => {
        const result = InsertActivitySchema.safeParse({
            org_id: "",
            site: "docs.example.com",
            entry: { type: "ask_fern", metadata: { question: "How?", response_tokens: 100 } }
        });
        expect(result.success).toBe(false);
    });

    it("rejects missing entry", () => {
        const result = InsertActivitySchema.safeParse({
            org_id: "org-1",
            site: "docs.example.com"
        });
        expect(result.success).toBe(false);
    });

    it("rejects invalid event type", () => {
        const result = InsertActivitySchema.safeParse({
            org_id: "org-1",
            site: "docs.example.com",
            entry: { type: "invalid", metadata: { question: "How?", response_tokens: 100 } }
        });
        expect(result.success).toBe(false);
    });
});

describe("InsertCreditsSchema", () => {
    it("accepts valid input", () => {
        const result = InsertCreditsSchema.safeParse({
            org_id: "org-1",
            site: "docs.example.com",
            type: "ask_fern",
            credits_used: 100,
            event_id: "event-123"
        });
        expect(result.success).toBe(true);
    });

    it("rejects non-integer credits_used", () => {
        const result = InsertCreditsSchema.safeParse({
            org_id: "org-1",
            site: "docs.example.com",
            type: "ask_fern",
            credits_used: 1.5,
            event_id: "event-123"
        });
        expect(result.success).toBe(false);
    });

    it("rejects invalid type", () => {
        const result = InsertCreditsSchema.safeParse({
            org_id: "org-1",
            site: "docs.example.com",
            type: "invalid",
            credits_used: 100,
            event_id: "event-123"
        });
        expect(result.success).toBe(false);
    });
});

describe("SumCreditsSchema", () => {
    it("accepts required fields only", () => {
        const result = SumCreditsSchema.safeParse({
            org_id: "org-1",
            since: "2026-03-01T00:00:00Z",
            until: "2026-03-31T23:59:59Z"
        });
        expect(result.success).toBe(true);
    });

    it("accepts optional site and type", () => {
        const result = SumCreditsSchema.safeParse({
            org_id: "org-1",
            since: "2026-03-01T00:00:00Z",
            until: "2026-03-31T23:59:59Z",
            site: "docs.example.com",
            type: "fern_writer"
        });
        expect(result.success).toBe(true);
    });
});

describe("CreditsCheckQuerySchema", () => {
    it("accepts valid org_id", () => {
        const result = CreditsCheckQuerySchema.safeParse({ org_id: "org-1" });
        expect(result.success).toBe(true);
    });

    it("rejects null org_id", () => {
        const result = CreditsCheckQuerySchema.safeParse({ org_id: null });
        expect(result.success).toBe(false);
    });

    it("rejects empty org_id", () => {
        const result = CreditsCheckQuerySchema.safeParse({ org_id: "" });
        expect(result.success).toBe(false);
    });
});
