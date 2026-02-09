import { ok } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockConstructEvent = vi.fn();

vi.mock("stripe", () => {
    const StripeMock = vi.fn().mockImplementation(() => ({
        webhooks: { constructEvent: mockConstructEvent }
    }));
    return { default: StripeMock };
});

// Mock external modules used by webhook helpers
vi.mock("../db/events", () => ({
    tryInsertEvent: vi.fn(),
    markEventProcessed: vi.fn(),
    markEventFailed: vi.fn()
}));

vi.mock("../db/subscriptions", () => ({
    upsertSubscriptionByStripeId: vi.fn(),
    upsertSubscriptionItem: vi.fn(),
    deleteSubscriptionItemsNotIn: vi.fn()
}));

vi.mock("../db/products", () => ({
    getProductBySku: vi.fn()
}));

vi.mock("../db/accounts", () => ({
    getOrgBillingAccountByCustomerId: vi.fn(),
    upsertOrgBillingAccount: vi.fn()
}));

vi.mock("@fern-platform/supabase", () => ({
    getClient: vi.fn()
}));

import { handleWebhookEvent } from "../webhooks/handlers";
// Modules under test (will be implemented)
import { withIdempotency } from "../webhooks/idempotency";
import { processWebhookEvent } from "../webhooks/processor";
import { syncCustomerFromStripe, syncCustomerUpdateFromStripe, syncSubscriptionFromStripe } from "../webhooks/sync";

// Helpers to access mocks
const eventsMocks = vi.mocked(await import("../db/events"));
const subscriptionMocks = vi.mocked(await import("../db/subscriptions"));
const productMocks = vi.mocked(await import("../db/products"));
const accountMocks = vi.mocked(await import("../db/accounts"));
const supabaseMocks = vi.mocked(await import("@fern-platform/supabase"));
const stripeClientModule = await import("../stripe/client");

describe("withIdempotency", () => {
    const baseEvent = {
        id: "evt_123",
        type: "customer.subscription.created",
        created: Math.floor(Date.now() / 1000)
    } as any;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("processes new events and marks processed", async () => {
        eventsMocks.tryInsertEvent.mockResolvedValue(ok(true));
        eventsMocks.markEventProcessed.mockResolvedValue(ok(undefined));

        const handler = vi.fn().mockResolvedValue(undefined);
        const result = await withIdempotency(baseEvent, handler);

        expect(result.isOk()).toBe(true);
        const value = result._unsafeUnwrap();
        expect(value.processed).toBe(true);
        expect(value.skipped).toBe(false);
        expect(handler).toHaveBeenCalledTimes(1);
        expect(eventsMocks.markEventProcessed).toHaveBeenCalledWith(baseEvent.id);
    });

    it("skips duplicate events without invoking handler", async () => {
        eventsMocks.tryInsertEvent.mockResolvedValue(ok(false));

        const handler = vi.fn();
        const result = await withIdempotency(baseEvent, handler);

        expect(result.isOk()).toBe(true);
        const value = result._unsafeUnwrap();
        expect(value.processed).toBe(false);
        expect(value.skipped).toBe(true);
        expect(handler).not.toHaveBeenCalled();
        expect(eventsMocks.markEventProcessed).not.toHaveBeenCalled();
    });

    it("marks event failed when handler throws", async () => {
        eventsMocks.tryInsertEvent.mockResolvedValue(ok(true));
        eventsMocks.markEventFailed.mockResolvedValue(ok(undefined));

        const handler = vi.fn().mockRejectedValue(new Error("boom"));
        const result = await withIdempotency(baseEvent, handler);

        expect(result.isErr()).toBe(true);
        const error = result._unsafeUnwrapErr();
        expect(error.code).toBe("STRIPE_ERROR");
        expect(eventsMocks.markEventFailed).toHaveBeenCalledWith(baseEvent.id, "boom");
    });
});

