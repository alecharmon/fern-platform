import { err, ok } from "neverthrow";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@fern-platform/billing", () => ({
    constructWebhookEvent: vi.fn(),
    processWebhookEvent: vi.fn()
}));

import { constructWebhookEvent, processWebhookEvent } from "@fern-platform/billing";
import { POST } from "./route";

const mockedConstruct = vi.mocked(constructWebhookEvent);
const mockedProcess = vi.mocked(processWebhookEvent);

describe("POST /api/webhooks/stripe", () => {
    const url = new URL("http://localhost/api/webhooks/stripe");

    beforeEach(() => {
        vi.clearAllMocks();
        delete process.env.STRIPE_WEBHOOK_SECRET;
    });

    afterEach(() => {
        delete process.env.STRIPE_WEBHOOK_SECRET;
    });

    it("returns 400 when signature header missing (env configured)", async () => {
        // Even if env is configured, missing signature should be 400
        process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
        const req = new NextRequest(url, { method: "POST", body: "{}", headers: {} });

        const res = await POST(req);

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: "Missing signature" });
    });

    it("returns 400 when signature header missing", async () => {
        process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
        const req = new NextRequest(url, { method: "POST", body: "{}", headers: {} });

        const res = await POST(req);

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: "Missing signature" });
    });

    it("returns 400 when signature verification fails", async () => {
        process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
        mockedConstruct.mockReturnValue(err({ code: "STRIPE_ERROR", message: "bad sig" } as any));

        const req = new NextRequest(url, {
            method: "POST",
            body: "{}",
            headers: { "stripe-signature": "sig" }
        });

        const res = await POST(req);

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: "Invalid signature" });
        expect(mockedConstruct).toHaveBeenCalled();
    });

    it("processes event and returns 200 with status", async () => {
        process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
        const fakeEvent = { id: "evt_1", type: "customer.created" } as any;
        mockedConstruct.mockReturnValue(ok(fakeEvent));
        mockedProcess.mockResolvedValue(
            ok({
                eventId: "evt_1",
                eventType: "customer.created",
                idempotency: { processed: true, skipped: false, eventId: "evt_1" },
                handler: { handled: true, action: "customer_created" }
            })
        );

        const req = new NextRequest(url, {
            method: "POST",
            body: "{}",
            headers: { "stripe-signature": "sig" }
        });

        const res = await POST(req);

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
            received: true,
            processed: true,
            skipped: false,
            action: "customer_created"
        });
        expect(mockedProcess).toHaveBeenCalledWith(fakeEvent);
    });

    it("returns processed false when handler errors but idempotency logs", async () => {
        process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
        const fakeEvent = { id: "evt_err", type: "customer.created" } as any;
        mockedConstruct.mockReturnValue(ok(fakeEvent));
        mockedProcess.mockResolvedValue(err({ code: "STRIPE_ERROR", message: "failure" } as any));

        const req = new NextRequest(url, {
            method: "POST",
            body: "{}",
            headers: { "stripe-signature": "sig" }
        });

        const res = await POST(req);

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
            received: true,
            processed: false,
            error: "failure"
        });
    });
});
