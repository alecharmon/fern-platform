const mockUpdateTag = vi.fn();
const mockGetCurrentSessionOrThrow = vi.fn();

vi.mock("next/cache", () => ({
    updateTag: (...args: unknown[]) => mockUpdateTag(...args)
}));

vi.mock("@/app/services/auth0/getCurrentSession", () => ({
    getCurrentSessionOrThrow: () => mockGetCurrentSessionOrThrow()
}));

vi.mock("@/components/org-alert/HeaderBillingAlert", () => ({
    getBillingAlertCacheTag: (orgId: string) => `billing-alert-${orgId}`
}));

import { revalidateBillingAlert } from "@/app/actions/billing/revalidateBillingAlert";

describe("revalidateBillingAlert", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentSessionOrThrow.mockResolvedValue({ user: {}, accessToken: "token" });
    });

    it("calls updateTag with correct tag", async () => {
        await revalidateBillingAlert("org_123");

        expect(mockUpdateTag).toHaveBeenCalledWith("billing-alert-org_123");
    });

    it("checks authentication before updating", async () => {
        await revalidateBillingAlert("org_456");

        expect(mockGetCurrentSessionOrThrow).toHaveBeenCalled();
        expect(mockUpdateTag).toHaveBeenCalled();
    });

    it("throws when not authenticated", async () => {
        mockGetCurrentSessionOrThrow.mockRejectedValue(new Error("Not authenticated"));

        await expect(revalidateBillingAlert("org_789")).rejects.toThrow("Not authenticated");
        expect(mockUpdateTag).not.toHaveBeenCalled();
    });
});
