import { err, ok } from "neverthrow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mockSubscriptionsList = vi.fn();
const mockPaymentMethodsList = vi.fn();
const mockGetCurrentSession = vi.fn();

vi.mock("next/cache", () => ({
    cacheTag: vi.fn(),
    cacheLife: vi.fn()
}));

vi.mock("@fern-platform/billing", () => ({
    getOrgBillingAccount: vi.fn(),
    getPriceIds: () => ({ PRO_MONTHLY: "price_team_monthly", PRO_YEARLY: "price_team_yearly" }),
    PRO_PLAN_CURRENT_SKU: "pro_plan",
    LEGACY_PLAN_SKU: "legacy_plan",
    ADDITIONAL_SEATS_SKU: "additional_seats"
}));

vi.mock("@fern-platform/entitlements", () => ({
    createEntitlementsChecker: () => ({
        check: vi.fn().mockResolvedValue({
            entitled: true,
            type: "metered",
            allowance: 1000,
            used: 0,
            remaining: 1000,
            overagePolicy: "hard_cap"
        })
    })
}));

vi.mock("@/app/services/auth0/management", () => ({
    getOrgIdFromName: vi.fn().mockResolvedValue("org_1")
}));

vi.mock("@/app/services/auth0/getCurrentSession", () => ({
    getCurrentSession: (...args: unknown[]) => mockGetCurrentSession(...args)
}));

vi.mock("@/app/services/stripe/client", () => ({
    getStripeClient: () => ({
        getStripeInstance: () => ({
            subscriptions: { list: (...args: unknown[]) => mockSubscriptionsList(...args) },
            paymentMethods: { list: (...args: unknown[]) => mockPaymentMethodsList(...args) }
        })
    })
}));

import { getOrgBillingAccount } from "@fern-platform/billing";

import { getBillingAlertCacheTag, HeaderBillingAlert } from "../HeaderBillingAlert";

const mockedGetOrgBillingAccount = vi.mocked(getOrgBillingAccount);

function makeSubscription(overrides: Record<string, unknown> = {}) {
    return {
        id: `sub_${Math.random().toString(36).slice(2)}`,
        status: "active",
        trial_end: null,
        items: { data: [{ price: { id: "price_other" } }] },
        ...overrides
    };
}

function makeTeamSubscription(overrides: Record<string, unknown> = {}) {
    return makeSubscription({
        items: { data: [{ price: { id: "price_team_monthly" } }] },
        ...overrides
    });
}

function trialingSubscription(daysRemaining: number) {
    const trialEnd = Math.floor((Date.now() + daysRemaining * 24 * 60 * 60 * 1000) / 1000);
    return makeSubscription({ status: "trialing", trial_end: trialEnd });
}

describe("getBillingAlertCacheTag", () => {
    it("returns tag with orgId", () => {
        expect(getBillingAlertCacheTag("org_123")).toBe("billing-alert-org_123");
    });
});