describe("constructWebhookEvent", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockConstructEvent.mockReset();
        process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
        stripeClientModule.resetStripeClient();
    });

    afterEach(() => {
        delete process.env.STRIPE_SECRET_KEY;
    });

    it("uses provided secret parameter when given", () => {
        const payload = "{}";
        const signature = "sig";
        mockConstructEvent.mockReturnValue({ id: "evt_1" });

        const result = stripeClientModule.constructWebhookEvent(payload, signature, "override");

        if (result.isErr()) {
            // aid debugging when this test fails
            console.error("constructWebhookEvent error (override):", result._unsafeUnwrapErr());
        }
        expect(result.isOk()).toBe(true);
        expect(mockConstructEvent).toHaveBeenCalledWith(payload, signature, "override");
    });

    it("falls back to env STRIPE_WEBHOOK_SECRET when param missing", () => {
        process.env.STRIPE_WEBHOOK_SECRET = "env_secret";
        const payload = "{}";
        const signature = "sig";
        mockConstructEvent.mockReturnValue({ id: "evt_2" });

        const result = stripeClientModule.constructWebhookEvent(payload, signature);

        if (result.isErr()) {
            console.error("constructWebhookEvent error (env):", result._unsafeUnwrapErr());
        }
        expect(result.isOk()).toBe(true);
        expect(mockConstructEvent).toHaveBeenCalledWith(payload, signature, "env_secret");
    });

    it("returns error when no secret is available", () => {
        delete process.env.STRIPE_WEBHOOK_SECRET;
        const result = stripeClientModule.constructWebhookEvent("{}", "sig");

        expect(result.isErr()).toBe(true);
        expect(result._unsafeUnwrapErr().code).toBe("NOT_CONFIGURED");
    });
});

describe("syncSubscriptionFromStripe", () => {
    let getStripeClientSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.clearAllMocks();
        getStripeClientSpy = vi.spyOn(stripeClientModule, "getStripeClient");
    });

    afterEach(() => {
        getStripeClientSpy.mockRestore();
    });

    it("syncs subscription items and deletes removed ones", async () => {
        accountMocks.getOrgBillingAccountByCustomerId.mockResolvedValue(
            ok({ org_id: "org_1", stripe_customer_id: "cus_1" } as any)
        );
        subscriptionMocks.upsertSubscriptionByStripeId.mockResolvedValue(ok({ id: "sub_db_1" } as any));
        subscriptionMocks.upsertSubscriptionItem.mockResolvedValue(ok({ id: "item_db_1" } as any));
        subscriptionMocks.deleteSubscriptionItemsNotIn.mockResolvedValue(ok(undefined));
        productMocks.getProductBySku.mockResolvedValue(ok({ id: "prod_db_1" } as any));

        const retrieve = vi.fn().mockResolvedValue({ metadata: { sku: "sku_basic" } });
        getStripeClientSpy.mockReturnValue({ products: { retrieve } } as any);

        const subscription = {
            id: "sub_stripe_1",
            status: "active",
            current_period_start: 100,
            current_period_end: 200,
            customer: "cus_1",
            items: {
                data: [
                    {
                        id: "si_1",
                        quantity: 2,
                        price: { product: "prod_stripe_1" }
                    }
                ]
            }
        } as any;

        const result = await syncSubscriptionFromStripe(subscription);

        expect(result.isOk()).toBe(true);
        const value = result._unsafeUnwrap();
        expect(value.orgId).toBe("org_1");
        expect(value.subscriptionId).toBe("sub_db_1");
        expect(value.itemCount).toBe(1);
        expect(subscriptionMocks.deleteSubscriptionItemsNotIn).toHaveBeenCalledWith("sub_db_1", ["si_1"]);
    });

    it("returns error when billing account missing", async () => {
        accountMocks.getOrgBillingAccountByCustomerId.mockResolvedValue(ok(null));

        const subscription = {
            id: "sub_stripe_1",
            status: "active",
            current_period_start: 100,
            current_period_end: 200,
            customer: "cus_missing",
            items: { data: [] }
        } as any;

        const result = await syncSubscriptionFromStripe(subscription);

        expect(result.isErr()).toBe(true);
        expect(result._unsafeUnwrapErr().code).toBe("NOT_FOUND");
    });
});

describe("syncCustomerFromStripe", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("upserts billing account with provided orgId", async () => {
        accountMocks.upsertOrgBillingAccount.mockResolvedValue(ok({ org_id: "org_1" } as any));
        const customer = { id: "cus_1", metadata: {} } as any;

        const result = await syncCustomerFromStripe(customer, "org_1");

        expect(result.isOk()).toBe(true);
        expect(result._unsafeUnwrap().orgId).toBe("org_1");
        expect(accountMocks.upsertOrgBillingAccount).toHaveBeenCalledWith({
            org_id: "org_1",
            stripe_customer_id: "cus_1"
        });
    });
});

