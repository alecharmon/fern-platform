import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockRefresh = vi.fn();
const mockRevalidateBillingAlert = vi.fn();
const mockCreatePortalSession = vi.fn();
const mockCreateCheckoutSession = vi.fn();
const mockSyncAfterCheckout = vi.fn();
const mockWindowOpen = vi.fn();

vi.mock("next/navigation", () => ({
    useRouter: () => ({ refresh: mockRefresh })
}));

vi.mock("@/app/actions/billing/createPortalSession", () => ({
    createPortalSession: (...args: unknown[]) => mockCreatePortalSession(...args)
}));

vi.mock("@/app/actions/billing/createCheckoutSession", () => ({
    createCheckoutSession: (...args: unknown[]) => mockCreateCheckoutSession(...args)
}));

vi.mock("@/app/actions/billing/revalidateBillingAlert", () => ({
    revalidateBillingAlert: (...args: unknown[]) => mockRevalidateBillingAlert(...args)
}));

vi.mock("@/app/actions/billing/syncAfterCheckout", () => ({
    syncAfterCheckout: (...args: unknown[]) => mockSyncAfterCheckout(...args)
}));

vi.mock("@/state/useOrganizations", () => ({
    useCurrentOrganization: () => ({ id: "org_123", name: "test-org", display_name: "Test Org" })
}));

import { BillingOrgAlert } from "../BillingOrgAlert";

