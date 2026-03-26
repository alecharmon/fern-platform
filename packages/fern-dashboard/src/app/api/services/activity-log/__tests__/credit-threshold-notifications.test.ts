import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

// --- Module mocks (must be before imports) ---

vi.mock("@fern-platform/activity-log", () => ({
    logActivityWithCredits: vi.fn(),
    checkCreditAllowance: vi.fn()
}));

vi.mock("@fern-platform/entitlements", () => ({
    createEntitlementsChecker: vi.fn(() => ({
        check: vi.fn()
    }))
}));

vi.mock("@fern-api/docs-server/slack", () => ({
    postToSlackImmediate: vi.fn(async () => ({ success: true })),
    getBillingEntitlementsChannel: vi.fn(() => "#billing-and-entitlements-notifs-dev")
}));

vi.mock("@/app/services/auth0/types", () => ({
    Auth0OrgID: (s: string) => s
}));

vi.mock("../_utils/resolveOrgId", () => ({
    resolveToAuth0OrgId: vi.fn(async (orgId: string) => orgId)
}));

// --- Imports ---

import { postToSlackImmediate } from "@fern-api/docs-server/slack";
import * as activityLog from "@fern-platform/activity-log";
import { err, ok } from "neverthrow";

import handleLogActivityWithCredits from "../activity-with-credits/handler";

const mockLogActivityWithCredits = activityLog.logActivityWithCredits as Mock;
const mockCheckCreditAllowance = activityLog.checkCreditAllowance as unknown as Mock;
const mockPostToSlack = postToSlackImmediate as Mock;

const makeBody = () => ({
    org_id: "org-1",
    site: "docs.example.com",
    entry: { type: "ask_fern" as const, metadata: { question: "How?", response_tokens: 100 } }
});

const makeActivityResult = (creditsUsed: number) =>
    ok({
        event: {
            id: "event-123",
            org_id: "org-1",
            site: "docs.example.com",
            type: "ask_fern" as const,
            metadata: { question: "How?", response_tokens: 100 },
            expires_at: null,
            created_at: "2026-03-09T00:00:00Z"
        },
        credit: {
            id: "credit-123",
            org_id: "org-1",
            site: "docs.example.com",
            type: "ask_fern" as const,
            credits_used: creditsUsed,
            event_id: "event-123",
            created_at: "2026-03-09T00:00:00Z"
        }
    });

/**
 * Flush all pending microtasks (promise callbacks) so fire-and-forget
 * code in the handler runs before assertions.
 */
async function flushMicrotasks() {
    // Two rounds of flush to cover nested .then/.catch chains
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
}

