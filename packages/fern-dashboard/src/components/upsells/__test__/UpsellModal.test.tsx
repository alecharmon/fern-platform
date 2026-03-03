/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Mocks (must come before imports of the component under test) ---

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn() })
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

const mockCloseUpsell = vi.fn();
const mockUseUpsell = vi.fn();
vi.mock("../UpsellProvider", () => ({
    useUpsell: () => mockUseUpsell()
}));

const mockUseCurrentTier = vi.fn();
vi.mock("../useCurrentTier", () => ({
    useCurrentTier: () => mockUseCurrentTier()
}));

const mockUseEntitlement = vi.fn();
vi.mock("@/state/useEntitlement", () => ({
    useEntitlement: (key: string) => mockUseEntitlement(key)
}));

const mockUseCurrentOrganization = vi.fn();
vi.mock("@/state/useOrganizations", () => ({
    useCurrentOrganization: () => mockUseCurrentOrganization()
}));

const mockExecuteUpsellAction = vi.fn();
vi.mock("../actions", () => ({
    executeUpsellAction: (...args: unknown[]) => mockExecuteUpsellAction(...args)
}));

// No custom content in tests — keeps rendering simple
vi.mock("../content", () => ({
    UPSELL_CONTENT: {}
}));

// --- Component under test ---
import { UpsellModal } from "../UpsellModal";

// --- Helpers ---

function renderModal() {
    return render(<UpsellModal />);
}

/** Default org for all tests */
const DEFAULT_ORG = { id: "org_1", name: "test-org" as any };

/** Stub useEntitlement to return entitled=true for can_purchase_additional_seats */
function mockCanPurchaseSeats(canPurchase: boolean) {
    mockUseEntitlement.mockImplementation((key: string) => {
        if (key === "can_purchase_additional_seats") {
            return { isEntitled: canPurchase };
        }
        return { isEntitled: true };
    });
}

// --- Tests ---