describe("BillingOrgAlert", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockWindowOpen.mockReturnValue(null);
        vi.spyOn(window, "open").mockImplementation(mockWindowOpen);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("renders the alert with provided props", () => {
        render(
            <BillingOrgAlert
                variant="warning"
                message="Trial ending"
                actionLabel="Add payment"
                actionType="checkout"
                userEmail="user@test.com"
            />
        );
        expect(screen.getByText("Trial ending")).toBeDefined();
        expect(screen.getByText("Add payment")).toBeDefined();
    });

    it("opens billing portal on action click when actionType is portal", async () => {
        mockCreatePortalSession.mockResolvedValue({ url: "https://billing.stripe.com/session" });

        render(
            <BillingOrgAlert
                variant="danger"
                message="Payment failed"
                actionLabel="Update payment"
                actionType="portal"
            />
        );
        fireEvent.click(screen.getByText("Update payment"));

        await waitFor(() => {
            expect(mockCreatePortalSession).toHaveBeenCalledWith({
                orgId: "org_123",
                orgName: "test-org",
                orgSlug: "test-org"
            });
            expect(mockWindowOpen).toHaveBeenCalledWith(
                "https://billing.stripe.com/session",
                "_blank",
                "noopener,noreferrer"
            );
        });
    });

    it("opens checkout on action click when actionType is checkout", async () => {
        mockCreateCheckoutSession.mockResolvedValue({ url: "https://checkout.stripe.com/session" });

        render(
            <BillingOrgAlert
                variant="warning"
                message="Trial ending"
                actionLabel="Add payment"
                actionType="checkout"
                userEmail="user@test.com"
            />
        );
        fireEvent.click(screen.getByText("Add payment"));

        await waitFor(() => {
            expect(mockCreateCheckoutSession).toHaveBeenCalledWith({
                orgId: "org_123",
                orgName: "test-org",
                orgDisplayName: "Test Org",
                orgSlug: "test-org",
                userEmail: "user@test.com",
                billingCycle: "yearly"
            });
        });
    });

    it("does not open portal when createPortalSession returns error", async () => {
        mockCreatePortalSession.mockResolvedValue({ error: "Failed" });

        render(
            <BillingOrgAlert
                variant="danger"
                message="Payment failed"
                actionLabel="Update payment"
                actionType="portal"
            />
        );
        fireEvent.click(screen.getByText("Update payment"));

        await waitFor(() => {
            expect(mockCreatePortalSession).toHaveBeenCalled();
        });

        expect(mockWindowOpen).not.toHaveBeenCalled();
    });

    it("does not open checkout when createCheckoutSession returns error", async () => {
        mockCreateCheckoutSession.mockResolvedValue({ error: "Failed" });

        render(
            <BillingOrgAlert
                variant="warning"
                message="Trial ending"
                actionLabel="Add payment"
                actionType="checkout"
                userEmail="user@test.com"
            />
        );
        fireEvent.click(screen.getByText("Add payment"));

        await waitFor(() => {
            expect(mockCreateCheckoutSession).toHaveBeenCalled();
        });

        expect(mockWindowOpen).not.toHaveBeenCalled();
    });

    it("registers focus listener after opening portal and calls revalidation on focus", async () => {
        mockCreatePortalSession.mockResolvedValue({ url: "https://billing.stripe.com/session" });

        const addSpy = vi.spyOn(window, "addEventListener");
        const removeSpy = vi.spyOn(window, "removeEventListener");

        render(
            <BillingOrgAlert
                variant="danger"
                message="Payment failed"
                actionLabel="Update payment"
                actionType="portal"
            />
        );
        fireEvent.click(screen.getByText("Update payment"));

        await waitFor(() => {
            expect(addSpy).toHaveBeenCalledWith("focus", expect.any(Function));
        });

        // Simulate user returning from portal
        const focusHandler = addSpy.mock.calls.find((call) => call[0] === "focus")![1] as EventListener;
        focusHandler(new Event("focus"));

        await waitFor(() => {
            expect(mockRevalidateBillingAlert).toHaveBeenCalledWith("org_123");
            expect(mockRefresh).toHaveBeenCalled();
            expect(removeSpy).toHaveBeenCalledWith("focus", focusHandler);
        });
    });

    it("self-removes focus listener after first trigger", async () => {
        mockCreatePortalSession.mockResolvedValue({ url: "https://billing.stripe.com/session" });

        const addSpy = vi.spyOn(window, "addEventListener");

        render(
            <BillingOrgAlert
                variant="danger"
                message="Payment failed"
                actionLabel="Update payment"
                actionType="portal"
            />
        );
        fireEvent.click(screen.getByText("Update payment"));

        await waitFor(() => {
            expect(addSpy).toHaveBeenCalledWith("focus", expect.any(Function));
        });

        const focusHandler = addSpy.mock.calls.find((call) => call[0] === "focus")![1] as EventListener;

        // First focus - should trigger
        mockRevalidateBillingAlert.mockClear();
        mockRefresh.mockClear();
        focusHandler(new Event("focus"));
        await waitFor(() => {
            expect(mockRevalidateBillingAlert).toHaveBeenCalledTimes(1);
            expect(mockRefresh).toHaveBeenCalledTimes(1);
        });
    });

    it("removes previous focus listener when portal is opened again", async () => {
        mockCreatePortalSession.mockResolvedValue({ url: "https://billing.stripe.com/session" });

        const removeSpy = vi.spyOn(window, "removeEventListener");
        const addSpy = vi.spyOn(window, "addEventListener");

        render(
            <BillingOrgAlert
                variant="danger"
                message="Payment failed"
                actionLabel="Update payment"
                actionType="portal"
            />
        );

        // First click
        fireEvent.click(screen.getByText("Update payment"));
        await waitFor(() => {
            expect(addSpy).toHaveBeenCalledWith("focus", expect.any(Function));
        });
        const firstHandler = addSpy.mock.calls.find((call) => call[0] === "focus")![1];

        // Second click
        addSpy.mockClear();
        fireEvent.click(screen.getByText("Update payment"));
        await waitFor(() => {
            expect(removeSpy).toHaveBeenCalledWith("focus", firstHandler);
        });
    });

    it("cleans up focus listener on unmount", async () => {
        mockCreatePortalSession.mockResolvedValue({ url: "https://billing.stripe.com/session" });

        const removeSpy = vi.spyOn(window, "removeEventListener");
        const addSpy = vi.spyOn(window, "addEventListener");

        const { unmount } = render(
            <BillingOrgAlert
                variant="danger"
                message="Payment failed"
                actionLabel="Update payment"
                actionType="portal"
            />
        );

        fireEvent.click(screen.getByText("Update payment"));
        await waitFor(() => {
            expect(addSpy).toHaveBeenCalledWith("focus", expect.any(Function));
        });

        unmount();

        expect(removeSpy).toHaveBeenCalledWith("focus", expect.any(Function));
    });

    it("does nothing for checkout when userEmail is not provided", async () => {
        render(
            <BillingOrgAlert variant="warning" message="Trial ending" actionLabel="Add payment" actionType="checkout" />
        );
        fireEvent.click(screen.getByText("Add payment"));

        await waitFor(() => {
            expect(mockCreateCheckoutSession).not.toHaveBeenCalled();
        });
    });
});
