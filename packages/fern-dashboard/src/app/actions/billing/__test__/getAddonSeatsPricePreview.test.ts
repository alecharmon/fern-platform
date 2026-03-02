import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mockGetOrgBillingAccount = vi.fn();
const mockGetActiveSubscription = vi.fn();
vi.mock("@fern-platform/billing", () => {
    const addonPriceIds = ["price_addon_seats", "price_addon_seats_yearly"];
    const getAddonSeatsPriceId = (interval: string) =>
        interval === "year" ? "price_addon_seats_yearly" : "price_addon_seats";

    return {
        getPriceIds: () => ({
            PRO_MONTHLY: "price_pro_monthly",
            PRO_YEARLY: "price_pro_yearly",
            SUPER_USER: "price_super_user",
            ADDON_EXTRA_SEATS: "price_addon_seats",
            ADDON_EXTRA_SEATS_YEARLY: "price_addon_seats_yearly",
            FREE_TRIAL: "price_free_trial"
        }),
        getAddonSeatsPriceId,
        getAllAddonSeatsPriceIds: () => addonPriceIds,
        resolveSubscriptionAddonContext: (stripeSub: any) => {
            const basePlanItem = stripeSub.items.data.find((item: any) => !addonPriceIds.includes(item.price.id));
            const billingInterval = basePlanItem?.price.recurring?.interval === "year" ? "year" : "month";
            const existingItem = stripeSub.items.data.find((item: any) => addonPriceIds.includes(item.price.id));
            return {
                billingInterval,
                targetAddonPriceId: getAddonSeatsPriceId(billingInterval),
                existingItem,
                existingQuantity: existingItem?.quantity ?? 0
            };
        },
        MAX_ADDON_SEATS: 50,
        MAX_PRO_TOTAL_SEATS: 10,
        getOrgBillingAccount: (...args: unknown[]) => mockGetOrgBillingAccount(...args),
        getActiveSubscription: (...args: unknown[]) => mockGetActiveSubscription(...args)
    };
});

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

function setupAuthAndBilling() {
    mockGetCurrentSession.mockResolvedValue({ accessToken: "tok" });
    mockGetOrgBillingAccount.mockResolvedValue(ok({ stripe_customer_id: "cus_1" }));
    mockGetActiveSubscription.mockResolvedValue(ok({ stripe_subscription_id: "sub_1" }));
}

function makeSubscription(opts: { basePriceId: string; baseInterval: string; addonQuantity?: number }) {
    const items: any[] = [
        {
            id: "si_base",
            price: { id: opts.basePriceId, recurring: { interval: opts.baseInterval } },
            quantity: 1
        }
    ];
    if (opts.addonQuantity != null) {
        items.push({
            id: "si_addon",
            price: { id: "price_addon_seats", recurring: { interval: "month" } },
            quantity: opts.addonQuantity
        });
    }
    return { items: { data: items } };
}

function makeInvoicePreview(opts: {
    total: number;
    subtotal: number;
    recurringAmount: number;
    recurringQuantity: number;
    tax?: number;
}) {
    const totalExcludingTax = opts.total - (opts.tax ?? 0);
    return {
        total: opts.total,
        subtotal: opts.subtotal,
        total_excluding_tax: totalExcludingTax,
        currency: "usd",
        lines: {
            data: [
                {
                    amount: opts.recurringAmount,
                    quantity: opts.recurringQuantity,
                    parent: null,
                    pricing: { price_details: { price: "price_addon_seats" } }
                }
            ]
        }
    };
}

/**
 * Sets up mockCreatePreview to return different values for the two calls:
 * 1st call = current invoice (no modifications)
 * 2nd call = modified invoice (with seat changes)
 */
function setupInvoicePreviews(
    currentInvoice: ReturnType<typeof makeInvoicePreview>,
    modifiedInvoice: ReturnType<typeof makeInvoicePreview>
) {
    mockCreatePreview.mockResolvedValueOnce(currentInvoice).mockResolvedValueOnce(modifiedInvoice);
}

