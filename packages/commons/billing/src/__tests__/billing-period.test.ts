import { err, ok } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../db/subscriptions", () => ({
    getActiveSubscription: vi.fn()
}));

vi.mock("./ensure-billing-account", () => ({
    ensureBillingAccount: vi.fn()
}));

// Fix: mock is relative to the source file, not test file
vi.mock("../queries/ensure-billing-account", () => ({
    ensureBillingAccount: vi.fn()
}));

import { getActiveSubscription } from "../db/subscriptions";
import { getBillingPeriod } from "../queries/billing-period";
import { ensureBillingAccount } from "../queries/ensure-billing-account";

const mockGetActiveSubscription = vi.mocked(getActiveSubscription);
const mockEnsureBillingAccount = vi.mocked(ensureBillingAccount);

describe("getBillingPeriod", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    it("returns subscription period when active subscription exists", async () => {
        mockGetActiveSubscription.mockResolvedValue(
            ok({
                id: "sub-1",
                org_id: "org-1",
                stripe_subscription_id: "stripe-sub-1",
                status: "active",
                current_period_start: "2026-03-01T00:00:00Z",
                current_period_end: "2026-04-01T00:00:00Z",
                created_at: "2026-01-01T00:00:00Z",
                updated_at: "2026-03-01T00:00:00Z"
            })
        );

        const result = await getBillingPeriod("org-1");
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            expect(result.value.since).toBe("2026-03-01T00:00:00Z");
            expect(result.value.until).toBe("2026-04-01T00:00:00Z");
        }
        expect(mockEnsureBillingAccount).not.toHaveBeenCalled();
    });

    it("falls back to last 30 days and backfills when no subscription", async () => {
        mockGetActiveSubscription.mockResolvedValue(ok(null));
        mockEnsureBillingAccount.mockResolvedValue(
            ok({ org_id: "org-1", stripe_customer_id: "cus_new", created_at: "", updated_at: "" })
        );

        const before = Date.now();
        const result = await getBillingPeriod("org-1");
        const after = Date.now();

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
            const since = new Date(result.value.since).getTime();
            const until = new Date(result.value.until).getTime();
            // since should be ~30 days ago
            expect(until - since).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);
            expect(until - since).toBeLessThanOrEqual(30 * 24 * 60 * 60 * 1000 + 1000);
            expect(until).toBeGreaterThanOrEqual(before);
            expect(until).toBeLessThanOrEqual(after + 1000);
        }
        expect(mockEnsureBillingAccount).toHaveBeenCalledWith("org-1");
    });

    it("falls back to last 30 days when subscription has no period dates", async () => {
        mockGetActiveSubscription.mockResolvedValue(
            ok({
                id: "sub-1",
                org_id: "org-1",
                stripe_subscription_id: "stripe-sub-1",
                status: "active",
                current_period_start: null,
                current_period_end: null,
                created_at: "2026-01-01T00:00:00Z",
                updated_at: "2026-03-01T00:00:00Z"
            })
        );
        mockEnsureBillingAccount.mockResolvedValue(
            ok({ org_id: "org-1", stripe_customer_id: "cus_new", created_at: "", updated_at: "" })
        );

        const result = await getBillingPeriod("org-1");
        expect(result.isOk()).toBe(true);
        expect(mockEnsureBillingAccount).toHaveBeenCalledWith("org-1");
    });

    it("returns error when getActiveSubscription fails", async () => {
        mockGetActiveSubscription.mockResolvedValue(
            err({ source: "billing" as const, code: "QUERY_FAILED" as const, message: "db down" })
        );

        const result = await getBillingPeriod("org-1");
        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
            expect(result.error.code).toBe("QUERY_FAILED");
        }
        expect(console.error).toHaveBeenCalledWith(
            expect.stringContaining("failed to get subscription for org-1"),
            expect.anything()
        );
    });

    it("logs error but still returns fallback when backfill fails", async () => {
        mockGetActiveSubscription.mockResolvedValue(ok(null));
        mockEnsureBillingAccount.mockResolvedValue(
            err({ source: "billing" as const, code: "STRIPE_ERROR" as const, message: "Stripe down" })
        );

        const result = await getBillingPeriod("org-1");
        // Should still return ok with last 30 days
        expect(result.isOk()).toBe(true);
        expect(console.error).toHaveBeenCalledWith(
            expect.stringContaining("failed to backfill billing account for org-1"),
            expect.anything()
        );
    });

    describe("subscription period edge cases", () => {
        function makeSub(start: string, end: string) {
            return ok({
                id: "sub-1",
                org_id: "org-1",
                stripe_subscription_id: "stripe-sub-1",
                status: "active" as const,
                current_period_start: start,
                current_period_end: end,
                created_at: "2026-01-01T00:00:00Z",
                updated_at: "2026-01-01T00:00:00Z"
            });
        }

        const cases = [
            {
                name: "leap day billing period (Feb 29 → Mar 29)",
                start: "2028-02-29T00:00:00Z",
                end: "2028-03-29T00:00:00Z"
            },
            {
                name: "year boundary (Dec 15 → Jan 15)",
                start: "2026-12-15T00:00:00Z",
                end: "2027-01-15T00:00:00Z"
            },
            {
                name: "short month (Jan 31 → Feb 28)",
                start: "2026-01-31T00:00:00Z",
                end: "2026-02-28T00:00:00Z"
            },
            {
                name: "DST transition (Mar 9 → Apr 9, US spring forward)",
                start: "2026-03-09T00:00:00Z",
                end: "2026-04-09T00:00:00Z"
            },
            {
                name: "single day period",
                start: "2026-06-15T00:00:00Z",
                end: "2026-06-15T23:59:59Z"
            },
            {
                name: "sub-day precision with milliseconds",
                start: "2026-07-01T12:30:45.123Z",
                end: "2026-08-01T12:30:45.123Z"
            },
            {
                name: "new year's eve period (Dec 31 → Jan 31)",
                start: "2026-12-31T00:00:00Z",
                end: "2027-01-31T00:00:00Z"
            },
            {
                name: "leap year Feb 28 → Mar 28 (non-leap year)",
                start: "2027-02-28T00:00:00Z",
                end: "2027-03-28T00:00:00Z"
            }
        ];

        it.each(cases)("passes through $name", async ({ start, end }) => {
            mockGetActiveSubscription.mockResolvedValue(makeSub(start, end));

            const result = await getBillingPeriod("org-1");
            expect(result.isOk()).toBe(true);
            if (result.isOk()) {
                expect(result.value.since).toBe(start);
                expect(result.value.until).toBe(end);
            }
            expect(mockEnsureBillingAccount).not.toHaveBeenCalled();
        });
    });
});
