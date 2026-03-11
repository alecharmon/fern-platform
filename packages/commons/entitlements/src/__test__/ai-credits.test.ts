import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFrom = vi.fn();
const _mockSelect = vi.fn();
const _mockEq = vi.fn();
const _mockGte = vi.fn();
const _mockLte = vi.fn();
const _mockMaybeSingle = vi.fn();

vi.mock("@fern-platform/supabase", () => ({
    getClient: () => ({ from: mockFrom })
}));

import { getAiCreditsUsage } from "../usage/ai-credits";

describe("getAiCreditsUsage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("sums credit usage for the current billing period", async () => {
        // Mock subscription query
        mockFrom.mockImplementation((table: string) => {
            if (table === "org_subscription") {
                return {
                    select: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            in: vi.fn().mockReturnValue({
                                order: vi.fn().mockReturnValue({
                                    limit: vi.fn().mockReturnValue({
                                        maybeSingle: vi.fn().mockResolvedValue({
                                            data: {
                                                current_period_start: "2026-03-01T00:00:00Z",
                                                current_period_end: "2026-04-01T00:00:00Z"
                                            },
                                            error: null
                                        })
                                    })
                                })
                            })
                        })
                    })
                };
            }
            if (table === "org_fern_credit_usage") {
                return {
                    select: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            gte: vi.fn().mockReturnValue({
                                lte: vi.fn().mockResolvedValue({
                                    data: [{ credits_used: 100 }, { credits_used: 150 }],
                                    error: null
                                })
                            })
                        })
                    })
                };
            }
            return {};
        });

        const usage = await getAiCreditsUsage("org-1");
        expect(usage).toBe(250);
    });

    it("returns 0 when no active subscription", async () => {
        mockFrom.mockReturnValue({
            select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                    in: vi.fn().mockReturnValue({
                        order: vi.fn().mockReturnValue({
                            limit: vi.fn().mockReturnValue({
                                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
                            })
                        })
                    })
                })
            })
        });

        const usage = await getAiCreditsUsage("org-1");
        expect(usage).toBe(0);
    });

    it("returns 0 when subscription has no period dates", async () => {
        mockFrom.mockReturnValue({
            select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                    in: vi.fn().mockReturnValue({
                        order: vi.fn().mockReturnValue({
                            limit: vi.fn().mockReturnValue({
                                maybeSingle: vi.fn().mockResolvedValue({
                                    data: { current_period_start: null, current_period_end: null },
                                    error: null
                                })
                            })
                        })
                    })
                })
            })
        });

        const usage = await getAiCreditsUsage("org-1");
        expect(usage).toBe(0);
    });
});
