import { describe, expect, it, vi } from "vitest";

import { executeUpsellAction } from "../actions";
import type { UpsellAction } from "../types";

function createMockRouter() {
    return {
        push: vi.fn(),
        replace: vi.fn(),
        back: vi.fn(),
        forward: vi.fn(),
        refresh: vi.fn(),
        prefetch: vi.fn()
    } as any;
}

describe("executeUpsellAction", () => {
    it("redirect action pushes to org-scoped billing path", () => {
        const router = createMockRouter();
        const action: UpsellAction = { type: "redirect", href: "/billing?reason=seat_limit" };

        executeUpsellAction(action, { orgName: "test-org", router });

        expect(router.push).toHaveBeenCalledWith("/test-org/billing?reason=seat_limit");
    });

    it("checkout action pushes to org billing page", () => {
        const router = createMockRouter();
        const action: UpsellAction = { type: "checkout", plan: "additional_seats" };

        executeUpsellAction(action, { orgName: "test-org", router });

        expect(router.push).toHaveBeenCalledWith("/test-org/billing");
    });

    it("contact-sales action opens URL in new tab", () => {
        const router = createMockRouter();
        const windowOpen = vi.spyOn(window, "open").mockImplementation(() => null);
        const action: UpsellAction = { type: "contact-sales", href: "https://buildwithfern.com/contact" };

        executeUpsellAction(action, { orgName: "test-org", router });

        expect(windowOpen).toHaveBeenCalledWith("https://buildwithfern.com/contact", "_blank", "noopener,noreferrer");
        expect(router.push).not.toHaveBeenCalled();
        windowOpen.mockRestore();
    });
});
