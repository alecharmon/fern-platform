import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mockGetOrgBillingAccount = vi.fn();
const mockGetActiveSubscription = vi.fn();
vi.mock("@fern-platform/billing", () => ({
    ADDON_EXTRA_SEATS_PRICE_ID: "price_addon_seats",
    MAX_ADDON_SEATS: 50,
    getOrgBillingAccount: (...args: unknown[]) => mockGetOrgBillingAccount(...args),
    getActiveSubscription: (...args: unknown[]) => mockGetActiveSubscription(...args)
}));

const mockGetCurrentSession = vi.fn();
vi.mock("@/app/services/auth0/getCurrentSession", () => ({
    getCurrentSessionOrThrow: (...args: unknown[]) => mockGetCurrentSession(...args)
}));

vi.mock("@/app/services/dal/organization", () => ({
    assertUserHasOrganizationAccess: vi.fn()
}));

const mockCreatePreview = vi.fn();
const mockRetrieveSubscription = vi.fn();
vi.mock("@/app/services/stripe/client", () => ({
    getStripeClient: () => ({
        getStripeInstance: () => ({
            subscriptions: { retrieve: (...args: unknown[]) => mockRetrieveSubscription(...args) },
            invoices: { createPreview: (...args: unknown[]) => mockCreatePreview(...args) }
        })
    })
}));

import { err, ok } from "neverthrow";
import { getAddonSeatsPricePreview } from "../getAddonSeatsPricePreview";

const BASE_PARAMS = { orgId: "org_1", orgName: "test-org" as any, seatsToAdd: 2 };

describe("getAddonSeatsPricePreview", () => {
    it("returns error when seatsToAdd is 0", async () => {
        const result = await getAddonSeatsPricePreview({ ...BASE_PARAMS, seatsToAdd: 0 });
        expect(result).toEqual({ error: "Must add at least 1 seat" });
    });

    it("returns error when seatsToAdd exceeds MAX_ADDON_SEATS", async () => {
        const result = await getAddonSeatsPricePreview({ ...BASE_PARAMS, seatsToAdd: 51 });
        expect(result).toEqual({ error: expect.stringContaining("Cannot exceed") });
    });

    it("returns error when billing account lookup fails", async () => {
        mockGetCurrentSession.mockResolvedValue({ accessToken: "tok" });
        mockGetOrgBillingAccount.mockResolvedValue(err({ message: "db error" }));
        const result = await getAddonSeatsPricePreview(BASE_PARAMS);
        expect(result).toEqual({ error: "Failed to look up billing account" });
    });

    it("returns error when no active subscription found", async () => {
        mockGetCurrentSession.mockResolvedValue({ accessToken: "tok" });
        mockGetOrgBillingAccount.mockResolvedValue(ok({ stripe_customer_id: "cus_1" }));
        mockGetActiveSubscription.mockResolvedValue(ok(null));
        const result = await getAddonSeatsPricePreview(BASE_PARAMS);
        expect(result).toEqual({ error: "No active subscription found" });
    });

    it("returns preview with no tax when Stripe Tax not configured", async () => {
        mockGetCurrentSession.mockResolvedValue({ accessToken: "tok" });
        mockGetOrgBillingAccount.mockResolvedValue(ok({ stripe_customer_id: "cus_1" }));
        mockGetActiveSubscription.mockResolvedValue(ok({ stripe_subscription_id: "sub_1" }));
        mockRetrieveSubscription.mockResolvedValue({ items: { data: [] } });
        mockCreatePreview.mockResolvedValue({
            total: 4000,
            subtotal: 4000,
            total_excluding_tax: 4000,
            currency: "usd",
            lines: {
                data: [
                    {
                        amount: 4000,
                        quantity: 2,
                        proration: false,
                        parent: null,
                        pricing: { price_details: { price: "price_addon_seats" } }
                    }
                ]
            }
        });
        const result = await getAddonSeatsPricePreview(BASE_PARAMS);
        expect(result).toMatchObject({
            preview: {
                dueNow: 4000,
                dueNowTax: 0,
                subtotal: 4000,
                currency: "usd"
            }
        });
    });
});
