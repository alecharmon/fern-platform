import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the supabase module before importing anything else
vi.mock("@fern-platform/supabase", () => ({
    getClient: vi.fn()
}));

import { getClient } from "@fern-platform/supabase";
import { getBillingPlan } from "../queries/billing-plan";

const mockGetClient = vi.mocked(getClient);

function mockSupabaseWithProducts(products: unknown[], hasSubscription = false) {
    const mockClient = {
        from: vi.fn((table: string) => {
            if (table === "org_active_products") {
                // Chain: .select("*").eq("org_id", orgId).in("status", [...])
                const builder = {
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockReturnThis(),
                    in: vi.fn().mockResolvedValue({ data: products, error: null })
                };
                return builder;
            }
            if (table === "org_subscription") {
                return {
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockReturnThis(),
                    limit: vi.fn().mockResolvedValue({ count: hasSubscription ? 1 : 0, error: null })
                };
            }
            return {};
        })
    };
    mockGetClient.mockReturnValue(mockClient as any);
}

describe("getBillingPlan", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns null when no active products exist", async () => {
        mockSupabaseWithProducts([]);

        const result = await getBillingPlan("org_123");

        expect(result.isOk()).toBe(true);
        expect(result._unsafeUnwrap()).toBeNull();
    });

    it("returns billing plan with correct tier derivation", async () => {
        mockSupabaseWithProducts(
            [
                {
                    org_id: "org_123",
                    sku: "plan_free",
                    kind: "plan",
                    tier: "free",
                    subscription_id: "sub_1",
                    status: "active",
                    billing_product_id: "prod_1",
                    qty: 1
                },
                {
                    org_id: "org_123",
                    sku: "addon_pro",
                    kind: "addon",
                    tier: "paid",
                    subscription_id: "sub_1",
                    status: "active",
                    billing_product_id: "prod_2",
                    qty: 1
                }
            ],
            true
        );

        const result = await getBillingPlan("org_123");

        expect(result.isOk()).toBe(true);
        const plan = result._unsafeUnwrap();
        expect(plan).not.toBeNull();
        expect(plan!.tier).toBe("paid"); // highest tier from products
        expect(plan!.status).toBe("active");
        expect(plan!.products).toHaveLength(2);
        expect(plan!.products[0]!.qty).toBe(1);
        expect(plan!.subscription).toEqual({ id: "sub_1" });
        expect(plan!.hasSubscriptionHistory).toBe(true);
    });

    it("derives enterprise as highest tier", async () => {
        mockSupabaseWithProducts(
            [
                {
                    org_id: "org_123",
                    sku: "plan_enterprise",
                    kind: "plan",
                    tier: "enterprise",
                    subscription_id: "sub_1",
                    status: "trialing",
                    billing_product_id: "prod_1",
                    qty: 1
                },
                {
                    org_id: "org_123",
                    sku: "addon_paid",
                    kind: "addon",
                    tier: "paid",
                    subscription_id: "sub_1",
                    status: "trialing",
                    billing_product_id: "prod_2",
                    qty: 1
                }
            ],
            true
        );

        const result = await getBillingPlan("org_123");

        expect(result.isOk()).toBe(true);
        const plan = result._unsafeUnwrap();
        expect(plan!.tier).toBe("enterprise");
        expect(plan!.status).toBe("trialing");
    });

    it("returns null subscription when products have no subscription_id", async () => {
        mockSupabaseWithProducts([
            {
                org_id: "org_123",
                sku: "plan_free",
                kind: "plan",
                tier: "free",
                subscription_id: null,
                status: "active",
                billing_product_id: "prod_1",
                qty: 1
            }
        ]);

        const result = await getBillingPlan("org_123");

        expect(result.isOk()).toBe(true);
        const plan = result._unsafeUnwrap();
        expect(plan!.subscription).toBeNull();
        expect(plan!.hasSubscriptionHistory).toBe(false);
    });

    it("defaults qty to 1 when not provided by view", async () => {
        mockSupabaseWithProducts([
            {
                org_id: "org_123",
                sku: "plan_free",
                kind: "plan",
                tier: "free",
                subscription_id: "sub_1",
                status: "active",
                billing_product_id: "prod_1",
                qty: null
            }
        ]);

        const result = await getBillingPlan("org_123");

        expect(result.isOk()).toBe(true);
        const plan = result._unsafeUnwrap();
        expect(plan!.products[0]!.qty).toBe(1);
    });
});