describe("UpsellModal", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseCurrentOrganization.mockReturnValue(DEFAULT_ORG);
        mockUseCurrentTier.mockReturnValue("free");
        mockUseUpsell.mockReturnValue({
            activeFeature: "seats",
            isOpen: true,
            closeUpsell: mockCloseUpsell,
            openUpsell: vi.fn()
        });
        mockCanPurchaseSeats(false);
    });

    // -------------------------------------------------------------------------
    // Render guards
    // -------------------------------------------------------------------------

    it("renders nothing when isOpen is false", () => {
        mockUseUpsell.mockReturnValue({ activeFeature: "seats", isOpen: false, closeUpsell: mockCloseUpsell });
        renderModal();
        expect(screen.queryByText("Grow your team")).toBeNull();
    });

    it("renders nothing when activeFeature is null", () => {
        mockUseUpsell.mockReturnValue({ activeFeature: null, isOpen: true, closeUpsell: mockCloseUpsell });
        const { container } = renderModal();
        expect(container.firstChild).toBeNull();
    });

    it("seats + canPurchaseSeats=true while tier loading: shows base config (no paid override applied yet)", () => {
        // When canPurchaseSeats=true, effectiveTier=undefined while billing loads.
        // The modal renders base config title rather than the paid tier override title.
        mockUseCurrentTier.mockReturnValue(undefined);
        mockCanPurchaseSeats(true);
        mockUseUpsell.mockReturnValue({ activeFeature: "seats", isOpen: true, closeUpsell: mockCloseUpsell });
        renderModal();
        // Base config shown — NOT the paid override ("Add additional members...")
        expect(screen.getByText("Grow your team")).toBeDefined();
        expect(screen.queryByText(/Add additional members/)).toBeNull();
    });

    it("seats + free tier still shows content while billing tier is loading (no flicker)", () => {
        // When canPurchaseSeats=false, effectiveTier="free" regardless of loading state.
        // Free users see the modal immediately without waiting for billing data.
        mockUseCurrentTier.mockReturnValue(undefined);
        mockCanPurchaseSeats(false);
        renderModal();
        expect(screen.getByText("Grow your team")).toBeDefined();
    });

    // -------------------------------------------------------------------------
    // Seats — free tier (canPurchaseSeats = false)
    // -------------------------------------------------------------------------

    it("seats + free: shows 'Grow your team' title", () => {
        mockUseCurrentTier.mockReturnValue("free");
        mockCanPurchaseSeats(false);
        renderModal();
        expect(screen.getByText("Grow your team")).toBeDefined();
    });

    it("seats + free: shows 'Upgrade to Team' CTA", () => {
        mockUseCurrentTier.mockReturnValue("free");
        mockCanPurchaseSeats(false);
        renderModal();
        expect(screen.getByRole("button", { name: "Upgrade to Team" })).toBeDefined();
    });

    it("seats + free: shows description text", () => {
        mockUseCurrentTier.mockReturnValue("free");
        mockCanPurchaseSeats(false);
        renderModal();
        expect(screen.getByText(/You are at your 2 seat limit/)).toBeDefined();
    });

    // -------------------------------------------------------------------------
    // Seats — billing says paid but canPurchaseSeats = false (data mismatch)
    // -------------------------------------------------------------------------

    it("seats + billing=paid but canPurchaseSeats=false: still shows free tier content", () => {
        mockUseCurrentTier.mockReturnValue("paid");
        mockCanPurchaseSeats(false);
        renderModal();
        expect(screen.getByText("Grow your team")).toBeDefined();
        expect(screen.getByRole("button", { name: "Upgrade to Team" })).toBeDefined();
    });

    // -------------------------------------------------------------------------
    // Seats — paid tier (canPurchaseSeats = true)
    // -------------------------------------------------------------------------

    it("seats + paid: shows paid tier override title", () => {
        mockUseCurrentTier.mockReturnValue("paid");
        mockCanPurchaseSeats(true);
        renderModal();
        expect(screen.getByText(/Manage amount of members/)).toBeDefined();
    });

    it("seats + paid: does not show featureIntro", () => {
        mockUseCurrentTier.mockReturnValue("paid");
        mockCanPurchaseSeats(true);
        renderModal();
        expect(screen.queryByText(/Along with up to 5 team members/)).toBeNull();
    });

    it("seats + paid: shows 'Add seats' CTA (no custom content rendered in test)", () => {
        mockUseCurrentTier.mockReturnValue("paid");
        mockCanPurchaseSeats(true);
        renderModal();
        expect(screen.getByRole("button", { name: "Add seats" })).toBeDefined();
    });

    // -------------------------------------------------------------------------
    // AI credits
    // -------------------------------------------------------------------------

    it("ai_credits + free: shows upgrade title and 'Upgrade to Team' CTA", () => {
        mockUseCurrentTier.mockReturnValue("free");
        mockUseUpsell.mockReturnValue({ activeFeature: "ai_credits", isOpen: true, closeUpsell: mockCloseUpsell });
        renderModal();
        expect(screen.getByText("Upgrade to the Team plan to receive 1,000 monthly AI credits")).toBeDefined();
        expect(screen.getByRole("button", { name: "Upgrade to Team" })).toBeDefined();
    });

    it("ai_credits + paid: shows paid tier override title", () => {
        mockUseCurrentTier.mockReturnValue("paid");
        mockUseUpsell.mockReturnValue({ activeFeature: "ai_credits", isOpen: true, closeUpsell: mockCloseUpsell });
        renderModal();
        expect(screen.getByText("Add additional AI credits to your plan")).toBeDefined();
    });

    // -------------------------------------------------------------------------
    // Custom domain subpath
    // -------------------------------------------------------------------------

    it("custom_domain_subpath + free: shows upgrade title", () => {
        mockUseCurrentTier.mockReturnValue("free");
        mockUseUpsell.mockReturnValue({
            activeFeature: "custom_domain_subpath",
            isOpen: true,
            closeUpsell: mockCloseUpsell
        });
        renderModal();
        expect(screen.getByText("Upgrade to the Team plan to add a subpath")).toBeDefined();
    });

    // -------------------------------------------------------------------------
    // CTA interactions
    // -------------------------------------------------------------------------

    it("clicking CTA calls executeUpsellAction", () => {
        mockUseCurrentTier.mockReturnValue("free");
        mockCanPurchaseSeats(false);
        renderModal();
        fireEvent.click(screen.getByRole("button", { name: "Upgrade to Team" }));
        expect(mockExecuteUpsellAction).toHaveBeenCalledOnce();
    });

    it("clicking CTA does nothing when org is not loaded", () => {
        mockUseCurrentOrganization.mockReturnValue(null);
        mockUseCurrentTier.mockReturnValue("free");
        mockCanPurchaseSeats(false);
        renderModal();
        fireEvent.click(screen.getByRole("button", { name: "Upgrade to Team" }));
        expect(mockExecuteUpsellAction).not.toHaveBeenCalled();
    });
});
