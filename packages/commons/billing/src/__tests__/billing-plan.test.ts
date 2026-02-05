import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the supabase module before importing anything else
vi.mock("@fern-platform/supabase", () => ({
    getClient: vi.fn()
}));

import { getClient } from "@fern-platform/supabase";
import { getBillingPlan } from "../queries/billing-plan";

const mockGetClient = vi.mocked(getClient);

describe("getBillingPlan", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns null when no subscription exists", async () => {
        const mockClient = {
            from: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
        };
        mockGetClient.mockReturnValue(mockClient as any);

        const result = await getBillingPlan("org_123");

        expect(result.isOk()).toBe(true);
        expect(result._unsafeUnwrap()).toBeNull();
    });

    it("returns null when subscription exists but no products", async () => {
        const mockSubscription = {
            id: "sub_1",
            org_id: "org_123",
            stripe_subscription_id: "sub_stripe_1",
            status: "active",
            current_period_end: "2026-03-01T00:00:00Z"
        };

        const mockClient = {
            from: vi.fn((table: string) => {
                if (table === "org_subscription") {
                    return {
                        select: vi.fn().mockReturnThis(),
                        eq: vi.fn().mockReturnThis(),
                        in: vi.fn().mockReturnThis(),
                        order: vi.fn().mockReturnThis(),
                        limit: vi.fn().mockReturnThis(),
                        maybeSingle: vi.fn().mockResolvedValue({ data: mockSubscription, error: null })
                    };
                }
                if (table === "org_active_products") {
                    return {
                        select: vi.fn().mockReturnThis(),
                        eq: vi.fn().mockResolvedValue({ data: [], error: null })
                    };
                }
                return {};
            })
        };
        mockGetClient.mockReturnValue(mockClient as any);

        const result = await getBillingPlan("org_123");

        expect(result.isOk()).toBe(true);
        expect(result._unsafeUnwrap()).toBeNull();
    });

    it("returns billing plan with correct tier derivation", async () => {
        const mockSubscription = {
            id: "sub_1",
            org_id: "org_123",
            stripe_subscription_id: "sub_stripe_1",
            status: "active",
            current_period_end: "2026-03-01T00:00:00Z"
        };

        const mockProducts = [
            {
                org_id: "org_123",
                sku: "plan_free",
                kind: "plan",
                tier: "free",
                subscription_id: "sub_1",
                status: "active",
                billing_product_id: "prod_1"
            },
            {
                org_id: "org_123",
                sku: "addon_pro",
                kind: "addon",
                tier: "paid",
                subscription_id: "sub_1",
                status: "active",
                billing_product_id: "prod_2"
            }
        ];

        const mockClient = {
            from: vi.fn((table: string) => {
                if (table === "org_subscription") {
                    return {
                        select: vi.fn().mockReturnThis(),
                        eq: vi.fn().mockReturnThis(),
                        in: vi.fn().mockReturnThis(),
                        order: vi.fn().mockReturnThis(),
                        limit: vi.fn().mockReturnThis(),
                        maybeSingle: vi.fn().mockResolvedValue({ data: mockSubscription, error: null })
                    };
                }
                if (table === "org_active_products") {
                    return {
                        select: vi.fn().mockReturnThis(),
                        eq: vi.fn().mockResolvedValue({ data: mockProducts, error: null })
                    };
                }
                return {};
            })
        };
        mockGetClient.mockReturnValue(mockClient as any);

        const result = await getBillingPlan("org_123");

        expect(result.isOk()).toBe(true);
        const plan = result._unsafeUnwrap();
        expect(plan).not.toBeNull();
        expect(plan!.tier).toBe("paid"); // highest tier from products
        expect(plan!.status).toBe("active");
        expect(plan!.products).toHaveLength(2);
        expect(plan!.subscription.stripeSubscriptionId).toBe("sub_stripe_1");
    });

    it("derives enterprise as highest tier", async () => {
        const mockSubscription = {
            id: "sub_1",
            org_id: "org_123",
            stripe_subscription_id: "sub_stripe_1",
            status: "trialing",
            current_period_end: "2026-03-01T00:00:00Z"
        };

        const mockProducts = [
            {
                org_id: "org_123",
                sku: "plan_enterprise",
                kind: "plan",
                tier: "enterprise",
                subscription_id: "sub_1",
                status: "trialing",
                billing_product_id: "prod_1"
            },
            {
                org_id: "org_123",
                sku: "addon_paid",
                kind: "addon",
                tier: "paid",
                subscription_id: "sub_1",
                status: "trialing",
                billing_product_id: "prod_2"
            }
        ];

        const mockClient = {
            from: vi.fn((table: string) => {
                if (table === "org_subscription") {
                    return {
                        select: vi.fn().mockReturnThis(),
                        eq: vi.fn().mockReturnThis(),
                        in: vi.fn().mockReturnThis(),
                        order: vi.fn().mockReturnThis(),
                        limit: vi.fn().mockReturnThis(),
                        maybeSingle: vi.fn().mockResolvedValue({ data: mockSubscription, error: null })
                    };
                }
                if (table === "org_active_products") {
                    return {
                        select: vi.fn().mockReturnThis(),
                        eq: vi.fn().mockResolvedValue({ data: mockProducts, error: null })
                    };
                }
                return {};
            })
        };
        mockGetClient.mockReturnValue(mockClient as any);

        const result = await getBillingPlan("org_123");

        expect(result.isOk()).toBe(true);
        const plan = result._unsafeUnwrap();
        expect(plan!.tier).toBe("enterprise");
    });
});
