import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the supabase module before importing anything else
vi.mock("@fern-platform/supabase", () => ({
    getClient: vi.fn()
}));

import { getClient } from "@fern-platform/supabase";
import { getBillingPlan } from "../queries/billing-plan";

const mockGetClient = vi.mocked(getClient);

function mockSupabaseWithProducts(products: unknown[], hasSubscription = false, overrides: unknown[] = []) {
    const mockClient = {
        from: vi.fn((table: string) => {
            if (table === "org_active_products") {
                const builder = {
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockReturnThis(),
                    in: vi.fn().mockResolvedValue({ data: products, error: null })
                };
                return builder;
            }
            if (table === "org_billing_override") {
                return {
                    select: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            is: vi.fn().mockReturnValue({
                                lte: vi.fn().mockReturnValue({
                                    or: vi.fn().mockResolvedValue({ data: overrides, error: null })
                                })
                            })
                        })
                    })
                };
            }
            if (table === "org_subscription") {
                return {
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockReturnThis(),
                    limit: vi.fn().mockResolvedValue({ count: hasSubscription ? 1 : 0, error: null })
                };
            }
            if (table === "billing_product") {
                return {
                    select: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            single: vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST116" } })
                        })
                    })
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

    it("returns null when no active products or overrides exist", async () => {
        mockSupabaseWithProducts([]);

        const result = await getBillingPlan("org_123");

        expect(result.isOk()).toBe(true);
        expect(result._unsafeUnwrap()).toBeNull();
    });

    it("returns billing plan with source: stripe", async () => {
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
        expect(plan!.tier).toBe("paid");
        expect(plan!.products).toHaveLength(2);
        expect(plan!.products[0]!.source).toBe("stripe");
        expect(plan!.products[1]!.source).toBe("stripe");
        expect(plan!.hasOverrides).toBe(false);
    });

    it("merges overrides with stripe products", async () => {
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
                }
            ],
            true,
            [
                {
                    id: "ovr_1",
                    org_id: "org_123",
                    sku: "legacy:custom-enterprise",
                    added_by: "admin@fern.com",
                    start_date: "2026-03-01T00:00:00Z",
                    end_date: null,
                    notes: "Enterprise trial",
                    created_at: "2026-03-01T00:00:00Z",
                    revoked_at: null
                }
            ]
        );

        const result = await getBillingPlan("org_123");

        expect(result.isOk()).toBe(true);
        const plan = result._unsafeUnwrap();
        expect(plan!.tier).toBe("enterprise"); // override bumps tier
        expect(plan!.products).toHaveLength(2);
        expect(plan!.products[0]!.source).toBe("stripe");
        expect(plan!.products[1]!.source).toBe("override");
        expect(plan!.products[1]!.overrideId).toBe("ovr_1");
        expect(plan!.hasOverrides).toBe(true);
    });

    it("returns plan from override only (no stripe products)", async () => {
        mockSupabaseWithProducts(
            [],
            false,
            [
                {
                    id: "ovr_1",
                    org_id: "org_123",
                    sku: "2025-02-05:docs-team",
                    added_by: "admin@fern.com",
                    start_date: "2026-03-01T00:00:00Z",
                    end_date: null,
                    notes: null,
                    created_at: "2026-03-01T00:00:00Z",
                    revoked_at: null
                }
            ]
        );

        const result = await getBillingPlan("org_123");

        expect(result.isOk()).toBe(true);
        const plan = result._unsafeUnwrap();
        expect(plan).not.toBeNull();
        expect(plan!.products).toHaveLength(1);
        expect(plan!.products[0]!.source).toBe("override");
        expect(plan!.hasOverrides).toBe(true);
        expect(plan!.subscription).toBeNull();
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
                }
            ],
            true
        );

        const result = await getBillingPlan("org_123");

        expect(result.isOk()).toBe(true);
        const plan = result._unsafeUnwrap();
        expect(plan!.tier).toBe("enterprise");
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