describe("getAddonSeatsPricePreview", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns error when seatsToAdd is 0", async () => {
        const result = await getAddonSeatsPricePreview({ ...BASE_PARAMS, seatsToAdd: 0 });
        expect(result).toEqual({ error: "No seat change specified" });
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

    it("returns recurring breakdown with current subtotal and new total", async () => {
        setupAuthAndBilling();
        mockRetrieveSubscription.mockResolvedValue(
            makeSubscription({ basePriceId: "price_pro_monthly", baseInterval: "month" })
        );

        // Current invoice: base plan $200/month
        const currentInvoice = makeInvoicePreview({
            total: 20000,
            subtotal: 20000,
            recurringAmount: 0,
            recurringQuantity: 0
        });
        // Modified invoice: base $200 + 2 addon seats $40 = $240/month
        const modifiedInvoice = makeInvoicePreview({
            total: 24000,
            subtotal: 24000,
            recurringAmount: 4000,
            recurringQuantity: 2
        });
        setupInvoicePreviews(currentInvoice, modifiedInvoice);

        const result = await getAddonSeatsPricePreview(BASE_PARAMS);
        expect(result).toMatchObject({
            preview: {
                currentRecurringSubtotal: 20000,
                seatDeltaSubtotal: 4000,
                newRecurringTotal: 24000,
                taxDelta: 0,
                currency: "usd"
            }
        });
    });

    describe("billing interval: monthly subscription", () => {
        beforeEach(() => {
            setupAuthAndBilling();
        });

        it("returns billingInterval 'month' and monthly per-seat cost", async () => {
            mockRetrieveSubscription.mockResolvedValue(
                makeSubscription({ basePriceId: "price_pro_monthly", baseInterval: "month" })
            );

            const currentInvoice = makeInvoicePreview({
                total: 20000,
                subtotal: 20000,
                recurringAmount: 0,
                recurringQuantity: 0
            });
            const modifiedInvoice = makeInvoicePreview({
                total: 24000,
                subtotal: 24000,
                recurringAmount: 4000,
                recurringQuantity: 2
            });
            setupInvoicePreviews(currentInvoice, modifiedInvoice);

            const result = await getAddonSeatsPricePreview(BASE_PARAMS);
            expect(result).toMatchObject({
                preview: {
                    billingInterval: "month",
                    perSeatCost: 2000
                }
            });
        });

        it("returns monthly per-seat cost with existing addon seats", async () => {
            mockRetrieveSubscription.mockResolvedValue(
                makeSubscription({ basePriceId: "price_pro_monthly", baseInterval: "month", addonQuantity: 3 })
            );

            const currentInvoice = makeInvoicePreview({
                total: 26000,
                subtotal: 26000,
                recurringAmount: 6000,
                recurringQuantity: 3
            });
            const modifiedInvoice = makeInvoicePreview({
                total: 30000,
                subtotal: 30000,
                recurringAmount: 10000,
                recurringQuantity: 5
            });
            setupInvoicePreviews(currentInvoice, modifiedInvoice);

            const result = await getAddonSeatsPricePreview(BASE_PARAMS);
            expect(result).toMatchObject({
                preview: {
                    billingInterval: "month",
                    perSeatCost: 2000,
                    currentRecurringSubtotal: 26000,
                    seatDeltaSubtotal: 4000,
                    newRecurringTotal: 30000
                }
            });
        });
    });

    describe("billing interval: yearly subscription", () => {
        beforeEach(() => {
            setupAuthAndBilling();
        });

        it("returns billingInterval 'year' and yearly per-seat cost directly from Stripe", async () => {
            // Yearly base plan, no existing addon seats
            // Yearly addon price: $70/seat/year → recurring line for 2 seats = $140/year
            mockRetrieveSubscription.mockResolvedValue(
                makeSubscription({ basePriceId: "price_pro_yearly", baseInterval: "year" })
            );

            const currentInvoice = makeInvoicePreview({
                total: 200000,
                subtotal: 200000,
                recurringAmount: 0,
                recurringQuantity: 0
            });
            const modifiedInvoice = makeInvoicePreview({
                total: 214000,
                subtotal: 214000,
                recurringAmount: 14000,
                recurringQuantity: 2
            });
            setupInvoicePreviews(currentInvoice, modifiedInvoice);

            const result = await getAddonSeatsPricePreview(BASE_PARAMS);
            expect(result).toMatchObject({
                preview: {
                    billingInterval: "year",
                    // $14000 / 2 seats = $70/seat/year = 7000 cents — no annualization
                    perSeatCost: 7000,
                    seatDeltaSubtotal: 14000,
                    newRecurringTotal: 214000
                }
            });
        });

        it("returns yearly per-seat cost with existing addon seats", async () => {
            // Yearly base plan, 3 existing addon seats, adding 2 more = 5 total
            // Yearly addon price: $70/seat/year
            // Recurring line: 5 seats * $70 = $350/year
            mockRetrieveSubscription.mockResolvedValue(
                makeSubscription({ basePriceId: "price_pro_yearly", baseInterval: "year", addonQuantity: 3 })
            );

            const currentInvoice = makeInvoicePreview({
                total: 221000,
                subtotal: 221000,
                recurringAmount: 21000,
                recurringQuantity: 3
            });
            const modifiedInvoice = makeInvoicePreview({
                total: 235000,
                subtotal: 235000,
                recurringAmount: 35000,
                recurringQuantity: 5
            });
            setupInvoicePreviews(currentInvoice, modifiedInvoice);

            const result = await getAddonSeatsPricePreview(BASE_PARAMS);
            expect(result).toMatchObject({
                preview: {
                    billingInterval: "year",
                    // $35000 / 5 seats = $70/seat/year = 7000 cents
                    perSeatCost: 7000,
                    seatDeltaSubtotal: 14000,
                    newRecurringTotal: 235000
                }
            });
        });
    });

    describe("decrementing seats", () => {
        beforeEach(() => {
            setupAuthAndBilling();
        });

        it("returns error when removing more addon seats than exist", async () => {
            mockRetrieveSubscription.mockResolvedValue(
                makeSubscription({ basePriceId: "price_pro_monthly", baseInterval: "month", addonQuantity: 2 })
            );

            const result = await getAddonSeatsPricePreview({ ...BASE_PARAMS, seatsToAdd: -3 });
            expect(result).toEqual({ error: "Cannot remove more addon seats than currently exist" });
        });

        it("returns error when removing seats with no existing addon", async () => {
            mockRetrieveSubscription.mockResolvedValue(
                makeSubscription({ basePriceId: "price_pro_monthly", baseInterval: "month" })
            );

            const result = await getAddonSeatsPricePreview({ ...BASE_PARAMS, seatsToAdd: -1 });
            expect(result).toEqual({ error: "Cannot remove more addon seats than currently exist" });
        });

        it("returns correct preview when removing ALL addon seats (modified invoice has no addon line)", async () => {
            // 2 existing addon seats, removing both → newQuantity = 0
            mockRetrieveSubscription.mockResolvedValue(
                makeSubscription({ basePriceId: "price_pro_monthly", baseInterval: "month", addonQuantity: 2 })
            );

            // Current invoice includes addon line: 2 seats * $20 = $40
            const currentInvoice = makeInvoicePreview({
                total: 24000,
                subtotal: 24000,
                recurringAmount: 4000,
                recurringQuantity: 2
            });
            // Modified invoice: addon item deleted, no addon line at all
            const modifiedInvoice = {
                total: 20000,
                subtotal: 20000,
                total_excluding_tax: 20000,
                currency: "usd",
                lines: { data: [] }
            };
            setupInvoicePreviews(currentInvoice, modifiedInvoice);

            const result = await getAddonSeatsPricePreview({ ...BASE_PARAMS, seatsToAdd: -2 });
            expect(result).toMatchObject({
                preview: {
                    billingInterval: "month",
                    perSeatCost: 2000,
                    currentRecurringSubtotal: 24000,
                    seatDeltaSubtotal: -4000,
                    newRecurringTotal: 20000
                }
            });
        });

        it("returns negative seat delta for removing seats on monthly plan", async () => {
            mockRetrieveSubscription.mockResolvedValue(
                makeSubscription({ basePriceId: "price_pro_monthly", baseInterval: "month", addonQuantity: 5 })
            );

            const currentInvoice = makeInvoicePreview({
                total: 30000,
                subtotal: 30000,
                recurringAmount: 10000,
                recurringQuantity: 5
            });
            const modifiedInvoice = makeInvoicePreview({
                total: 26000,
                subtotal: 26000,
                recurringAmount: 6000,
                recurringQuantity: 3
            });
            setupInvoicePreviews(currentInvoice, modifiedInvoice);

            const result = await getAddonSeatsPricePreview({ ...BASE_PARAMS, seatsToAdd: -2 });
            expect(result).toMatchObject({
                preview: {
                    billingInterval: "month",
                    perSeatCost: 2000,
                    currentRecurringSubtotal: 30000,
                    seatDeltaSubtotal: -4000,
                    newRecurringTotal: 26000
                }
            });
        });
    });
});
