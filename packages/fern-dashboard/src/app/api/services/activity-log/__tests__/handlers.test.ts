import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

vi.mock("@fern-platform/activity-log", () => ({
    insertActivityLog: vi.fn(),
    insertCreditUsage: vi.fn(),
    logActivityWithCredits: vi.fn(),
    sumCreditUsage: vi.fn(),
    checkCreditAllowance: vi.fn()
}));

vi.mock("@fern-platform/entitlements", () => ({
    createEntitlementsChecker: () => ({
        check: vi.fn()
    })
}));

import * as activityLog from "@fern-platform/activity-log";
import { err, ok } from "neverthrow";

import handleInsertActivity from "../activity/handler";
import handleLogActivityWithCredits from "../activity-with-credits/handler";
import handleInsertCredits from "../credits/handler";
import handleCreditsCheck from "../credits-check/handler";
import handleSumCreditUsage from "../credits-sum/handler";

const mockInsertActivityLog = activityLog.insertActivityLog as Mock;
const mockInsertCreditUsage = activityLog.insertCreditUsage as Mock;
const mockLogActivityWithCredits = activityLog.logActivityWithCredits as Mock;
const mockSumCreditUsage = activityLog.sumCreditUsage as Mock;

const fakeActivityLog = {
    id: "event-123",
    org_id: "org-1",
    site: "docs.example.com",
    type: "ask_fern" as const,
    metadata: { question: "How?", response_tokens: 100 },
    expires_at: null,
    created_at: "2026-03-09T00:00:00Z"
};

const fakeCreditUsage = {
    id: "credit-123",
    org_id: "org-1",
    site: "docs.example.com",
    type: "ask_fern" as const,
    credits_used: 100,
    event_id: "event-123",
    created_at: "2026-03-09T00:00:00Z"
};

describe("handleInsertActivity", () => {
    beforeEach(() => vi.clearAllMocks());

    it("calls insertActivityLog and returns the result", async () => {
        mockInsertActivityLog.mockResolvedValue(ok(fakeActivityLog));

        const result = await handleInsertActivity({
            org_id: "org-1",
            site: "docs.example.com",
            entry: { type: "ask_fern", metadata: { question: "How?", response_tokens: 100 } }
        });

        expect(result).toEqual(fakeActivityLog);
        expect(mockInsertActivityLog).toHaveBeenCalledWith(
            "org-1",
            "docs.example.com",
            { type: "ask_fern", metadata: { question: "How?", response_tokens: 100 } },
            { ttl: undefined }
        );
    });

    it("throws on error result", async () => {
        mockInsertActivityLog.mockResolvedValue(
            err({ source: "activity-log", code: "INSERT_FAILED", message: "db error" })
        );

        await expect(
            handleInsertActivity({
                org_id: "org-1",
                site: "docs.example.com",
                entry: { type: "ask_fern", metadata: { question: "How?", response_tokens: 100 } }
            })
        ).rejects.toThrow("db error");
    });
});

describe("handleInsertCredits", () => {
    beforeEach(() => vi.clearAllMocks());

    it("calls insertCreditUsage and returns the result", async () => {
        mockInsertCreditUsage.mockResolvedValue(ok(fakeCreditUsage));

        const result = await handleInsertCredits({
            org_id: "org-1",
            site: "docs.example.com",
            type: "ask_fern",
            credits_used: 100,
            event_id: "event-123"
        });

        expect(result).toEqual(fakeCreditUsage);
    });
});

describe("handleLogActivityWithCredits", () => {
    beforeEach(() => vi.clearAllMocks());

    it("calls logActivityWithCredits and returns event + credit", async () => {
        mockLogActivityWithCredits.mockResolvedValue(ok({ event: fakeActivityLog, credit: fakeCreditUsage }));

        const result = await handleLogActivityWithCredits({
            org_id: "org-1",
            site: "docs.example.com",
            entry: { type: "ask_fern", metadata: { question: "How?", response_tokens: 100 } }
        });

        expect(result.event.id).toBe("event-123");
        expect(result.credit.credits_used).toBe(100);
    });
});

describe("handleSumCreditUsage", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns total from sumCreditUsage", async () => {
        mockSumCreditUsage.mockResolvedValue(ok(250));

        const result = await handleSumCreditUsage({
            org_id: "org-1",
            since: "2026-03-01T00:00:00Z",
            until: "2026-03-31T23:59:59Z"
        });

        expect(result).toEqual({ total: 250 });
    });

    it("passes optional site and type filters", async () => {
        mockSumCreditUsage.mockResolvedValue(ok(100));

        await handleSumCreditUsage({
            org_id: "org-1",
            since: "2026-03-01T00:00:00Z",
            until: "2026-03-31T23:59:59Z",
            site: "docs.example.com",
            type: "ask_fern"
        });

        expect(mockSumCreditUsage).toHaveBeenCalledWith("org-1", "2026-03-01T00:00:00Z", "2026-03-31T23:59:59Z", {
            site: "docs.example.com",
            type: "ask_fern"
        });
    });
});

const mockCheckCreditAllowance = activityLog.checkCreditAllowance as unknown as Mock;

describe("handleCreditsCheck", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns allowed=true with usage and limit", async () => {
        mockCheckCreditAllowance.mockResolvedValue(ok({ allowed: true, used: 250, limit: 1000 }));

        const result = await handleCreditsCheck({ org_id: "org-1" });
        expect(result).toEqual({ allowed: true, used: 250, limit: 1000 });
    });

    it("returns allowed=false when limit reached", async () => {
        mockCheckCreditAllowance.mockResolvedValue(ok({ allowed: false, used: 1000, limit: 1000 }));

        const result = await handleCreditsCheck({ org_id: "org-1" });
        expect(result).toEqual({ allowed: false, used: 1000, limit: 1000 });
    });

    it("throws when check fails", async () => {
        mockCheckCreditAllowance.mockResolvedValue(
            err({ source: "activity-log", code: "QUERY_FAILED", message: "entitlements down" })
        );

        await expect(handleCreditsCheck({ org_id: "org-1" })).rejects.toThrow("entitlements down");
    });
});
