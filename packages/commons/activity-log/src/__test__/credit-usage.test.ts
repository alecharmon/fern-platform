import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    checkCreditAllowance,
    getCreditUsage,
    insertCreditUsage,
    logActivityWithCredits,
    sumCreditUsage
} from "../credit-usage.js";
import type { AskFernEvent } from "../types.js";

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockEq = vi.fn();
const mockGte = vi.fn();
const mockLte = vi.fn();
const mockOrder = vi.fn();
const mockRange = vi.fn();
const mockSingle = vi.fn();
const _mockMaybeSingle = vi.fn();

const mockFrom = vi.fn();

vi.mock("@fern-platform/supabase", () => ({
    getClient: () => ({
        from: mockFrom
    })
}));

const fakeCreditUsage = {
    id: "credit-123",
    org_id: "org-1",
    site: "docs.example.com",
    type: "ask_fern",
    credits_used: 100,
    event_id: "event-123",
    created_at: "2026-03-09T00:00:00Z"
};

const fakeActivityLog = {
    id: "event-123",
    org_id: "org-1",
    site: "docs.example.com",
    type: "ask_fern",
    metadata: { question: "How?", response_tokens: 100 },
    expires_at: null,
    created_at: "2026-03-09T00:00:00Z"
};

describe("insertCreditUsage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFrom.mockReturnValue({ insert: mockInsert });
        mockInsert.mockReturnValue({ select: mockSelect });
        mockSelect.mockReturnValue({ single: mockSingle });
    });

    it("inserts a credit usage record", async () => {
        mockSingle.mockResolvedValue({ data: fakeCreditUsage, error: null });

        const result = await insertCreditUsage("org-1", "docs.example.com", "ask_fern", 100, "event-123");
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.credits_used).toBe(100);
            expect(result.value.type).toBe("ask_fern");
        }
        expect(mockFrom).toHaveBeenCalledWith("org_fern_credit_usage");
    });

    it("returns INSERT_FAILED on error", async () => {
        mockSingle.mockResolvedValue({ data: null, error: { message: "db error" } });

        const result = await insertCreditUsage("org-1", "docs.example.com", "ask_fern", 100, "event-123");
        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
            expect(result.error.code).toBe("INSERT_FAILED");
        }
    });
});

describe("getCreditUsage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFrom.mockReturnValue({ select: mockSelect });
        mockSelect.mockReturnValue({ eq: mockEq });
        mockEq.mockReturnValue({ order: mockOrder, eq: mockEq });
        mockOrder.mockReturnValue({ range: mockRange });
        mockRange.mockResolvedValue({ data: [fakeCreditUsage], error: null });
    });

    it("returns credit usage records for an org", async () => {
        const result = await getCreditUsage("org-1");
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toHaveLength(1);
            expect(result.value[0]!.credits_used).toBe(100);
        }
    });
});

describe("sumCreditUsage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFrom.mockReturnValue({ select: mockSelect });
        mockSelect.mockReturnValue({ eq: mockEq });
        mockEq.mockReturnValue({ gte: mockGte, eq: mockEq });
        mockGte.mockReturnValue({ lte: mockLte });
        mockLte.mockResolvedValue({ data: [{ credits_used: 50 }, { credits_used: 75 }], error: null });
    });

    it("sums credit usage over a time range", async () => {
        const result = await sumCreditUsage("org-1", "2026-03-01T00:00:00Z", "2026-03-31T23:59:59Z");
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toBe(125);
        }
    });

    it("returns 0 when no records found", async () => {
        mockLte.mockResolvedValue({ data: [], error: null });
        const result = await sumCreditUsage("org-1", "2026-03-01T00:00:00Z", "2026-03-31T23:59:59Z");
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toBe(0);
        }
    });
});

describe("logActivityWithCredits", () => {
    const askFernEvent: AskFernEvent = {
        type: "ask_fern",
        metadata: { question: "How?", response_tokens: 100 }
    };

    beforeEach(() => {
        vi.clearAllMocks();
        // Mock for both activity log and credit usage inserts
        const mockInsertChain = { select: vi.fn().mockReturnValue({ single: vi.fn() }) };

        mockFrom.mockImplementation((table: string) => {
            if (table === "org_activity_log") {
                return {
                    insert: vi.fn().mockReturnValue({
                        select: vi.fn().mockReturnValue({
                            single: vi.fn().mockResolvedValue({ data: fakeActivityLog, error: null })
                        })
                    })
                };
            }
            if (table === "org_fern_credit_usage") {
                return {
                    insert: vi.fn().mockReturnValue({
                        select: vi.fn().mockReturnValue({
                            single: vi.fn().mockResolvedValue({ data: fakeCreditUsage, error: null })
                        })
                    })
                };
            }
            return mockInsertChain;
        });
    });

    it("inserts both activity log and credit usage", async () => {
        const result = await logActivityWithCredits("org-1", "docs.example.com", askFernEvent);
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.event.id).toBe("event-123");
            expect(result.value.credit.credits_used).toBe(100);
        }
    });

    it("calculates credits from response_tokens", async () => {
        const result = await logActivityWithCredits("org-1", "docs.example.com", askFernEvent);
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.credit.credits_used).toBe(100);
        }
    });
});

describe("checkCreditAllowance", () => {
    it("returns allowed=true with usage and limit when entitled", async () => {
        const mockCheck = vi.fn().mockResolvedValue({
            entitled: true,
            type: "metered",
            allowance: 1000,
            used: 250,
            remaining: 750,
            overagePolicy: "hard_cap"
        });

        const result = await checkCreditAllowance("org-1", mockCheck);
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toEqual({ allowed: true, used: 250, limit: 1000 });
        }
        expect(mockCheck).toHaveBeenCalledWith("org-1", "ai_credits");
    });

    it("returns allowed=false when not entitled", async () => {
        const mockCheck = vi.fn().mockResolvedValue({
            entitled: false,
            reason: "ai_credits allowance exhausted (1000/1000)",
            limit: 1000,
            used: 1000
        });

        const result = await checkCreditAllowance("org-1", mockCheck);
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toEqual({ allowed: false, used: 1000, limit: 1000 });
        }
    });

    it("returns allowed=false with zero limit when no grant exists", async () => {
        const mockCheck = vi.fn().mockResolvedValue({
            entitled: false,
            reason: "No active entitlement for ai_credits"
        });

        const result = await checkCreditAllowance("org-1", mockCheck);
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value).toEqual({ allowed: false, used: 0, limit: 0 });
        }
    });

    it("returns error when check throws", async () => {
        const mockCheck = vi.fn().mockRejectedValue(new Error("entitlements down"));

        const result = await checkCreditAllowance("org-1", mockCheck);
        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
            expect(result.error.code).toBe("QUERY_FAILED");
        }
    });
});
