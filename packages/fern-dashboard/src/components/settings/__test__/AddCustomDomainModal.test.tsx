/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Mocks (must come before imports of the component under test) ---

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() })
}));

vi.mock("posthog-js/react", () => ({
    usePostHog: () => null
}));

vi.mock("@/components/posthog/events", () => ({
    captureEvent: vi.fn(),
    PosthogEventName: {
        BILLING_LIMIT_HIT: "billing_limit_hit",
        UPGRADE_CTA_CLICKED: "upgrade_cta_clicked"
    }
}));

const mockInitiateCustomDomain = vi.fn();
vi.mock("@/app/actions/customDomain", () => ({
    initiateCustomDomain: (...args: unknown[]) => mockInitiateCustomDomain(...args)
}));

const mockUseEntitlement = vi.fn();
vi.mock("@/state/useEntitlement", () => ({
    useEntitlement: (key: string) => mockUseEntitlement(key)
}));

const mockOpenUpsell = vi.fn();
vi.mock("@/components/upsells/UpsellProvider", () => ({
    useUpsell: () => ({ openUpsell: mockOpenUpsell, closeUpsell: vi.fn(), isOpen: false, activeFeature: null })
}));

vi.mock("../custom-domain/DomainSetupChecklist", () => ({
    DomainSetupChecklist: () => <div>checklist</div>
}));

// --- Component under test ---
import { AddCustomDomainModal } from "../AddCustomDomainModal";

// --- Helpers ---

const DEFAULT_PROPS = {
    open: true,
    onOpenChange: vi.fn(),
    docsUrl: "test.docs.buildwithfern.com" as any,
    orgName: "test-org" as any
};

function renderModal(props = {}) {
    return render(<AddCustomDomainModal {...DEFAULT_PROPS} {...props} />);
}

// --- Tests ---

describe("AddCustomDomainModal — subpath upsell", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseEntitlement.mockReturnValue({ isEntitled: false, isLoading: false });
    });

    it("opens upsell modal when user submits a subpath domain without entitlement", () => {
        renderModal();

        const input = screen.getByPlaceholderText("docs.example.com");
        fireEvent.change(input, { target: { value: "docs.example.com/api" } });
        fireEvent.click(screen.getByRole("button", { name: "Continue" }));

        expect(mockOpenUpsell).toHaveBeenCalledWith("custom_domain_subpath");
        expect(mockInitiateCustomDomain).not.toHaveBeenCalled();
    });

    it("does not show inline upgrade error message when subpath upsell fires", () => {
        renderModal();

        const input = screen.getByPlaceholderText("docs.example.com");
        fireEvent.change(input, { target: { value: "docs.example.com/api" } });
        fireEvent.click(screen.getByRole("button", { name: "Continue" }));

        expect(screen.queryByText(/subpath domains require/i)).toBeNull();
        expect(screen.queryByRole("link", { name: "Upgrade" })).toBeNull();
    });

    it("does not open upsell when user submits a plain domain", async () => {
        mockUseEntitlement.mockReturnValue({ isEntitled: false, isLoading: false });
        mockInitiateCustomDomain.mockResolvedValue({
            success: true,
            domainInfo: { domain: "docs.example.com", status: "pending" }
        });

        renderModal();

        const input = screen.getByPlaceholderText("docs.example.com");
        fireEvent.change(input, { target: { value: "docs.example.com" } });
        fireEvent.click(screen.getByRole("button", { name: "Continue" }));

        expect(mockOpenUpsell).not.toHaveBeenCalled();
    });

    it("does not open upsell when user is entitled to subpath", () => {
        mockUseEntitlement.mockImplementation((key: string) => {
            if (key === "custom_domain_subpath") {
                return { isEntitled: true, isLoading: false };
            }
            return { isEntitled: false, isLoading: false };
        });
        mockInitiateCustomDomain.mockResolvedValue({
            success: true,
            domainInfo: { domain: "docs.example.com/api", status: "pending" }
        });

        renderModal();

        const input = screen.getByPlaceholderText("docs.example.com");
        fireEvent.change(input, { target: { value: "docs.example.com/api" } });
        fireEvent.click(screen.getByRole("button", { name: "Continue" }));

        expect(mockOpenUpsell).not.toHaveBeenCalled();
    });
});
