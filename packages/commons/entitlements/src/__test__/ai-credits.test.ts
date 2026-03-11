import { err, ok } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFrom = vi.fn();

vi.mock("@fern-platform/supabase", () => ({
    getClient: () => ({ from: mockFrom })
}));

vi.mock("@fern-platform/billing", () => ({
    getBillingPeriod: vi.fn()
}));

import { getBillingPeriod } from "@fern-platform/billing";
import { getAiCreditsUsage } from "../usage/ai-credits";

const mockGetBillingPeriod = vi.mocked(getBillingPeriod);

function mockCreditsQuery(credits: Array<{ credits_used: number }> | null) {
    mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
                gte: vi.fn().mockReturnValue({
                    lte: vi.fn().mockResolvedValue({
                        data: credits,
                        error: null
                    })
                })
            })
        })
    });
}

describe("getAiCreditsUsage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("sums credit usage for the billing period", async () => {
        mockGetBillingPeriod.mockResolvedValue(ok({ since: "2026-03-01T00:00:00Z", until: "2026-04-01T00:00:00Z" }));
        mockCreditsQuery([{ credits_used: 100 }, { credits_used: 150 }]);

        const usage = await getAiCreditsUsage("org-1");
        expect(usage).toBe(250);
        expect(mockGetBillingPeriod).toHaveBeenCalledWith("org-1");
    });

    it("returns 0 when getBillingPeriod fails", async () => {
        mockGetBillingPeriod.mockResolvedValue(
            err({ source: "billing" as const, code: "QUERY_FAILED" as const, message: "db down" })
        );

        const usage = await getAiCreditsUsage("org-1");
        expect(usage).toBe(0);
    });

    it("returns 0 when no credits exist in period", async () => {
        mockGetBillingPeriod.mockResolvedValue(ok({ since: "2026-03-01T00:00:00Z", until: "2026-04-01T00:00:00Z" }));
        mockCreditsQuery([]);

        const usage = await getAiCreditsUsage("org-1");
        expect(usage).toBe(0);
    });

    it("returns 0 when credits query returns null", async () => {
        mockGetBillingPeriod.mockResolvedValue(ok({ since: "2026-03-01T00:00:00Z", until: "2026-04-01T00:00:00Z" }));
        mockCreditsQuery(null);

        const usage = await getAiCreditsUsage("org-1");
        expect(usage).toBe(0);
    });
});