describe("HeaderBillingAlert", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentSession.mockResolvedValue({ user: { email: "test@example.com" } });
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("returns null when billing account fetch fails", async () => {
        mockedGetOrgBillingAccount.mockResolvedValue(err({ source: "billing", message: "not found" }) as any);

        const result = await HeaderBillingAlert({ orgName: "test-org" as any });
        expect(result).toBeNull();
    });

    it("returns null when no stripe_customer_id", async () => {
        mockedGetOrgBillingAccount.mockResolvedValue(ok({ stripe_customer_id: null }) as any);

        const result = await HeaderBillingAlert({ orgName: "test-org" as any });
        expect(result).toBeNull();
    });

    it("renders payment_failed alert for past_due non-team subscription", async () => {
        mockedGetOrgBillingAccount.mockResolvedValue(ok({ stripe_customer_id: "cus_123" }) as any);
        mockSubscriptionsList.mockResolvedValue({
            data: [makeSubscription({ status: "past_due" })]
        });

        const result = await HeaderBillingAlert({ orgName: "test-org" as any });

        expect(result).not.toBeNull();
        const props = (result as any).props;
        expect(props.variant).toBe("danger");
        expect(props.message).toBe("Recent payment has failed");
        expect(props.actionLabel).toBe("Update payment");
        expect(props.actionType).toBe("portal");
    });

    it("renders trial_ending alert when trial ends within 7 days and no payment method", async () => {
        mockedGetOrgBillingAccount.mockResolvedValue(ok({ stripe_customer_id: "cus_123" }) as any);
        mockSubscriptionsList.mockResolvedValue({
            data: [trialingSubscription(3)]
        });
        mockPaymentMethodsList.mockResolvedValue({ data: [] });

        const result = await HeaderBillingAlert({ orgName: "test-org" as any });

        expect(result).not.toBeNull();
        const props = (result as any).props;
        expect(props.variant).toBe("warning");
        expect(props.message).toContain("Team trial ends in");
        expect(props.message).toContain("3 days");
        expect(props.actionLabel).toBe("Add payment");
        expect(props.actionType).toBe("checkout");
        expect(props.userEmail).toBe("test@example.com");
    });

    it("renders singular 'day' when 1 day remaining", async () => {
        mockedGetOrgBillingAccount.mockResolvedValue(ok({ stripe_customer_id: "cus_123" }) as any);
        mockSubscriptionsList.mockResolvedValue({
            data: [trialingSubscription(1)]
        });
        mockPaymentMethodsList.mockResolvedValue({ data: [] });

        const result = await HeaderBillingAlert({ orgName: "test-org" as any });

        expect(result).not.toBeNull();
        const props = (result as any).props;
        expect(props.message).toContain("1 day");
        expect(props.message).not.toContain("1 days");
    });

    it("suppresses trial_ending alert when payment method exists", async () => {
        mockedGetOrgBillingAccount.mockResolvedValue(ok({ stripe_customer_id: "cus_123" }) as any);
        mockSubscriptionsList.mockResolvedValue({
            data: [trialingSubscription(3)]
        });
        mockPaymentMethodsList.mockResolvedValue({
            data: [{ id: "pm_123", type: "card" }]
        });

        const result = await HeaderBillingAlert({ orgName: "test-org" as any });
        expect(result).toBeNull();
    });

    it("does not show trial_ending alert when more than 7 days remain", async () => {
        mockedGetOrgBillingAccount.mockResolvedValue(ok({ stripe_customer_id: "cus_123" }) as any);
        mockSubscriptionsList.mockResolvedValue({
            data: [trialingSubscription(10)]
        });

        const result = await HeaderBillingAlert({ orgName: "test-org" as any });
        expect(result).toBeNull();
    });

    it("renders trial_ended when past_due team subscription and no other active subs", async () => {
        mockedGetOrgBillingAccount.mockResolvedValue(ok({ stripe_customer_id: "cus_123" }) as any);
        mockSubscriptionsList.mockResolvedValue({
            data: [makeTeamSubscription({ status: "past_due" })]
        });

        const result = await HeaderBillingAlert({ orgName: "test-org" as any });

        expect(result).not.toBeNull();
        const props = (result as any).props;
        expect(props.variant).toBe("danger");
        expect(props.message).toBe("Team trial ended");
        expect(props.actionLabel).toBe("Add payment");
        expect(props.actionType).toBe("checkout");
        expect(props.userEmail).toBe("test@example.com");
    });

    it("returns null when only canceled subscriptions (no past_due)", async () => {
        mockedGetOrgBillingAccount.mockResolvedValue(ok({ stripe_customer_id: "cus_123" }) as any);
        mockSubscriptionsList.mockResolvedValue({
            data: [makeSubscription({ status: "canceled" })]
        });

        const result = await HeaderBillingAlert({ orgName: "test-org" as any });
        expect(result).toBeNull();
    });

    it("renders payment_failed when past_due team sub but other active sub exists", async () => {
        mockedGetOrgBillingAccount.mockResolvedValue(ok({ stripe_customer_id: "cus_123" }) as any);
        mockSubscriptionsList.mockResolvedValue({
            data: [makeTeamSubscription({ status: "past_due" }), makeSubscription({ status: "active" })]
        });

        const result = await HeaderBillingAlert({ orgName: "test-org" as any });

        expect(result).not.toBeNull();
        const props = (result as any).props;
        expect(props.message).toBe("Recent payment has failed");
    });

    it("returns null when subscriptions are active", async () => {
        mockedGetOrgBillingAccount.mockResolvedValue(ok({ stripe_customer_id: "cus_123" }) as any);
        mockSubscriptionsList.mockResolvedValue({
            data: [makeSubscription({ status: "active" })]
        });

        const result = await HeaderBillingAlert({ orgName: "test-org" as any });
        expect(result).toBeNull();
    });

    it("returns null and logs error when stripe call throws", async () => {
        mockedGetOrgBillingAccount.mockResolvedValue(ok({ stripe_customer_id: "cus_123" }) as any);
        mockSubscriptionsList.mockRejectedValue(new Error("stripe down"));

        const result = await HeaderBillingAlert({ orgName: "test-org" as any });

        expect(result).toBeNull();
        expect(console.error).toHaveBeenCalledWith(
            "[HeaderBillingAlert] Failed to fetch subscription status:",
            expect.any(Error)
        );
    });

    it("payment_failed when past_due team sub but trialing sub also exists", async () => {
        mockedGetOrgBillingAccount.mockResolvedValue(ok({ stripe_customer_id: "cus_123" }) as any);
        mockSubscriptionsList.mockResolvedValue({
            data: [makeTeamSubscription({ status: "past_due" }), trialingSubscription(3)]
        });

        const result = await HeaderBillingAlert({ orgName: "test-org" as any });

        const props = (result as any).props;
        expect(props.message).toBe("Recent payment has failed");
        expect(props.actionType).toBe("portal");
    });

    it("payment_failed for non-team past_due even with trialing sub", async () => {
        mockedGetOrgBillingAccount.mockResolvedValue(ok({ stripe_customer_id: "cus_123" }) as any);
        mockSubscriptionsList.mockResolvedValue({
            data: [makeSubscription({ status: "past_due" }), trialingSubscription(3)]
        });

        const result = await HeaderBillingAlert({ orgName: "test-org" as any });

        const props = (result as any).props;
        expect(props.message).toBe("Recent payment has failed");
        expect(props.actionType).toBe("portal");
    });
});