describe("syncCustomerUpdateFromStripe", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("updates org mapping and resyncs subscriptions when org changes", async () => {
        const deleteEq = vi.fn().mockResolvedValue({ error: null });
        const deleteFn = vi.fn().mockReturnValue({ eq: deleteEq });
        const fromFn = vi.fn().mockReturnValue({ delete: deleteFn });
        supabaseMocks.getClient.mockReturnValue({ from: fromFn } as any);

        accountMocks.getOrgBillingAccountByCustomerId
            .mockResolvedValueOnce(ok({ org_id: "old_org", stripe_customer_id: "cus_1" } as any))
            .mockResolvedValueOnce(ok({ org_id: "new_org", stripe_customer_id: "cus_1" } as any));
        accountMocks.upsertOrgBillingAccount.mockResolvedValue(ok({ org_id: "new_org" } as any));

        const mockSubscription = {
            id: "sub_1",
            status: "active",
            current_period_start: 1,
            current_period_end: 2,
            customer: "cus_1",
            items: { data: [] }
        } as any;

        const list = vi.fn().mockResolvedValue({ data: [mockSubscription] });
        const getStripeClientSpy = vi.spyOn(stripeClientModule, "getStripeClient");
        getStripeClientSpy.mockReturnValue({
            subscriptions: { list },
            products: { retrieve: vi.fn() }
        } as any);

        subscriptionMocks.upsertSubscriptionByStripeId.mockResolvedValue(ok({ id: "sub_db" } as any));
        subscriptionMocks.deleteSubscriptionItemsNotIn.mockResolvedValue(ok(undefined));

        const result = await syncCustomerUpdateFromStripe(
            { id: "cus_1", metadata: { org_id: "new_org" } } as any,
            "new_org"
        );

        expect(result.isOk()).toBe(true);
        expect(list).toHaveBeenCalledWith({ customer: "cus_1", status: "all", limit: 100 });
        expect(subscriptionMocks.deleteSubscriptionItemsNotIn).toHaveBeenCalledWith("sub_db", []);
        expect(deleteFn).toHaveBeenCalled();

        getStripeClientSpy.mockRestore();
    });
});

describe("handleWebhookEvent", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("routes customer.created", async () => {
        accountMocks.upsertOrgBillingAccount.mockResolvedValue(ok({ org_id: "org_1" } as any));
        const result = await handleWebhookEvent({
            id: "evt_cust",
            type: "customer.created",
            data: { object: { id: "cus_1", metadata: { org_id: "org_1" } } }
        } as any);

        expect(result.isOk()).toBe(true);
        expect(result._unsafeUnwrap().action).toBe("customer_created");
    });

    it("returns handled:false for unrecognized events", async () => {
        const result = await handleWebhookEvent({
            id: "evt_unknown",
            type: "payment_intent.succeeded",
            data: { object: {} }
        } as any);

        expect(result.isOk()).toBe(true);
        expect(result._unsafeUnwrap().handled).toBe(false);
    });
});

describe("processWebhookEvent", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("wraps handler in idempotency and returns result", async () => {
        // Spy on withIdempotency by using the real function but mocking internals
        const event = {
            id: "evt_200",
            type: "customer.created",
            created: Math.floor(Date.now() / 1000),
            data: { object: { id: "cus_200", metadata: { org_id: "org_2" } } }
        } as any;

        // Make idempotency succeed and ensure handler sets handled true
        eventsMocks.tryInsertEvent.mockResolvedValue(ok(true));
        eventsMocks.markEventProcessed.mockResolvedValue(ok(undefined));

        accountMocks.upsertOrgBillingAccount.mockResolvedValue(ok({ org_id: "org_2" } as any));

        const result = await processWebhookEvent(event);

        expect(result.isOk()).toBe(true);
        const value = result._unsafeUnwrap();
        expect(value.eventId).toBe("evt_200");
        expect(value.idempotency.processed).toBe(true);
        expect(value.handler?.handled).toBe(true);
    });
});
