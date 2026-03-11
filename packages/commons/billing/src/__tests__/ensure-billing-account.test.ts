import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFrom = vi.fn();
const _mockMaybeSingle = vi.fn();
const _mockSelect = vi.fn();
const _mockSingle = vi.fn();
const _mockUpsert = vi.fn();
const mockStripeCustomersCreate = vi.fn();

vi.mock("@fern-platform/supabase", () => ({
    getClient: () => ({ from: mockFrom })
}));

vi.mock("../stripe/client", () => ({
    getStripeClient: () => ({
        customers: {
            create: mockStripeCustomersCreate
        }
    })
}));

import { ensureBillingAccount } from "../queries/ensure-billing-account";

const fakeBillingAccount = {
    org_id: "org-1",
    stripe_customer_id: "cus_existing",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z"
};

describe("ensureBillingAccount", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns existing billing account if one exists", async () => {
        mockFrom.mockReturnValue({
            select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: fakeBillingAccount, error: null })
                })
            })
        });

        const result = await ensureBillingAccount("org-1");
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.stripe_customer_id).toBe("cus_existing");
        }
        expect(mockStripeCustomersCreate).not.toHaveBeenCalled();
    });

    it("creates Stripe customer and billing account when none exists", async () => {
        let callCount = 0;
        mockFrom.mockImplementation((table: string) => {
            if (table === "org_billing_account") {
                callCount++;
                if (callCount === 1) {
                    // First call: getOrgBillingAccount returns null
                    return {
                        select: vi.fn().mockReturnValue({
                            eq: vi.fn().mockReturnValue({
                                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
                            })
                        })
                    };
                }
                // Second call: upsert
                return {
                    upsert: vi.fn().mockReturnValue({
                        select: vi.fn().mockReturnValue({
                            single: vi.fn().mockResolvedValue({
                                data: { ...fakeBillingAccount, stripe_customer_id: "cus_new" },
                                error: null
                            })
                        })
                    })
                };
            }
            return {};
        });

        mockStripeCustomersCreate.mockResolvedValue({ id: "cus_new" });

        const result = await ensureBillingAccount("org-1", { orgName: "My Org" });
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.stripe_customer_id).toBe("cus_new");
        }
        expect(mockStripeCustomersCreate).toHaveBeenCalledWith({
            name: "My Org",
            metadata: { org_id: "org-1" }
        });
    });

    it("uses orgId as name when orgName not provided", async () => {
        mockFrom.mockImplementation(() => ({
            select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
                })
            }),
            upsert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                        data: { ...fakeBillingAccount, stripe_customer_id: "cus_new" },
                        error: null
                    })
                })
            })
        }));

        mockStripeCustomersCreate.mockResolvedValue({ id: "cus_new" });

        await ensureBillingAccount("org-1");
        expect(mockStripeCustomersCreate).toHaveBeenCalledWith({
            name: "org-1",
            metadata: { org_id: "org-1" }
        });
    });

    it("returns error when Stripe customer creation fails", async () => {
        mockFrom.mockReturnValue({
            select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
                })
            })
        });

        mockStripeCustomersCreate.mockRejectedValue(new Error("Stripe down"));

        const result = await ensureBillingAccount("org-1");
        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
            expect(result.error.code).toBe("STRIPE_ERROR");
            expect(result.error.message).toContain("Stripe down");
        }
    });
});
