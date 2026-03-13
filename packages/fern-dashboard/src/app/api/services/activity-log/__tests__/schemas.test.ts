import { describe, expect, it } from "vitest";

import {
    CreditsCheckQuerySchema,
    InsertActivitySchema,
    InsertCreditsSchema,
    InsertWithCreditsSchema,
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

// Contract tests: validate that the payload shape sent by OrgAiCreditClient
// in fai_ai_core/credits/client.py passes Zod validation.
// If these fail, the Python client and dashboard API are out of sync.
describe("InsertWithCreditsSchema - Python client contract", () => {
    it("accepts the exact payload shape sent by OrgAiCreditClient.log_usage()", () => {
        const payload = {
            org_id: "org-123",
            site: "docs.example.buildwithfern.com",
            entry: {
                type: "ask_fern",
                metadata: {
                    question: "How does authentication work?",
                    response_tokens: 150
                }
            }
        };
        const result = InsertWithCreditsSchema.safeParse(payload);
        expect(result.success).toBe(true);
    });

    it("accepts payload with optional user_id in metadata", () => {
        const payload = {
            org_id: "org-123",
            site: "docs.example.com",
            entry: {
                type: "ask_fern",
                metadata: {
                    user_id: "user-456",
                    question: "What is Fern?",
                    response_tokens: 42
                }
            }
        };
        const result = InsertWithCreditsSchema.safeParse(payload);
        expect(result.success).toBe(true);
    });

    it("rejects the old flat payload shape (pre-fix)", () => {
        const oldPayload = {
            type: "ask_fern",
            event_type: "CHAT",
            response_tokens: 150,
            metadata: { domain: "docs.example.com" },
            org_id: "org-123"
        };
        const result = InsertWithCreditsSchema.safeParse(oldPayload);
        expect(result.success).toBe(false);
    });

    it("rejects payload missing site", () => {
        const payload = {
            org_id: "org-123",
            entry: {
                type: "ask_fern",
                metadata: { question: "How?", response_tokens: 100 }
            }
        };
        const result = InsertWithCreditsSchema.safeParse(payload);
        expect(result.success).toBe(false);
    });

    it("rejects payload missing question in metadata", () => {
        const payload = {
            org_id: "org-123",
            site: "docs.example.com",
            entry: {
                type: "ask_fern",
                metadata: { response_tokens: 100 }
            }
        };
        const result = InsertWithCreditsSchema.safeParse(payload);
        expect(result.success).toBe(false);
    });

    it("rejects payload missing response_tokens in metadata", () => {
        const payload = {
            org_id: "org-123",
            site: "docs.example.com",
            entry: {
                type: "ask_fern",
                metadata: { question: "How?" }
            }
        };
        const result = InsertWithCreditsSchema.safeParse(payload);
        expect(result.success).toBe(false);
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
