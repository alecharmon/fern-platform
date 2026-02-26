/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Mocks ---

const mockOpenUpsell = vi.fn();
vi.mock("../UpsellProvider", () => ({
    useUpsell: () => ({ openUpsell: mockOpenUpsell, closeUpsell: vi.fn(), isOpen: false, activeFeature: null })
}));

const mockUseEntitlement = vi.fn();
vi.mock("@/state/useEntitlement", () => ({
    useEntitlement: (key: string) => mockUseEntitlement(key)
}));

const mockUseEntitlementsEnabled = vi.fn();
vi.mock("@/components/posthog/feature-flags/useEntitlementsEnabled", () => ({
    useEntitlementsEnabled: () => mockUseEntitlementsEnabled()
}));

// --- Component under test ---
import { UpsellGate } from "../UpsellGate";

// --- Helpers ---

function entitled() {
    return { isEntitled: true, isLoading: false };
}

function notEntitled() {
    return { isEntitled: false, isLoading: false };
}

function loading() {
    return { isEntitled: false, isLoading: true };
}

function renderGate(feature: "seats" | "ai_credits" | "custom_domain_subpath" = "seats", fallback?: React.ReactNode) {
    return render(
        <UpsellGate feature={feature} fallback={fallback}>
            <button>Invite member</button>
        </UpsellGate>
    );
}

// --- Tests ---

describe("UpsellGate", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default: flag on, entitled
        mockUseEntitlementsEnabled.mockReturnValue(true);
        mockUseEntitlement.mockReturnValue(entitled());
    });

    // -------------------------------------------------------------------------
    // Feature flag off — always pass through
    // -------------------------------------------------------------------------

    it("renders children directly when feature flag is off", () => {
        mockUseEntitlementsEnabled.mockReturnValue(false);
        mockUseEntitlement.mockReturnValue(notEntitled());
        renderGate();
        expect(screen.getByRole("button", { name: "Invite member" })).toBeDefined();
        expect(screen.queryByLabelText(/Upgrade required/)).toBeNull();
    });

    it("does not show overlay when feature flag is off, even if not entitled", () => {
        mockUseEntitlementsEnabled.mockReturnValue(false);
        mockUseEntitlement.mockReturnValue(notEntitled());
        renderGate();
        // No invisible overlay present
        expect(screen.queryByLabelText(/upgrade required/i)).toBeNull();
    });

    it("passes through while flag is still loading (undefined)", () => {
        mockUseEntitlementsEnabled.mockReturnValue(undefined);
        mockUseEntitlement.mockReturnValue(notEntitled());
        renderGate();
        // Children rendered, no overlay (flag not yet confirmed on)
        expect(screen.getByRole("button", { name: "Invite member" })).toBeDefined();
    });

    // -------------------------------------------------------------------------
    // Loading state
    // -------------------------------------------------------------------------

    it("renders children with pulse animation while entitlement is loading", () => {
        mockUseEntitlement.mockReturnValue(loading());
        const { container } = renderGate();
        expect(screen.getByRole("button", { name: "Invite member" })).toBeDefined();
        expect(container.querySelector(".animate-pulse")).toBeDefined();
    });

    it("renders fallback instead of children while loading when fallback is provided", () => {
        mockUseEntitlement.mockReturnValue(loading());
        renderGate("seats", <span>Loading...</span>);
        expect(screen.getByText("Loading...")).toBeDefined();
        expect(screen.queryByRole("button", { name: "Invite member" })).toBeNull();
    });

    // -------------------------------------------------------------------------
    // Entitled — transparent passthrough
    // -------------------------------------------------------------------------

    it("renders children directly when entitled", () => {
        mockUseEntitlement.mockReturnValue(entitled());
        const { container } = renderGate();
        expect(screen.getByRole("button", { name: "Invite member" })).toBeDefined();
        // No overlay wrapper
        expect(container.querySelector(".relative")).toBeNull();
    });

    // -------------------------------------------------------------------------
    // Not entitled — overlay + upsell modal
    // -------------------------------------------------------------------------

    it("renders children with overlay when not entitled", () => {
        mockUseEntitlement.mockReturnValue(notEntitled());
        const { container } = renderGate();
        expect(screen.getByRole("button", { name: "Invite member" })).toBeDefined();
        expect(container.querySelector(".relative")).toBeDefined();
    });

    it("overlay has correct aria-label for the feature", () => {
        mockUseEntitlement.mockReturnValue(notEntitled());
        renderGate("seats");
        expect(screen.getByLabelText("Upgrade required for seats")).toBeDefined();
    });

    it("overlay aria-label uses underscores replaced with spaces", () => {
        mockUseEntitlement.mockReturnValue(notEntitled());
        renderGate("ai_credits");
        expect(screen.getByLabelText("Upgrade required for ai credits")).toBeDefined();
    });

    it("clicking overlay opens upsell modal for the correct feature", () => {
        mockUseEntitlement.mockReturnValue(notEntitled());
        renderGate("seats");
        fireEvent.click(screen.getByLabelText("Upgrade required for seats"));
        expect(mockOpenUpsell).toHaveBeenCalledWith("seats");
    });

    it("overlay does not respond to keyboard events", () => {
        mockUseEntitlement.mockReturnValue(notEntitled());
        renderGate("seats");
        fireEvent.keyDown(screen.getByLabelText("Upgrade required for seats"), { key: "Enter" });
        fireEvent.keyDown(screen.getByLabelText("Upgrade required for seats"), { key: " " });
        expect(mockOpenUpsell).not.toHaveBeenCalled();
    });

    it("overlay click opens upsell for ai_credits feature", () => {
        mockUseEntitlement.mockReturnValue(notEntitled());
        renderGate("ai_credits");
        fireEvent.click(screen.getByLabelText("Upgrade required for ai credits"));
        expect(mockOpenUpsell).toHaveBeenCalledWith("ai_credits");
    });

    it("overlay click opens upsell for custom_domain_subpath feature", () => {
        mockUseEntitlement.mockReturnValue(notEntitled());
        renderGate("custom_domain_subpath");
        fireEvent.click(screen.getByLabelText("Upgrade required for custom domain subpath"));
        expect(mockOpenUpsell).toHaveBeenCalledWith("custom_domain_subpath");
    });

    // -------------------------------------------------------------------------
    // Entitlement key mapping
    // -------------------------------------------------------------------------

    it("checks the seats entitlement key for the seats feature", () => {
        mockUseEntitlement.mockReturnValue(entitled());
        renderGate("seats");
        expect(mockUseEntitlement).toHaveBeenCalledWith("seats");
    });

    it("checks the ai_credits entitlement key for the ai_credits feature", () => {
        mockUseEntitlement.mockReturnValue(entitled());
        renderGate("ai_credits");
        expect(mockUseEntitlement).toHaveBeenCalledWith("ai_credits");
    });
});