describe("credit threshold Slack notifications", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("sends Slack notification when crossing the 80% threshold", async () => {
        // 2 credits just added, used=80 out of limit=100 → 80% crossed
        mockLogActivityWithCredits.mockResolvedValue(makeActivityResult(2));
        mockCheckCreditAllowance.mockResolvedValue(ok({ allowed: true, used: 80, limit: 100 }));

        await handleLogActivityWithCredits(makeBody());
        await flushMicrotasks();

        expect(mockPostToSlack).toHaveBeenCalledTimes(1);
        expect(mockPostToSlack).toHaveBeenCalledWith(
            "#billing-and-entitlements-notifs-dev",
            expect.stringContaining("80%"),
            "billing"
        );
        expect(mockPostToSlack).toHaveBeenCalledWith(
            "#billing-and-entitlements-notifs-dev",
            expect.stringContaining(":warning:"),
            "billing"
        );
    });

    it("sends Slack notification when crossing the 100% threshold", async () => {
        // 2 credits just added, used=100 out of limit=100 → 100% crossed
        mockLogActivityWithCredits.mockResolvedValue(makeActivityResult(2));
        mockCheckCreditAllowance.mockResolvedValue(ok({ allowed: false, used: 100, limit: 100 }));

        await handleLogActivityWithCredits(makeBody());
        await flushMicrotasks();

        expect(mockPostToSlack).toHaveBeenCalledTimes(1);
        expect(mockPostToSlack).toHaveBeenCalledWith(
            "#billing-and-entitlements-notifs-dev",
            expect.stringContaining("100%"),
            "billing"
        );
        expect(mockPostToSlack).toHaveBeenCalledWith(
            "#billing-and-entitlements-notifs-dev",
            expect.stringContaining(":rotating_light:"),
            "billing"
        );
    });

    it("sends both 80% and 100% notifications when a single event crosses both", async () => {
        // 50 credits just added, used=100 out of limit=100, previousUsed=50 → crosses both 80 and 100
        mockLogActivityWithCredits.mockResolvedValue(makeActivityResult(50));
        mockCheckCreditAllowance.mockResolvedValue(ok({ allowed: false, used: 100, limit: 100 }));

        await handleLogActivityWithCredits(makeBody());
        await flushMicrotasks();

        expect(mockPostToSlack).toHaveBeenCalledTimes(2);
        expect(mockPostToSlack).toHaveBeenCalledWith(
            "#billing-and-entitlements-notifs-dev",
            expect.stringContaining("80%"),
            "billing"
        );
        expect(mockPostToSlack).toHaveBeenCalledWith(
            "#billing-and-entitlements-notifs-dev",
            expect.stringContaining("100%"),
            "billing"
        );
    });

    it("does NOT send notification when already past 80% (no threshold crossed)", async () => {
        // 2 credits just added, used=84 out of limit=100 → previousUsed=82, both above 80%
        mockLogActivityWithCredits.mockResolvedValue(makeActivityResult(2));
        mockCheckCreditAllowance.mockResolvedValue(ok({ allowed: true, used: 84, limit: 100 }));

        await handleLogActivityWithCredits(makeBody());
        await flushMicrotasks();

        expect(mockPostToSlack).not.toHaveBeenCalled();
    });

    it("does NOT send notification when usage is below 80%", async () => {
        // 2 credits just added, used=50 out of limit=100 → 50%, well below any threshold
        mockLogActivityWithCredits.mockResolvedValue(makeActivityResult(2));
        mockCheckCreditAllowance.mockResolvedValue(ok({ allowed: true, used: 50, limit: 100 }));

        await handleLogActivityWithCredits(makeBody());
        await flushMicrotasks();

        expect(mockPostToSlack).not.toHaveBeenCalled();
    });

    it("does NOT send notification when limit is 0 (guard)", async () => {
        mockLogActivityWithCredits.mockResolvedValue(makeActivityResult(2));
        mockCheckCreditAllowance.mockResolvedValue(ok({ allowed: true, used: 2, limit: 0 }));

        await handleLogActivityWithCredits(makeBody());
        await flushMicrotasks();

        expect(mockPostToSlack).not.toHaveBeenCalled();
    });

    it("does NOT break the handler when checkCreditAllowance fails", async () => {
        mockLogActivityWithCredits.mockResolvedValue(makeActivityResult(2));
        mockCheckCreditAllowance.mockResolvedValue(
            err({ source: "activity-log", code: "QUERY_FAILED", message: "entitlements down" })
        );

        const result = await handleLogActivityWithCredits(makeBody());
        await flushMicrotasks();

        // Handler should still return the result successfully
        expect(result.event.id).toBe("event-123");
        expect(result.credit.credits_used).toBe(2);
        expect(mockPostToSlack).not.toHaveBeenCalled();
    });

    it("does NOT break the handler when Slack notification throws", async () => {
        mockLogActivityWithCredits.mockResolvedValue(makeActivityResult(2));
        mockCheckCreditAllowance.mockResolvedValue(ok({ allowed: true, used: 80, limit: 100 }));
        mockPostToSlack.mockRejectedValue(new Error("Slack API error"));

        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

        const result = await handleLogActivityWithCredits(makeBody());
        await flushMicrotasks();

        // Handler should still return the result successfully
        expect(result.event.id).toBe("event-123");
        expect(result.credit.credits_used).toBe(2);

        warnSpy.mockRestore();
    });

    it("includes org name and usage in the Slack message", async () => {
        mockLogActivityWithCredits.mockResolvedValue(makeActivityResult(2));
        mockCheckCreditAllowance.mockResolvedValue(ok({ allowed: true, used: 80, limit: 100 }));

        await handleLogActivityWithCredits(makeBody());
        await flushMicrotasks();

        expect(mockPostToSlack).toHaveBeenCalledWith(
            "#billing-and-entitlements-notifs-dev",
            ":warning: *AI credit usage at 80%* | Org: *org-1* (org-1) | Usage: *80 / 100 credits*",
            "billing"
        );
    });
});
